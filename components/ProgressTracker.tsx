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
        {reviewMode ? "Results" : "Progress"} ({answeredNumbers.length}/{totalQuestions})
      </p>
      <div className="mt-3 grid grid-cols-6 gap-1.5">
        {Array.from({ length: totalQuestions }, (_, i) => i + 1).map((num) => {
          let style = "bg-panel-hover text-muted hover:bg-line";
          let state = "not answered";
          if (reviewMode) {
            if (correctSet.has(num)) {
              style = "bg-green-600 text-white dark:bg-green-500";
              state = "correct";
            } else if (incorrectSet.has(num)) {
              // Underlined as well as red: green and red fills alone would make
              // correctness a colour-only signal, which is the WCAG 1.4.1
              // failure already fixed for the answer options themselves.
              style = "bg-red-600 text-white underline decoration-2 underline-offset-2 dark:bg-red-500";
              state = "incorrect";
            } else {
              state = "skipped";
            }
          } else if (answeredSet.has(num)) {
            style = "bg-accent text-accent-foreground";
            state = "answered";
          }

          return (
            <button
              key={num}
              type="button"
              onClick={() => onJump(num)}
              aria-label={`Question ${num}, ${state}`}
              className={`flex h-7 w-7 items-center justify-center rounded text-[11px] font-medium transition-colors ${style}`}
            >
              {num}
            </button>
          );
        })}
      </div>

      {/* States named in text, so the grid is readable without relying on the
          fills at all. */}
      <p className="mt-2 text-xs text-muted">
        {reviewMode ? "Underlined numbers are incorrect answers." : "Filled squares are answered."}
      </p>
    </div>
  );
}
