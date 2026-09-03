"use client";

import { useRef, useState } from "react";

interface ProgressTrackerProps {
  totalQuestions: number;
  answeredNumbers: number[];
  onJump: (questionNumber: number) => void;
  /** True once the section has been submitted — switches cells from answered/unanswered to correct/incorrect/skipped. */
  reviewMode?: boolean;
  correctNumbers?: number[];
  incorrectNumbers?: number[];
}

export default function ProgressTracker({
  totalQuestions,
  answeredNumbers,
  onJump,
  reviewMode = false,
  correctNumbers = [],
  incorrectNumbers = [],
}: ProgressTrackerProps) {
  const answeredSet = new Set(answeredNumbers);
  const correctSet = new Set(correctNumbers);
  const incorrectSet = new Set(incorrectNumbers);

  /**
   * Roving tabindex: the grid is ONE tab stop, and arrow keys move within it.
   *
   * 36 individually tabbable cells put 36 stops between the top of the page and
   * the first answer option — measured at 46 Tab presses to reach question 1,
   * and the skip link only saved five of them because it targets the page
   * wrapper, which still contains this grid. On a timed section that is a real
   * cost, paid by exactly the users who can least afford it.
   *
   * This is the same pattern QuestionCard already uses for its options, and it
   * is what WAI-ARIA prescribes for a grid of related controls.
   */
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [tabStop, setTabStop] = useState(0);
  const COLUMNS = 6;

  function focusCell(index: number) {
    const clamped = Math.max(0, Math.min(totalQuestions - 1, index));
    setTabStop(clamped);
    cellRefs.current[clamped]?.focus();
  }

  function handleGridKeyDown(event: React.KeyboardEvent, index: number) {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      ArrowDown: index + COLUMNS,
      ArrowUp: index - COLUMNS,
      Home: 0,
      End: totalQuestions - 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    focusCell(next);
  }

  return (
    <div className="rounded-lg border border-line p-4">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">
        {/* In review this counter is answered-out-of-total, which sitting
            under the heading "Results" next to "0 correct" read as a score. */}
        {reviewMode
          ? `Results (${answeredNumbers.length}/${totalQuestions} answered)`
          : `Progress (${answeredNumbers.length}/${totalQuestions})`}
      </p>
      {/* 36px cells, up from 28px. Still under the app's 44px floor, but the
          grid is 36 cells in a sidebar and 44px each would not fit any column
          width the layout can give it; 36px clears WCAG 2.5.8 with room and is
          a real improvement for touch. The aside was widened to w-72 to suit:
          6 x 36px + 5 x 6px gaps = 246px inside a 254px content box. */}
      <div
        role="group"
        aria-label="Jump to a question"
        className="mt-3 grid grid-cols-6 gap-1.5"
      >
        {Array.from({ length: totalQuestions }, (_, i) => i + 1).map((num) => {
          // Every branch sets its own font-weight. The base className must NOT
          // carry one: Tailwind orders font-weight utilities by stylesheet
          // position, not by class-attribute order, so a base `font-medium`
          // silently beat the `font-bold` these branches ask for.
          // text-foreground/70 for the same reason as the skipped branch below:
    // text-muted on --panel-hover is 4.24:1 in dark mode, under AA at this size.
    let style = "bg-panel-hover font-medium text-foreground/70 hover:bg-line";
          let state = "not answered";
          if (reviewMode) {
            // All three review states carry a non-color cue as well as a fill,
            // since green/red/gray alone would make correctness color-only:
            // the WCAG 1.4.1 failure already fixed for the answer options.
            // Bold = correct, underlined = incorrect, plain = skipped.
            if (correctSet.has(num)) {
              // green-700/white measures 5.02 and green-400/green-950 8.55.
              // The old pair was 3.30 light and 2.28 dark — the worst contrast
              // in the app, on the screen a user stares at after finishing.
              style = "bg-green-700 font-bold text-white dark:bg-green-400 dark:text-green-950";
              state = "correct";
            } else if (incorrectSet.has(num)) {
              // 6.47 light / 5.84 dark, from 4.83 / 3.76. The dark background
              // has to move to red-400 as well: red-950 text on red-500 is
              // still only 4.29.
              style =
                "bg-red-700 font-medium text-white underline decoration-2 underline-offset-2 dark:bg-red-400 dark:text-red-950";
              state = "incorrect";
            } else {
              // text-foreground/70, not text-muted: muted on --panel-hover
              // measures 4.24:1 in dark mode at 12px. This is the one cell
              // state the contrast pass did not touch, because it is also the
              // only one that keeps the default surface.
              style = "bg-panel-hover font-normal text-foreground/70 hover:bg-line";
              state = "no answer";
            }
          } else if (answeredSet.has(num)) {
            style = "bg-accent font-medium text-accent-foreground";
            state = "answered";
          }

          return (
            <button
              key={num}
              ref={(el) => {
                cellRefs.current[num - 1] = el;
              }}
              type="button"
              onClick={() => onJump(num)}
              onKeyDown={(event) => handleGridKeyDown(event, num - 1)}
              tabIndex={num - 1 === tabStop ? 0 : -1}
              aria-label={`Question ${num}, ${state}`}
              className={`flex h-9 w-9 items-center justify-center rounded-md text-xs transition-colors ${style}`}
            >
              {num}
            </button>
          );
        })}
      </div>

      {/* States named in text, so the grid is readable without relying on the
          fills at all. */}
      <p className="mt-2 text-xs text-muted">
        <span className="sr-only">Use the arrow keys to move between questions. </span>
        {reviewMode
          ? // Color first, because color is what is actually perceptible at
            // this cell size: the bold/underline redundancy is real and is kept
            // for colorblind users, but leading with it described a signal
            // nobody can see at this cell size.
            "Green and bold means correct. Red and underlined means incorrect. Gray means no answer."
          : // "Filled" was wrong: every cell has a fill, so the caption read as
            // "you have answered all of them". The distinction is the accent
            // highlight, and naming a color would be wrong per exam theme.
            "A highlighted square has an answer."}
      </p>
    </div>
  );
}
