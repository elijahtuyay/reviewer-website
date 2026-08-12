import { Question } from "@/data/schema";
import MathText from "@/components/MathText";

interface QuestionCardProps {
  question: Question;
  index: number;
  selectedIndex: number | null;
  onSelect?: (optionIndex: number) => void;
  reviewMode?: boolean;
}

export default function QuestionCard({
  question,
  index,
  selectedIndex,
  onSelect,
  reviewMode = false,
}: QuestionCardProps) {
  const isAnswered = selectedIndex !== null;
  const isCorrect = selectedIndex === question.correctIndex;

  return (
    <div
      id={`question-${index + 1}`}
      className="scroll-mt-20 border-b border-line py-8 first:pt-0 last:border-b-0"
    >
      <div className="flex items-baseline gap-3">
        <span className="text-sm font-medium text-muted">{index + 1}</span>
        <p className="text-foreground">
          <MathText text={question.prompt} />
        </p>
      </div>

      <div className="mt-4 ml-7 flex flex-col gap-2">
        {question.options.map((option, optionIndex) => {
          const isSelected = selectedIndex === optionIndex;
          const isCorrectOption = optionIndex === question.correctIndex;

          let style = "border-line hover:border-muted";
          if (reviewMode) {
            if (isCorrectOption) {
              style = "border-green-600 bg-green-50 dark:border-green-500 dark:bg-green-950/40";
            } else if (isSelected && !isCorrectOption) {
              style = "border-red-600 bg-red-50 dark:border-red-500 dark:bg-red-950/40";
            }
          } else if (isSelected) {
            style = "border-accent bg-accent/10 dark:bg-accent/20";
          }

          return (
            <button
              key={optionIndex}
              type="button"
              disabled={reviewMode}
              onClick={() => onSelect?.(optionIndex)}
              className={`rounded-md border px-4 py-2 text-left text-sm text-foreground transition-colors ${style} ${reviewMode ? "cursor-default" : "cursor-pointer"}`}
            >
              <MathText text={option} />
            </button>
          );
        })}
      </div>

      {reviewMode && (
        <div className="mt-4 ml-7 rounded-md bg-panel-hover p-4 text-sm">
          <p
            className={`font-medium ${
              isAnswered
                ? isCorrect
                  ? "text-green-700 dark:text-green-400"
                  : "text-red-700 dark:text-red-400"
                : "text-muted"
            }`}
          >
            {isAnswered ? (isCorrect ? "Correct" : "Incorrect") : "Not answered"}
          </p>
          <p className="mt-2 text-foreground">
            <MathText text={question.explanation} />
          </p>
        </div>
      )}
    </div>
  );
}
