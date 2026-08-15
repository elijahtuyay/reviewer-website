"use client";

import { useId, useRef } from "react";
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
  const promptId = useId();
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /**
   * Arrow-key navigation, per the WAI-ARIA radiogroup pattern: the group is a
   * single tab stop and arrows move between options, selecting as they go.
   * Without this the options were 4 separate tab stops each, i.e. 144 stops to
   * cross a 36-question section.
   */
  function handleKeyDown(event: React.KeyboardEvent, optionIndex: number) {
    const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"];
    if (reviewMode || !keys.includes(event.key)) return;
    event.preventDefault();
    const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
    const count = question.options.length;
    const next = (optionIndex + (forward ? 1 : -1) + count) % count;
    optionRefs.current[next]?.focus();
    onSelect?.(next);
  }

  // Roving tabindex: the selected option is the group's tab stop, or the first
  // option when nothing is selected yet.
  const tabStop = selectedIndex ?? 0;

  return (
    <div
      id={`question-${index + 1}`}
      className="scroll-mt-20 border-b border-line py-8 first:pt-0 last:border-b-0"
    >
      <div className="flex items-baseline gap-3">
        <span className="text-sm font-medium text-muted">{index + 1}</span>
        <p id={promptId} className="leading-relaxed text-foreground">
          <MathText text={question.prompt} />
        </p>
      </div>

      <div className="mt-4 ml-7 flex flex-col gap-2" role="radiogroup" aria-labelledby={promptId}>
        {question.options.map((option, optionIndex) => {
          const isSelected = selectedIndex === optionIndex;
          const isCorrectOption = optionIndex === question.correctIndex;

          // border-line-strong, not border-line: an unselected option's border is
          // the only thing identifying it as a control, so it needs the 3:1
          // boundary contrast --line doesn't meet.
          let style = "border-line-strong hover:border-muted";
          let marker: string | null = null;
          if (reviewMode) {
            if (isCorrectOption) {
              style = "border-green-600 bg-green-50 dark:border-green-500 dark:bg-green-950/40";
              marker = "Correct answer";
            } else if (isSelected && !isCorrectOption) {
              style = "border-red-600 bg-red-50 dark:border-red-500 dark:bg-red-950/40";
              marker = "Your answer";
            }
          } else if (isSelected) {
            style = "border-accent bg-accent/10 dark:bg-accent/20";
          }

          return (
            <button
              key={optionIndex}
              ref={(el) => {
                optionRefs.current[optionIndex] = el;
              }}
              type="button"
              role="radio"
              aria-checked={isSelected}
              // aria-disabled rather than `disabled` in review mode: a disabled
              // button is removed from the tab order, which would make the whole
              // review unreachable by keyboard. This keeps every option
              // focusable and announced while ignoring clicks.
              aria-disabled={reviewMode || undefined}
              tabIndex={reviewMode ? 0 : optionIndex === tabStop ? 0 : -1}
              onClick={() => {
                if (reviewMode) return;
                onSelect?.(optionIndex);
              }}
              onKeyDown={(event) => handleKeyDown(event, optionIndex)}
              // min-h-11 is the 44px tap-target minimum, and it doubles as the
              // headroom stacked math (fractions, exponents) needs to sit in a
              // row without the box having to grow around it.
              className={`flex min-h-11 items-center justify-between gap-3 rounded-md border px-4 py-2.5 text-left text-sm leading-relaxed text-foreground transition-colors ${style} ${reviewMode ? "cursor-default" : "cursor-pointer"}`}
            >
              <span>
                <MathText text={option} />
              </span>
              {marker && (
                <span
                  className={`shrink-0 text-xs font-medium ${
                    isCorrectOption ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
                  }`}
                >
                  {marker}
                </span>
              )}
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
          <p className="mt-2 leading-relaxed text-foreground">
            <MathText text={question.explanation} />
          </p>
        </div>
      )}
    </div>
  );
}
