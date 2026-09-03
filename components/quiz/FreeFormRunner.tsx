"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ExamModule, SectionConfig } from "@/lib/exams/types";
import { Attempt } from "@/components/quiz/useAttempt";
import { isAnswered, isCorrectAnswer } from "@/lib/answers";
import {
  AttemptNotice,
  BackToSetup,
  CalculatorNotSimulatedNote,
  NoCalculatorNote,
} from "@/components/quiz/shared";
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
    answeredCount, result, select, toggleOption, submit, restart, pause, resume, onDeadlineChange,
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
      /*
       * isAnswered / isCorrectAnswer, never `=== q.correctIndex`.
       *
       * This is the runner `navigation: "free"` selects, which is the GRE's,
       * and the GRE is the exam whose answers are not option indices. A
       * multi-select answer is an array and a numeric one is typed text, so
       * neither can ever equal `correctIndex` (which is `undefined` for them
       * anyway). Every one of them was pushed to `incorrectNumbers` and painted
       * RED in the progress grid, beside a card that correctly said "Correct"
       * and a score that had counted it right.
       *
       * The null check had the matching flaw: an empty numeric string and an
       * empty selection array are both non-null, so a touched-then-emptied
       * answer counted as answered here while `useAttempt` said otherwise.
       */
      if (!isAnswered(answer)) return;
      answered.push(i + 1);
      if (isCorrectAnswer(q, answer)) correct.push(i + 1);
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
        {/*
          Below `sm` the title takes its OWN ROW and the controls wrap beneath
          it. Shrinking the type and shortening the buttons was not enough and
          could not have been: on a 320px screen the clock, Pause and the
          Sections button need most of the row, so any title long enough to
          matter ("Quantitative Skills" is 141px) has nowhere to go and the h1 of
          the page you are on renders as "Quant...". Two rows is the honest
          answer at that width.

          The fixed h-20 is kept from `sm` up, because the sidebar's `top-24`
          alignment is computed from it -- but the sidebar only exists at `lg`,
          so nothing depends on the height below that.
        */}
        <div className="sticky top-0 z-20 flex min-h-20 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line bg-background/95 py-2 backdrop-blur sm:h-20 sm:flex-nowrap sm:py-0">
          <div className="min-w-0 basis-full sm:basis-auto">
            <BackToSetup examId={exam.id} />
            {/* text-base below `sm`. The header is a fixed h-20 row shared with
                the clock and up to two buttons, and at 18px the longest section
                name ("Quantitative Skills", 158px) could not fit the space left
                over at 320-390px -- it rendered as "Quant...", the h1 of the
                page you are on. Shrinking the type and shortening the review
                buttons below `sm` buys back more than the 5px it was missing
                by. `truncate` stays as a backstop, not as the mechanism. */}
              <h1 className="mt-1 truncate text-base font-semibold text-foreground sm:text-lg md:text-xl">
              {section.label}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              // Icon-only below `sm`. The right-hand cluster is shrink-0 and ate
              // ~300px of a 390px header, which collapsed the min-w-0 title
              // column and truncated the h1 of the page you are on to
              // "Langua...". This is a regression of a bug PROJECT_CONTEXT
              // already recorded as fixed, so it is worth being blunt about the
              // cause: anything added to this cluster comes straight out of the
              // section title's width.
              className="flex h-11 min-w-11 items-center justify-center rounded-md border border-line-strong text-sm text-foreground transition-colors hover:bg-panel-hover active:bg-line sm:px-3 lg:hidden"
            >
              <svg
                aria-hidden
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4 sm:hidden"
              >
                <path d="M3 5h14v2H3V5zm0 4h14v2H3V9zm0 4h14v2H3v-2z" />
              </svg>
              <span className="hidden sm:inline">Sections</span>
              <span className="sr-only sm:hidden">Sections and progress</span>
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
                  {/* Hidden on phones: it is duplicated inside the mobile
                      sheet, and the header has no width to spare there. */}
                  <p className="mt-1 hidden text-xs text-foreground/70 sm:block">
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
                  {/* The review-mode cluster is the widest of the three states
                      and never got the responsive treatment the Sections button
                      got, which is why the title clipped hardest here. */}
                  <span className="sm:hidden">Sections</span>
                  <span className="hidden sm:inline">Back to sections</span>
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
              ) : section.calculator === "not-simulated" ? (
                <CalculatorNotSimulatedNote />
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
                value={answers[question.id] ?? null}
                onSelect={select}
                onToggle={toggleOption}
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
                  className="min-h-11 w-full rounded-md bg-accent py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-90 active:scale-[0.99]"
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
          pendingAction === "submit" ? "Submit this section?" : "Restart this section?"
        }
        body={
          pendingAction === "submit"
            ? `${questions.length - answeredCount} of ${questions.length} questions have no answer. After you submit, you can read every explanation. You cannot change an answer.`
            : "This deletes your answers for this section. It draws a new set of questions and starts a new timer. You cannot undo this."
        }
        confirmLabel={pendingAction === "submit" ? "Submit section" : "Restart section"}
        cancelLabel={pendingAction === "submit" ? "Return to the section" : "Keep my answers"}
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
