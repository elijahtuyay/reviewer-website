"use client";

import Link from "next/link";
import { useState } from "react";
import { ExamModule, SectionConfig } from "@/lib/exams/types";
import { Attempt } from "@/components/quiz/useAttempt";
import { isAnswered } from "@/lib/answers";
import {
  AttemptNotice,
  BackToSetup,
  CalculatorNotSimulatedNote,
  NoCalculatorNote,
} from "@/components/quiz/shared";
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
    paused, frozenTimeLabel, answeredCount, result, reviewChangesLeft, explanations, explanationsFailed,
    select, toggleOption, toggleFlag, advance, submit, restart, pause, resume, onDeadlineChange,
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
  // isAnswered, not a null check. Latent today because no sequential exam has a
  // multi or numeric question, and a live bug the moment one does.
  const currentAnswered = current && isAnswered(answers[current.id]);
  const servedCount = questions.length;
  const isLastServed = servedCount >= totalQuestions && cursor === servedCount - 1;

  const inert = paused || pendingAction !== null || undefined;

  return (
    <div className="flex flex-1 justify-center bg-background">
      <div className="w-full max-w-3xl px-6 py-10 sm:py-16" inert={inert} aria-hidden={inert}>
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
            {!reviewMode ? (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <Timer
                    endAt={deadline}
                    onExpire={() => submit(true)}
                    paused={paused}
                    onDeadlineChange={onDeadlineChange}
                  />
                  <p className="mt-1 text-xs tabular-nums text-muted">
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
            (section.calculator === "basic-di" || section.calculator === "gre-standard" ? (
              <CalculatorPanel
                open={calcVisible}
                onOpenChange={setCalcOpen}
                kind={section.calculator}
              />
            ) : section.calculator === "not-simulated" ? (
              <CalculatorNotSimulatedNote />
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
                  ? "Each question depends on your previous answers. You cannot return to a previous question."
                  : "You cannot return to a previous question."}
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
                value={answers[current.id] ?? null}
                explanation={explanations[current.id]}
                explanationFailed={explanationsFailed}
                onSelect={select}
                onToggle={toggleOption}
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
                //
                // An earlier revision said "This exam has no skip", which turns
                // a verb into a count noun on the one message a stuck reader is
                // looking at while the button under it refuses to work.
                <p className="mt-3 text-right text-xs text-muted">
                  Select an answer to continue. You cannot skip a question on this exam. A
                  considered guess is better than no answer.
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
                value={answers[question.id] ?? null}
                explanation={explanations[question.id]}
                explanationFailed={explanationsFailed}
                reviewMode
              />
            ))}
        </main>
      </div>

      <ConfirmDialog
        open={pendingAction !== null}
        title={
          pendingAction === "submit" ? "Submit this section?" : "Restart this section?"
        }
        body={
          pendingAction === "submit"
            ? `You answered ${answeredCount} of ${totalQuestions} questions${
                reviewChangesLeft !== null ? `, and you have ${reviewChangesLeft} change${reviewChangesLeft === 1 ? "" : "s"} left` : ""
              }. After you submit, you can read every explanation. You cannot change an answer.`
            : "This deletes your answers for this section. It starts a new adaptive attempt with a new timer. You cannot undo this."
        }
        confirmLabel={pendingAction === "submit" ? "Submit section" : "Restart section"}
        cancelLabel={pendingAction === "submit" ? "Return to the section" : "Keep my answers"}
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
  const { questions, answers, flagged, select, toggleOption, reviewChangesLeft, canChangeAnswer } =
    attempt;
  const limit = exam.rules.reviewEdit?.maxChanges ?? 0;
  const exhausted = reviewChangesLeft !== null && reviewChangesLeft <= 0;
  const flaggedQuestions = questions
    .map((q, i) => ({ q, number: i + 1 }))
    .filter(({ q }) => flagged.includes(q.id));

  return (
    <div>
      <div className="rounded-lg border border-accent bg-accent/10 px-4 py-3 dark:bg-accent/20">
        <p className="text-sm font-medium text-foreground">
          You reached the end, and time remains
        </p>
        <p className="mt-1 text-sm text-foreground/90">
          You can change up to {limit} answer{limit === 1 ? "" : "s"} before you submit.{" "}
          {exhausted
            ? "You used all of them. The rest stay locked until you undo one change."
            : `${reviewChangesLeft} left. You can restore your first answer at no cost.`}{" "}
          The timer continues.
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
                value={answers[question.id] ?? null}
                onSelect={select}
                onToggle={toggleOption}
                reviewMode={false}
                lockedReason={
                  locked
                    ? `You used all ${limit} changes. Undo one change to unlock this question.`
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
          className="min-h-11 w-full rounded-md bg-accent py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-90 active:scale-[0.99]"
        >
          Submit section
        </button>
      </div>
    </div>
  );
}
