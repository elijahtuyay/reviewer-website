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

  return (
    <div className="rounded-lg border border-line p-4">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">
        {/* In review this counter is answered-out-of-total, which sitting
            under the heading "Results" next to "0 correct" read as a score. */}
        {reviewMode
          ? `Results (${answeredNumbers.length}/${totalQuestions} answered)`
          : `Progress (${answeredNumbers.length}/${totalQuestions})`}
      </p>
      <div className="mt-3 grid grid-cols-6 gap-1.5">
        {Array.from({ length: totalQuestions }, (_, i) => i + 1).map((num) => {
          // Every branch sets its own font-weight. The base className must NOT
          // carry one: Tailwind orders font-weight utilities by stylesheet
          // position, not by class-attribute order, so a base `font-medium`
          // silently beat the `font-bold` these branches ask for.
          let style = "bg-panel-hover font-medium text-muted hover:bg-line";
          let state = "not answered";
          if (reviewMode) {
            // All three review states carry a non-color cue as well as a fill,
            // since green/red/gray alone would make correctness color-only:
            // the WCAG 1.4.1 failure already fixed for the answer options.
            // Bold = correct, underlined = incorrect, plain = skipped.
            if (correctSet.has(num)) {
              style = "bg-green-600 font-bold text-white dark:bg-green-500";
              state = "correct";
            } else if (incorrectSet.has(num)) {
              style =
                "bg-red-600 font-medium text-white underline decoration-2 underline-offset-2 dark:bg-red-500";
              state = "incorrect";
            } else {
              style = "bg-panel-hover font-normal text-muted hover:bg-line";
              state = "skipped";
            }
          } else if (answeredSet.has(num)) {
            style = "bg-accent font-medium text-accent-foreground";
            state = "answered";
          }

          return (
            <button
              key={num}
              type="button"
              onClick={() => onJump(num)}
              aria-label={`Question ${num}, ${state}`}
              className={`flex h-7 w-7 items-center justify-center rounded text-[11px] transition-colors ${style}`}
            >
              {num}
            </button>
          );
        })}
      </div>

      {/* States named in text, so the grid is readable without relying on the
          fills at all. */}
      <p className="mt-2 text-xs text-muted">
        {reviewMode
          ? // Color first, because color is what is actually perceptible at
            // this cell size: the bold/underline redundancy is real and is kept
            // for colorblind users, but leading with it described a signal
            // nobody can see on a 28px square.
            "Green is correct (bold), red is incorrect (underlined), gray was skipped."
          : // "Filled" was wrong: every cell has a fill, so the caption read as
            // "you have answered all of them". The distinction is the accent
            // highlight, and naming a color would be wrong per exam theme.
            "Highlighted squares are answered."}
      </p>
    </div>
  );
}
