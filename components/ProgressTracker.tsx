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
          if (reviewMode) {
            if (correctSet.has(num)) {
              style = "bg-green-600 text-white dark:bg-green-500";
            } else if (incorrectSet.has(num)) {
              style = "bg-red-600 text-white dark:bg-red-500";
            }
          } else if (answeredSet.has(num)) {
            style = "bg-accent text-accent-foreground";
          }

          return (
            <button
              key={num}
              type="button"
              onClick={() => onJump(num)}
              className={`flex h-7 w-7 items-center justify-center rounded text-[11px] font-medium transition-colors ${style}`}
            >
              {num}
            </button>
          );
        })}
      </div>
    </div>
  );
}
