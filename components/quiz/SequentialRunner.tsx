"use client";

import Link from "next/link";
import { useState } from "react";
import { ExamModule, SectionConfig } from "@/lib/exams/types";
import { Attempt } from "@/components/quiz/useAttempt";
import { AttemptNotice, BackToSetup, NoCalculatorNote } from "@/components/quiz/shared";
import CalculatorPanel from "@/components/quiz/CalculatorPanel";
import Timer from "@/components/Timer";
import QuestionCard from "@/components/QuestionCard";
import ResultSummary from "@/components/ResultSummary";
import PauseOverlay from "@/components/PauseOverlay";
import ConfirmDialog from "@/components/ConfirmDialog";

/**
 * One question at a time, no going back, difficulty following your streak.
 * Selected by `rules.navigation === "sequential"`, which is what a
 * computer-adaptive exam needs: every question is chosen from how the previous
 * ones went, so paging backwards would invalidate the ones already served.
 *
 * The distinctive part is the tail: reach the last question with time still on
 * the clock and you get a capped review pass, where a limited number of answers
 * can be changed. That is the one place this exam lets you look backwards, and
 * running out of time takes it away.
 */
export default function SequentialRunner({
  exam,
  section,
  attempt,
}: {
  exam: ExamModule;
  section: SectionConfig;
  attempt: Attempt;
}) {
  const [pendingAction, setPendingAction] = useState<"submit" | "restart" | null>(null);
  const [calcOpen, setCalcOpen] = useState(false);


  const {
    phase, notice, questions, answers, flagged, cursor, totalQuestions, deadline,
    paused, frozenTimeLabel, answeredCount, result, reviewChangesLeft,
    select, toggleFlag, advance, submit, restart, pause, resume, onDeadlineChange,
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
  const calcVisible = calcOpen && !paused && pendingAction === null;

  const reviewMode = phase === "done";
  const inReviewPass = phase === "reviewEdit";
  const current = questions[cursor];
  const currentAnswered =
    current && answers[current.id] !== null && answers[current.id] !== undefined;
  const servedCount = questions.length;
  const isLastServed = servedCount >= totalQuestions && cursor === servedCount - 1;

  const inert = paused || pendingAction !== null || undefined;

  return (
    <div className="flex flex-1 justify-center bg-background">
      <div className="w-full max-w-3xl px-6 py-10 sm:py-16" inert={inert} aria-hidden={inert}>
        <div className="sticky top-0 z-20 flex h-20 items-center justify-between gap-3 border-b border-line bg-background/95 backdrop-blur">
          <div className="min-w-0">
            <BackToSetup examId={exam.id} />
            <h1 className="mt-1 truncate text-lg font-semibold text-foreground sm:text-xl">
              {section.label}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
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
                    {inReviewPass
                      ? `${answeredCount}/${totalQuestions} answered`
                      : `Question ${Math.min(cursor + 1, totalQuestions)} of ${totalQuestions}`}
                    {flagged.length > 0 && (
                      // Without this you cannot tell whether you flagged one
                      // question or six, which makes the review pass a guess.
                      <span className="ml-2">
                        {flagged.length} flagged
                      </span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={pause}
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
                  href={`/${exam.id}`}
                  className="flex h-11 items-center justify-center rounded-md border border-line-strong px-3 text-sm text-foreground hover:bg-panel-hover"
                >
                  Back to sections
                </Link>
              </div>
            )}
          </div>
        </div>

        <main className="mt-6">
          <AttemptNotice notice={notice} />

          {/* Top left of the section, and inside the `inert` wrapper on purpose
              so pausing takes the calculator away with everything else. Still
              shown during the review pass: the clock is running and answers can
              still change there, so the tool the exam grants is still granted. */}
          {!reviewMode &&
            (section.calculator === "basic-di" ? (
              <CalculatorPanel open={calcVisible} onOpenChange={setCalcOpen} />
            ) : (
              <NoCalculatorNote exam={exam} />
            ))}

          {/* Progress is a bar, not a jump grid: on a sequential section the
              other questions are not reachable, so a grid of clickable cells
              would advertise navigation that does not exist. */}
          {!reviewMode && !inReviewPass && (
            <div className="mb-6">
              {/* scaleX on a full-width child, not an animated `width`.
                  Animating width runs layout and paint on every frame of every
                  advance; a transform is composited on its own layer and never
                  touches layout. transform-origin has to be pinned left or the
                  bar grows from its center. */}
              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-panel-hover"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={totalQuestions}
                aria-valuenow={Math.min(cursor, totalQuestions)}
                aria-label="Section progress"
              >
                <div
                  className="h-full origin-left rounded-full bg-accent transition-transform duration-300 ease-standard motion-reduce:transition-none"
                  style={{
                    transform: `scaleX(${Math.min(cursor, totalQuestions) / totalQuestions})`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-muted">
                {exam.rules.adaptive
                  ? "Each question is chosen from how the previous ones went, so you cannot go back."
                  : "You cannot return to a question once you move on."}
              </p>
            </div>
          )}

          {reviewMode && result && (
            <div className="mb-6">
              <ResultSummary result={result} sectionLabel={section.label} exam={exam} />
            </div>
          )}

          {/* Taking: exactly one question, with flag and next. */}
          {!reviewMode && !inReviewPass && current && (
            <>
              <QuestionCard
                key={current.id}
                question={current}
                index={cursor}
                selectedIndex={answers[current.id] ?? null}
                onSelect={select}
                reviewMode={false}
              />

              <div className="mt-6 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
                {exam.rules.reviewEdit?.allowFlagging ? (
                  <button
                    type="button"
                    onClick={() => toggleFlag(current.id)}
                    aria-pressed={flagged.includes(current.id)}
                    className={`flex min-h-11 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium transition-[color,background-color,border-color,transform] active:scale-[0.98] ${
                      flagged.includes(current.id)
                        ? "border-accent bg-accent/10 text-foreground dark:bg-accent/20"
                        : "border-line-strong text-muted hover:bg-panel-hover hover:text-foreground"
                    }`}
                  >
                    {flagged.includes(current.id) ? "Flagged for review" : "Flag for review"}
                  </button>
                ) : (
                  <span />
                )}

                <button
                  type="button"
                  onClick={advance}
                  disabled={!exam.rules.allowSkip && !currentAnswered}
                  className="flex min-h-11 items-center justify-center rounded-md bg-accent px-6 text-sm font-semibold text-accent-foreground transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
                >
                  {isLastServed ? "Finish section" : "Next question"}
                </button>
              </div>

              {!exam.rules.allowSkip && !currentAnswered && (
                // Said out loud rather than leaving a dead button: the real exam
                // refuses to advance too, and a disabled control with no
                // explanation reads as a bug.
                <p className="mt-3 text-right text-xs text-muted">
                  Choose an answer to continue. You cannot skip on this exam, so a considered guess
                  beats leaving it blank.
                </p>
              )}
            </>
          )}

          {/* Capped review pass: every served question, limited edits. */}
          {inReviewPass && (
            <ReviewPass
              exam={exam}
              attempt={attempt}
              onSubmit={() => setPendingAction("submit")}
            />
          )}

          {/* Submitted: the full scored review, all questions. */}
          {reviewMode &&
            questions.map((question, index) => (
              <QuestionCard
                key={question.id}
                question={question}
                index={index}
                selectedIndex={answers[question.id] ?? null}
                reviewMode
              />
            ))}
        </main>
      </div>

      <ConfirmDialog
        open={pendingAction !== null}
        title={
          pendingAction === "submit" ? "Submit this section?" : "Start this section over?"
        }
        body={
          pendingAction === "submit"
            ? `You have ${answeredCount} of ${totalQuestions} answered${
                reviewChangesLeft !== null ? ` and ${reviewChangesLeft} change${reviewChangesLeft === 1 ? "" : "s"} left` : ""
              }. Once you submit you can read every explanation, but you can't change anything.`
            : "This deletes your answers for this section and starts a new adaptive run, with a fresh timer. It can't be undone."
        }
        confirmLabel={pendingAction === "submit" ? "Submit section" : "Start over"}
        cancelLabel={pendingAction === "submit" ? "Keep reviewing" : "Keep my answers"}
        onConfirm={() => {
          const action = pendingAction;
          setPendingAction(null);
          if (action === "submit") submit(false);
          else restart();
          requestAnimationFrame(() => window.scrollTo({ top: 0 }));
        }}
        onCancel={() => setPendingAction(null)}
      />

      <PauseOverlay paused={paused} onResume={resume} frozenTimeLabel={frozenTimeLabel} />
    </div>
  );
}

/**
 * The review pass. Lists every question served, marks the flagged ones, and
 * spends the edit allowance only when an answer actually changes.
 */
function ReviewPass({
  exam,
  attempt,
  onSubmit,
}: {
  exam: ExamModule;
  attempt: Attempt;
  onSubmit: () => void;
}) {
  const { questions, answers, flagged, select, reviewChangesLeft, canChangeAnswer } = attempt;
  const limit = exam.rules.reviewEdit?.maxChanges ?? 0;
  const exhausted = reviewChangesLeft !== null && reviewChangesLeft <= 0;
  const flaggedQuestions = questions
    .map((q, i) => ({ q, number: i + 1 }))
    .filter(({ q }) => flagged.includes(q.id));

  return (
    <div>
      <div className="rounded-lg border border-accent bg-accent/10 px-4 py-3 dark:bg-accent/20">
        <p className="text-sm font-medium text-foreground">
          You reached the end with time to spare
        </p>
        <p className="mt-1 text-sm text-foreground/90">
          You can change up to {limit} answer{limit === 1 ? "" : "s"} before submitting.{" "}
          {exhausted
            ? "You have used them all, so the rest are locked until you undo one."
            : `${reviewChangesLeft} left. Changing an answer back to what it was costs nothing.`}{" "}
          The clock is still running.
        </p>
      </div>

      {/* The setup page promises the review pass starts with what you flagged.
          The questions stay in served order (renumbering them mid-attempt would
          be worse), so this is the part that makes the promise true. */}
      {flaggedQuestions.length > 0 && (
        <nav aria-label="Flagged questions" className="mt-6 rounded-lg border border-line bg-panel p-4">
          <p className="text-sm font-medium text-foreground">
            You flagged {flaggedQuestions.length} question{flaggedQuestions.length === 1 ? "" : "s"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {flaggedQuestions.map(({ q, number }) => (
              <a
                key={q.id}
                href={`#question-${number}`}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-line-strong px-3 text-sm font-medium text-foreground hover:bg-panel-hover"
              >
                {number}
              </a>
            ))}
          </div>
        </nav>
      )}

      <div className="mt-6 flex flex-col gap-8">
        {questions.map((question, index) => {
          const locked = !canChangeAnswer(question.id);
          return (
            <div key={question.id}>
              {flagged.includes(question.id) && (
                <p className="mb-2 text-xs font-medium text-accent-text">You flagged this one</p>
              )}
              <QuestionCard
                question={question}
                index={index}
                selectedIndex={answers[question.id] ?? null}
                onSelect={select}
                reviewMode={false}
                lockedReason={
                  locked
                    ? `You have used all ${limit} changes. Undo one of your changes to free this up.`
                    : undefined
                }
              />
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-0 mt-6 border-t border-line bg-background py-4">
        <button
          type="button"
          onClick={onSubmit}
          className="min-h-11 w-full rounded-md bg-accent py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-90 active:brightness-95"
        >
          Submit section
        </button>
      </div>
    </div>
  );
}
