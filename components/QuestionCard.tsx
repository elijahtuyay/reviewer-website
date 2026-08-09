import { Question } from "@/data/schema";

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
    <div className="border-b border-neutral-200 py-8 first:pt-0 last:border-b-0">
      <div className="flex items-baseline gap-3">
        <span className="text-sm font-medium text-neutral-400">{index + 1}</span>
        <p className="whitespace-pre-line text-neutral-900">{question.prompt}</p>
      </div>

      <div className="mt-4 ml-7 flex flex-col gap-2">
        {question.options.map((option, optionIndex) => {
          const isSelected = selectedIndex === optionIndex;
          const isCorrectOption = optionIndex === question.correctIndex;

          let style = "border-neutral-200 hover:border-neutral-400";
          if (reviewMode) {
            if (isCorrectOption) {
              style = "border-green-600 bg-green-50";
            } else if (isSelected && !isCorrectOption) {
              style = "border-red-600 bg-red-50";
            }
          } else if (isSelected) {
            style = "border-neutral-900 bg-neutral-50";
          }

          return (
            <button
              key={optionIndex}
              type="button"
              disabled={reviewMode}
              onClick={() => onSelect?.(optionIndex)}
              className={`rounded-md border px-4 py-2 text-left text-sm text-neutral-800 transition-colors ${style} ${reviewMode ? "cursor-default" : "cursor-pointer"}`}
            >
              {option}
            </button>
          );
        })}
      </div>

      {reviewMode && (
        <div className="mt-4 ml-7 rounded-md bg-neutral-50 p-4 text-sm">
          <p className={`font-medium ${isAnswered ? (isCorrect ? "text-green-700" : "text-red-700") : "text-neutral-500"}`}>
            {isAnswered ? (isCorrect ? "Correct" : "Incorrect") : "Not answered"}
          </p>
          <p className="mt-2 text-neutral-700">{question.explanation}</p>
        </div>
      )}
    </div>
  );
}
