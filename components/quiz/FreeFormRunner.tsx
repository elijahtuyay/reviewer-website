"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ExamModule, SectionConfig } from "@/lib/exams/types";
import { Attempt } from "@/components/quiz/useAttempt";
import { AttemptNotice, BackToSetup, NoCalculatorNote } from "@/components/quiz/shared";
import { scrollBehavior } from "@/lib/motion";
import CalculatorPanel from "@/components/quiz/CalculatorPanel";
import Timer from "@/components/Timer";
import QuestionCard from "@/components/QuestionCard";
import ResultSummary from "@/components/ResultSummary";
import ProgressTracker from "@/components/ProgressTracker";
import SectionNav from "@/components/SectionNav";
import PauseOverlay from "@/components/PauseOverlay";
import ConfirmDialog from "@/components/ConfirmDialog";
import MobileNavSheet from "@/components/MobileNavSheet";

/**
 * The whole section on one scrolling page: answer in any order, skip, change
 * your mind, submit when you like. This is what a fixed-form paper exam feels
 * like, and it is what `rules.navigation === "free"` selects.
 *
 * All the attempt state, persistence, timing and scoring live in `useAttempt`.
 * This file is only the presentation of that state.
 */
export default function FreeFormRunner({
  exam,
  section,
  attempt,
}: {
  exam: ExamModule;
  section: SectionConfig;
  attempt: Attempt;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"submit" | "restart" | null>(null);
  const [calcOpen, setCalcOpen] = useState(false);

  const {
    phase, notice, questions, answers, deadline, paused, frozenTimeLabel,
    answeredCount, result, select, submit, restart, pause, resume, onDeadlineChange,
  } = attempt;

  /**
   * Whether the calculator is actually on screen. DERIVED rather than an effect
   * that closes it, which is both purer (no `set-state-in-effect`) and better
   * behaved: the panel comes back as you left it, memory included, instead of
   * silently closing itself while you were away.
   *
   * The condition deliberately MATCHES the `inert` condition below rather than
   * only tracking `paused`. The panel's Escape handler is on `document`, and
   * `inert` blocks pointer and focus but NOT a document-level keydown listener,
   * so with only `!paused` here a single Escape aimed at the confirmation
   * dialog dismissed the dialog and collapsed the calculator with it.
   */
  const calcVisible = calcOpen && !paused && !mobileNavOpen && pendingAction === null;

  const reviewMode = phase === "done";

  /**
   * One pass instead of three, memoized instead of rebuilt.
   *
   * These were six array allocations over 36 questions on every render, and
   * because they were fresh arrays each time they were also a hard blocker on
   * ever memoizing ProgressTracker, which receives them.
   */
  const { answeredNumbers, correctNumbers, incorrectNumbers } = useMemo(() => {
    const answered: number[] = [];
    const correct: number[] = [];
    const incorrect: number[] = [];
    questions.forEach((q, i) => {
      const answer = answers[q.id];
      if (answer === null || answer === undefined) return;
      answered.push(i + 1);
      if (answer === q.correctIndex) correct.push(i + 1);
      else incorrect.push(i + 1);
    });
    return { answeredNumbers: answered, correctNumbers: correct, incorrectNumbers: incorrect };
  }, [questions, answers]);

  /**
   * Deferring a frame lets the confirmation dialog's body scroll-lock unwind
   * first, so the scroll can't be swallowed by it.
   */
  function scrollToTop() {
    requestAnimationFrame(() => window.scrollTo({ top: 0 }));
  }

  /**
   * Two things had to change here, and both are the same mistake scrollToTop
   * above already documents.
   *
   * The scroll used to be issued BEFORE closing the sheet, so on a phone it ran
   * while `document.body` was still `overflow: hidden` from the sheet's scroll
   * lock and while the target's ancestor was still `inert`. The page simply did
   * not move, which reads as the jump grid being decorative. Closing first and
   * deferring a frame lets the lock unwind before the scroll is asked for.
   *
   * And the behavior is now chosen rather than hard-coded: a full-page smooth
   * scroll across 36 questions is the largest motion event in the app, and it
   * was the one thing `prefers-reduced-motion` could not switch off.
   */
  function handleJump(questionNumber: number) {
    setMobileNavOpen(false);
    requestAnimationFrame(() => {
      document
        .getElementById(`question-${questionNumber}`)
        ?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    });
  }

  /**
   * Submitting ends the attempt irreversibly, so it asks first when there is
   * something to lose. With everything answered there is nothing to warn about
   * and a confirmation would just be a click tax on the normal path.
   */
  function handleSubmit() {
    if (answeredCount < questions.length) {
      setPendingAction("submit");
      return;
    }
    submit(false);
    scrollToTop();
  }

  const inert = paused || mobileNavOpen || pendingAction !== null || undefined;

  return (
    <div className="flex flex-1 justify-center bg-background">
      <div className="w-full max-w-6xl px-6 py-10 sm:py-16" inert={inert} aria-hidden={inert}>
        <div className="sticky top-0 z-20 flex h-20 items-center justify-between gap-3 border-b border-line bg-background/95 backdrop-blur">
          <div className="min-w-0">
            <BackToSetup examId={exam.id} />
            <h1 className="mt-1 truncate text-lg font-semibold text-foreground sm:text-xl">
              {section.label}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="flex h-11 items-center justify-center rounded-md border border-line-strong px-3 text-sm text-foreground transition-colors hover:bg-panel-hover active:bg-line lg:hidden"
            >
              Sections
            </button>
            {!reviewMode ? (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <Timer
                    endAt={deadline}
                    onExpire={() => submit(true)}
                    paused={paused}
                    onDeadlineChange={onDeadlineChange}
                  />
                  <p className="mt-1 text-xs text-muted">
                    {answeredCount}/{questions.length} answered
                  </p>
                </div>
                <button
                  type="button"
                  onClick={pause}
                  className="flex h-11 items-center justify-center rounded-md border border-line-strong px-3 text-sm text-foreground transition-colors hover:bg-panel-hover active:bg-line"
                >
                  Pause
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPendingAction("restart")}
                  className="flex h-11 items-center justify-center rounded-md border border-line-strong px-3 text-sm text-foreground transition-colors hover:bg-panel-hover active:bg-line"
                >
                  Retake
                </button>
                <Link
                  href={`/${exam.id}`}
                  className="flex h-11 items-center justify-center rounded-md border border-line-strong px-3 text-sm text-foreground transition-colors hover:bg-panel-hover active:bg-line"
                >
                  Back to sections
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex gap-8">
          <aside className="hidden w-72 shrink-0 flex-col gap-6 lg:flex">
            <div className="sticky top-24 flex flex-col gap-6">
              <SectionNav
                examId={exam.id}
                currentSection={section.id}
                currentAnsweredCount={answeredCount}
                locked={!reviewMode}
                currentResult={result}
              />
              <ProgressTracker
                totalQuestions={questions.length}
                answeredNumbers={answeredNumbers}
                onJump={handleJump}
                reviewMode={reviewMode}
                correctNumbers={correctNumbers}
                incorrectNumbers={incorrectNumbers}
              />
            </div>
          </aside>

          <main className="min-w-0 flex-1">
            {!reviewMode && (
              // Sits here rather than in the header: the header is a fixed h-20
              // that the sidebar's top-24 alignment depends on. Deliberately
              // quiet, since it discards work.
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setPendingAction("restart")}
                  className="inline-flex min-h-11 items-center px-1 text-xs text-muted underline underline-offset-2 transition-colors hover:text-foreground"
                >
                  Restart section
                </button>
              </div>
            )}

            <AttemptNotice notice={notice} />

            {/* No free-form section grants a calculator today, so this renders
                the "none here" note for all six. It is wired anyway so a future
                free-form exam that does grant one needs no special case, which
                is the whole point of declaring it on SectionConfig. */}
            {!reviewMode &&
              (section.calculator === "basic-di" ? (
                <CalculatorPanel open={calcVisible} onOpenChange={setCalcOpen} />
              ) : (
                <NoCalculatorNote exam={exam} />
              ))}

            {reviewMode && result && (
              <div className="mb-4">
                <ResultSummary result={result} sectionLabel={section.label} exam={exam} />
              </div>
            )}

            {questions.map((question, index) => (
              <QuestionCard
                key={question.id}
                question={question}
                index={index}
                selectedIndex={answers[question.id] ?? null}
                onSelect={select}
                reviewMode={reviewMode}
              />
            ))}

            {!reviewMode && (
              <div className="sticky bottom-0 mt-6 border-t border-line bg-background py-4">
                <button
                  type="button"
                  onClick={handleSubmit}
                  // min-h-11 is the app's 44px tap-target floor. py-2.5 alone
                  // made this 40px — on the single most consequential control
                  // in the app.
                  className="min-h-11 w-full rounded-md bg-accent py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-90 active:brightness-95"
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
        title={
          pendingAction === "submit" ? "Submit with questions unanswered?" : "Start this section over?"
        }
        body={
          pendingAction === "submit"
            ? `${questions.length - answeredCount} of ${questions.length} questions are still unanswered. Once you submit, you can review your answers but you can't change them.`
            : "This deletes your answers for this section and draws a new set of questions, with a fresh timer. It can't be undone."
        }
        confirmLabel={pendingAction === "submit" ? "Submit section" : "Start over"}
        cancelLabel={pendingAction === "submit" ? "Keep answering" : "Keep my answers"}
        onConfirm={() => {
          const action = pendingAction;
          setPendingAction(null);
          if (action === "submit") submit(false);
          else restart();
          scrollToTop();
        }}
        onCancel={() => setPendingAction(null)}
      />

      <PauseOverlay paused={paused} onResume={resume} frozenTimeLabel={frozenTimeLabel} />

      <MobileNavSheet open={mobileNavOpen} onClose={() => setMobileNavOpen(false)}>
        <div className="flex flex-col gap-6">
          <SectionNav
            examId={exam.id}
            currentSection={section.id}
            currentAnsweredCount={answeredCount}
            locked={!reviewMode}
            currentResult={result}
          />
          <ProgressTracker
            totalQuestions={questions.length}
            answeredNumbers={answeredNumbers}
            onJump={handleJump}
            reviewMode={reviewMode}
            correctNumbers={correctNumbers}
            incorrectNumbers={incorrectNumbers}
          />
        </div>
      </MobileNavSheet>
    </div>
  );
}
