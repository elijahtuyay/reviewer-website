"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getExamConfig, getSectionConfig, isValidExamId } from "@/lib/exam-config";
import { drawRandomQuestionIds, getQuestionsByIds } from "@/lib/data/questions";
import { scoreAttempt } from "@/lib/scoring";
import { ExamId, SectionId } from "@/data/schema";
import {
  clearSectionProgress,
  getStoredProgress,
  purgeLegacyPersistedProgress,
  saveStoredProgress,
} from "@/lib/session-progress";
import Timer from "@/components/Timer";
import QuestionCard from "@/components/QuestionCard";
import ResultSummary from "@/components/ResultSummary";
import ProgressTracker from "@/components/ProgressTracker";
import SectionNav from "@/components/SectionNav";
import PauseOverlay from "@/components/PauseOverlay";
import ConfirmDialog from "@/components/ConfirmDialog";
import MobileNavSheet from "@/components/MobileNavSheet";

type Phase = "taking" | "review";

/**
 * What, if anything, was restored from earlier in the session. Every one of these
 * is stated out loud rather than silently reinstated. "resumed" = attempt still
 * running, "completed" = already submitted, "expired" = the timer ran out.
 */
type NoticeKind = "resumed" | "completed" | "expired" | null;

/**
 * Both callers now fire from inside a confirmation dialog, which scroll-locks
 * the body (`overflow: hidden`) until its effect cleanup runs on the next
 * commit. Deferring a frame lets that unwind first, so the scroll can't be
 * swallowed by the lock. Restarting is only reachable through the dialog now,
 * and landing mid-page in a freshly drawn question set would be disorienting.
 */
function scrollToTop() {
  requestAnimationFrame(() => window.scrollTo({ top: 0 }));
}

/** Phrased in the past tense: these banners are re-shown on every return visit, not just the first. */
const NOTICE_COPY = {
  resumed: {
    title: "You have an attempt already in progress.",
    detail: "It was started earlier in this browser session, and its timer has been running since then.",
  },
  completed: {
    title: "You already submitted this section.",
    detail: "It was submitted earlier in this browser session. Your scored review is below.",
  },
  expired: {
    title: "This section was submitted when its time ran out.",
    detail: "Your answers up to that point were scored. Review them below.",
  },
} as const;

export default function QuizPage({ params }: { params: Promise<{ examId: string; section: string }> }) {
  const { examId: examIdParam, section: sectionParam } = use(params);

  // The parent server layout already 404s for an invalid/unavailable examId or
  // section before this client component ever renders, so these checks are a
  // type-narrowing formality, not a real gate — `notFound()` isn't a supported
  // call from a Client Component.
  const examIdValid = isValidExamId(examIdParam);
  const examId = (examIdValid ? examIdParam : "nmat") as ExamId;
  const exam = getExamConfig(examId);
  const sectionValid = exam.sections.some((s) => s.id === sectionParam);
  const section = (sectionValid ? sectionParam : exam.sections[0].id) as SectionId;

  const sectionConfig = getSectionConfig(examId, section);

  const [questionIds, setQuestionIds] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [phase, setPhase] = useState<Phase>("taking");
  const [hydrated, setHydrated] = useState(false);
  const [paused, setPaused] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [deadline, setDeadline] = useState(0);
  const [notice, setNotice] = useState<NoticeKind>(null);
  /** Which destructive action is awaiting confirmation, if any. */
  const [pendingAction, setPendingAction] = useState<"submit" | "restart" | null>(null);
  const pendingNoticeRef = useRef<NoticeKind>(null);
  /**
   * Which `examId:section` the load effect below has already run for. The effect
   * both draws a random question set and writes it to storage, so a second
   * invocation would read its own first-pass write back and mistake a brand-new
   * attempt for a resumed one. React 19 Strict Mode double-invokes mount effects
   * in dev, which made exactly that happen.
   */
  const loadedKeyRef = useRef<string | null>(null);

  const questions = useMemo(
    () => getQuestionsByIds(examId, section, questionIds),
    [examId, section, questionIds]
  );

  // Resume any progress saved earlier in this browser session, or draw a fresh
  // random subset from the full bank if there is none. Anything resumed is
  // announced in the banner below rather than silently reinstated.
  useEffect(() => {
    const loadKey = `${examId}:${section}`;
    if (loadedKeyRef.current === loadKey) return;
    loadedKeyRef.current = loadKey;

    purgeLegacyPersistedProgress();
    const stored = getStoredProgress(examId, section);
    const isResume = stored.questionIds.length > 0;
    const ids = isResume
      ? stored.questionIds
      : drawRandomQuestionIds(examId, section, sectionConfig.questionCount);

    const now = Date.now();
    let { submitted, expired, deadline: endAt } = stored;
    if (!submitted) {
      if (!endAt) {
        endAt = now + sectionConfig.minutes * 60_000;
      } else if (stored.pausedAt > 0) {
        // The attempt was paused when the page went away. Reloading ends the
        // pause, but the time spent paused was promised back to the user, so
        // push the deadline out by however long it lasted before judging expiry.
        endAt += now - stored.pausedAt;
      } else if (endAt <= now) {
        // The clock ran out while the tab sat in the background or between
        // navigations. Close the attempt out honestly instead of handing back a
        // live-looking timer that is already spent.
        submitted = true;
        expired = true;
      }
    }

    setQuestionIds(ids);
    setAnswers(stored.answers);
    setPhase(submitted ? "review" : "taking");
    setDeadline(endAt);
    // A started section counts as resumed even with zero answers: its clock has
    // been running the whole time, and an unexplained shortened timer is exactly
    // the kind of surprise this banner exists to prevent. Held in a ref and
    // committed by the effect below so that the banner text lands in a separate
    // DOM mutation from its live region, which is what makes it get announced.
    pendingNoticeRef.current = expired ? "expired" : !isResume ? null : submitted ? "completed" : "resumed";
    setHydrated(true);

    if (!isResume || submitted !== stored.submitted || endAt !== stored.deadline || stored.pausedAt > 0) {
      saveStoredProgress(examId, section, {
        answers: stored.answers,
        submitted,
        questionIds: ids,
        deadline: endAt,
        expired,
        pausedAt: 0,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, section]);

  // Runs on the commit after the one that first renders the page, so the empty
  // role="status" region already exists in the DOM when its text appears.
  useEffect(() => {
    if (!hydrated || pendingNoticeRef.current === null) return;
    setNotice(pendingNoticeRef.current);
    pendingNoticeRef.current = null;
    // questionIds is in the deps, not just `hydrated`: switching sections
    // client-side re-runs the loader without `hydrated` ever flipping again.
  }, [hydrated, questionIds]);

  const answeredCount = Object.values(answers).filter((v) => v !== null && v !== undefined).length;
  const answeredNumbers = questions
    .map((q, i) => (answers[q.id] !== null && answers[q.id] !== undefined ? i + 1 : null))
    .filter((n): n is number => n !== null);
  const correctNumbers = questions
    .map((q, i) => (answers[q.id] === q.correctIndex ? i + 1 : null))
    .filter((n): n is number => n !== null);
  const incorrectNumbers = questions
    .map((q, i) =>
      answers[q.id] !== null && answers[q.id] !== undefined && answers[q.id] !== q.correctIndex ? i + 1 : null
    )
    .filter((n): n is number => n !== null);

  function persist(
    nextAnswers: Record<string, number | null>,
    submitted: boolean,
    overrides: { deadline?: number; expired?: boolean; pausedAt?: number } = {}
  ) {
    const cleaned: Record<string, number> = {};
    for (const [id, value] of Object.entries(nextAnswers)) {
      if (value !== null && value !== undefined) cleaned[id] = value;
    }
    saveStoredProgress(examId, section, {
      answers: cleaned,
      submitted,
      questionIds,
      deadline: overrides.deadline ?? deadline,
      expired: overrides.expired ?? false,
      pausedAt: overrides.pausedAt ?? 0,
    });
  }

  function handleSelect(questionId: string, optionIndex: number) {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: optionIndex };
      persist(next, false);
      return next;
    });
  }

  /**
   * Closes the attempt out. Reads the answers through the state updater rather
   * than the render closure so a submit racing an in-flight answer click can't
   * write a one-render-stale map to storage.
   */
  function closeOut(expired: boolean) {
    // An attempt can only be closed out once. Without this guard, a submit
    // confirmation left open while the timer runs out would still be sitting
    // there afterwards, and confirming it would re-close an already-expired
    // attempt: persisting `expired: false` over the real record and clearing the
    // "time ran out" banner, so the user would never learn what happened.
    if (phase === "review") return;
    // Also dismisses any confirmation that is still open, so the expiry banner
    // isn't left hidden behind a dialog describing an action already overtaken.
    setPendingAction(null);
    setAnswers((prev) => {
      persist(prev, true, { expired });
      return prev;
    });
    setNotice(expired ? "expired" : null);
    setPhase("review");
    // The submit button is a sticky bar at the bottom of a 36-question page, so
    // the user is always at the bottom when a section closes out, while the
    // score, the breakdown and the expiry banner all render at the top. Without
    // this the only visible feedback is the submit bar disappearing, which reads
    // as "nothing happened". Matches what handleRestart already does.
    scrollToTop();
  }

  /**
   * Submitting ends the attempt irreversibly, so it asks first when there is
   * something to lose. With everything answered there is nothing to warn about,
   * and a confirmation would just be a click tax on the normal path.
   */
  function handleSubmit() {
    if (answeredCount < questions.length) {
      setPendingAction("submit");
      return;
    }
    closeOut(false);
  }

  /** Timer ran out on-screen. Same close-out as a manual submit, but flagged so the banner can explain it. */
  function handleExpire() {
    closeOut(true);
  }

  function handlePause() {
    setPaused(true);
    // Read through the updater, not the render closure, for the same reason
    // closeOut does: an answer click and a pause in the same frame would
    // otherwise write a one-render-stale answer map over the fresh one.
    const pausedAt = Date.now();
    setAnswers((prev) => {
      persist(prev, false, { pausedAt });
      return prev;
    });
  }

  function handleResume() {
    setPaused(false);
    // The Timer reports the pause-shifted deadline via onDeadlineChange, which
    // persists it and clears pausedAt.
  }

  function handleDeadlineChange(nextDeadline: number) {
    setDeadline(nextDeadline);
    // Same updater-read as handlePause/closeOut: this fires from the Timer's
    // resume effect, so the answer map it writes must be the committed one.
    setAnswers((prev) => {
      persist(prev, false, { deadline: nextDeadline });
      return prev;
    });
  }

  /** Wipes this section's saved attempt and starts over with a freshly drawn question set. */
  function handleRestart() {
    setPendingAction(null);
    clearSectionProgress(examId, section);
    const ids = drawRandomQuestionIds(examId, section, sectionConfig.questionCount);
    const endAt = Date.now() + sectionConfig.minutes * 60_000;
    setQuestionIds(ids);
    setAnswers({});
    setPhase("taking");
    setDeadline(endAt);
    setNotice(null);
    setPaused(false);
    setMobileNavOpen(false);
    saveStoredProgress(examId, section, {
      answers: {},
      submitted: false,
      questionIds: ids,
      deadline: endAt,
      expired: false,
      pausedAt: 0,
    });
    scrollToTop();
  }

  function handleJump(questionNumber: number) {
    document.getElementById(`question-${questionNumber}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileNavOpen(false);
  }

  const result = useMemo(() => {
    if (phase !== "review") return null;
    const answerList = questions.map((q) => ({
      questionId: q.id,
      selectedIndex: answers[q.id] ?? null,
    }));
    return scoreAttempt(questions, answerList, exam.pointsPerCorrectAnswer);
  }, [phase, questions, answers, exam.pointsPerCorrectAnswer]);

  if (!examIdValid || !sectionValid || !hydrated) return null;

  return (
    <div className="flex flex-1 justify-center bg-background">
      <div
        className="w-full max-w-6xl px-6 py-10 sm:py-16"
        inert={paused || mobileNavOpen || pendingAction !== null || undefined}
        aria-hidden={paused || mobileNavOpen || pendingAction !== null || undefined}
      >
        <div className="sticky top-0 z-20 flex h-20 items-center justify-between gap-3 border-b border-line bg-background/95 backdrop-blur">
          <div className="min-w-0">
            <Link href={`/${examId}`} className="text-sm text-muted hover:text-foreground">
              ← Exam setup
            </Link>
            <h1 className="mt-1 truncate text-lg font-semibold text-foreground sm:text-xl">
              {sectionConfig.label}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="flex h-11 items-center justify-center rounded-md border border-line-strong px-3 text-sm text-foreground hover:bg-panel-hover lg:hidden"
            >
              Sections
            </button>
            {phase === "taking" ? (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <Timer
                    endAt={deadline}
                    onExpire={handleExpire}
                    paused={paused}
                    onDeadlineChange={handleDeadlineChange}
                  />
                  <p className="mt-1 text-xs text-muted">
                    {answeredCount}/{questions.length} answered
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePause}
                  className="flex h-11 items-center justify-center rounded-md border border-line-strong px-3 text-sm text-foreground hover:bg-panel-hover"
                >
                  Pause
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPendingAction("restart")}
                  className="flex h-11 items-center justify-center rounded-md border border-line-strong px-3 text-sm text-foreground hover:bg-panel-hover"
                >
                  Retake
                </button>
                <Link
                  href={`/${examId}`}
                  className="flex h-11 items-center justify-center rounded-md border border-line-strong px-3 text-sm text-foreground hover:bg-panel-hover"
                >
                  Done
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex gap-8">
          <aside className="hidden w-56 shrink-0 flex-col gap-6 lg:flex">
            <div className="sticky top-24 flex flex-col gap-6">
              <SectionNav
                examId={examId}
                currentSection={section}
                currentAnsweredCount={answeredCount}
                locked={phase === "taking"}
                currentResult={result}
              />
              <ProgressTracker
                totalQuestions={questions.length}
                answeredNumbers={answeredNumbers}
                onJump={handleJump}
                reviewMode={phase === "review"}
                correctNumbers={correctNumbers}
                incorrectNumbers={incorrectNumbers}
              />
            </div>
          </aside>

          <main className="min-w-0 flex-1">
            {phase === "taking" && (
              // Sits here rather than in the header: the header is a fixed h-20
              // that the sidebar's top-24 alignment depends on, and a third line
              // with a 44px target would overflow it.
              //
              // Always reachable while a section is in progress, not only when a
              // resume banner happens to be showing. Note this REDRAWS the
              // section rather than letting you leave it: the way out of a
              // section opened by mistake is "← Exam setup", then Clear on that
              // section's row, which leaves the other sections alone.
              // Deliberately quiet, since it discards work.
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setPendingAction("restart")}
                  className="inline-flex min-h-11 items-center px-1 text-xs text-muted underline underline-offset-2 hover:text-foreground"
                >
                  Restart section
                </button>
              </div>
            )}

            {/* The live region is mounted unconditionally so that populating it
                later counts as a content change a screen reader will announce. */}
            <div role="status" aria-live="polite">
              {/* No action button in this banner: "Restart section" sits
                  directly above while taking, and "Retake" is in the header in
                  review, so repeating it made two controls for one action. */}
              {notice && (
                <div className="mb-4 rounded-lg border border-line bg-panel px-4 py-3">
                  <p className="text-sm font-medium text-foreground">{NOTICE_COPY[notice].title}</p>
                  <p className="mt-0.5 text-xs text-muted">{NOTICE_COPY[notice].detail}</p>
                </div>
              )}
            </div>

            {phase === "review" && result && (
              <div className="mb-4">
                <ResultSummary result={result} sectionLabel={sectionConfig.label} />
              </div>
            )}

            {questions.map((question, index) => (
              <QuestionCard
                key={question.id}
                question={question}
                index={index}
                selectedIndex={answers[question.id] ?? null}
                onSelect={(optionIndex) => handleSelect(question.id, optionIndex)}
                reviewMode={phase === "review"}
              />
            ))}

            {phase === "taking" && (
              <div className="sticky bottom-0 mt-6 border-t border-line bg-background py-4">
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="w-full rounded-md bg-accent py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90"
                >
                  Submit ({answeredCount}/{questions.length} answered)
                </button>
              </div>
            )}
          </main>
        </div>
      </div>

      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction === "submit" ? "Submit with questions unanswered?" : "Start this section over?"}
        body={
          pendingAction === "submit"
            ? `${questions.length - answeredCount} of ${questions.length} questions are still unanswered. Once you submit, you can review your answers but you can't change them.`
            : "This deletes your answers for this section and draws a new set of questions, with a fresh timer. It can't be undone."
        }
        confirmLabel={pendingAction === "submit" ? "Submit section" : "Start over"}
        cancelLabel={pendingAction === "submit" ? "Keep answering" : "Keep my answers"}
        onConfirm={pendingAction === "submit" ? () => { setPendingAction(null); closeOut(false); } : handleRestart}
        onCancel={() => setPendingAction(null)}
      />

      <PauseOverlay paused={paused} onResume={handleResume} />

      <MobileNavSheet open={mobileNavOpen} onClose={() => setMobileNavOpen(false)}>
        <div className="flex flex-col gap-6">
          <SectionNav
            examId={examId}
            currentSection={section}
            currentAnsweredCount={answeredCount}
            locked={phase === "taking"}
            currentResult={result}
          />
          <ProgressTracker
            totalQuestions={questions.length}
            answeredNumbers={answeredNumbers}
            onJump={handleJump}
            reviewMode={phase === "review"}
            correctNumbers={correctNumbers}
            incorrectNumbers={incorrectNumbers}
          />
        </div>
      </MobileNavSheet>
    </div>
  );
}
