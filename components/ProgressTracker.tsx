interface ProgressTrackerProps {
  totalQuestions: number;
  answeredNumbers: number[];
  onJump: (questionNumber: number) => void;
}

export default function ProgressTracker({ totalQuestions, answeredNumbers, onJump }: ProgressTrackerProps) {
  const answeredSet = new Set(answeredNumbers);

  return (
    <div className="rounded-lg border border-line p-4">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">
        Progress ({answeredNumbers.length}/{totalQuestions})
      </p>
      <div className="mt-3 grid grid-cols-6 gap-1.5">
        {Array.from({ length: totalQuestions }, (_, i) => i + 1).map((num) => {
          const isAnswered = answeredSet.has(num);
          return (
            <button
              key={num}
              type="button"
              onClick={() => onJump(num)}
              className={`flex h-7 w-7 items-center justify-center rounded text-[11px] font-medium transition-colors ${
                isAnswered
                  ? "bg-accent text-accent-foreground"
                  : "bg-panel-hover text-muted hover:bg-line"
              }`}
            >
              {num}
            </button>
          );
        })}
      </div>
    </div>
  );
}
