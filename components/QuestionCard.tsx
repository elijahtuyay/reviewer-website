"use client";

import { memo, useRef } from "react";
import { Question } from "@/data/schema";
import MathText from "@/components/MathText";

/**
 * Reading-comprehension prompts embed their whole passage, because a random
 * 36-of-100 draw means a question can never point at a passage that lives on
 * another question. They are all shaped `Passage: "..." <the actual question>`.
 *
 * Rendered as one paragraph, the stem was welded to the end of ten lines of
 * quoted passage with no break, on the one question type where reading speed
 * is what is being tested.
 *
 * Splitting on the last quote does NOT work: "vocabulary in context" stems
 * quote the word being tested (`... retention." The word "isolated" in the
 * passage is closest in meaning to:`), so the last quote sits inside the stem
 * and the passage swallows most of the question. Splitting on the first quote
 * fails too, since passages contain quoted speech. The reliable boundary is
 * sentence-ending punctuation immediately before a closing quote, followed by
 * a capital letter: passages end on a full sentence, and the quoted fragments
 * inside a stem do not.
 *
 * Guarded rather than trusted: a stem that does not end in "?" or ":" means
 * the boundary was misidentified, and the prompt is then rendered whole. That
 * check passes for all 18 passage questions in the bank today, and a future
 * one that breaks the pattern degrades to the old single-paragraph rendering
 * instead of showing a mangled question.
 */
const PASSAGE_BOUNDARY = /[.!?]"\s+(?=[A-Z])/;

function splitPassage(prompt: string): { passage: string; stem: string } | null {
  if (!prompt.startsWith("Passage:")) return null;
  const body = prompt.slice("Passage:".length).trim().replace(/^"/, "");
  const match = PASSAGE_BOUNDARY.exec(body);
  if (!match) return null;

  const passage = body.slice(0, match.index + 1).trim();
  const stem = body.slice(match.index + match[0].length).trim();
  if (!passage || !stem) return null;
  if (!stem.endsWith("?") && !stem.endsWith(":")) return null;
  return { passage, stem };
}

interface QuestionCardProps {
  question: Question;
  index: number;
  selectedIndex: number | null;
  /**
   * Takes the question id as well as the option, so runners can pass the
   * attempt's `select` straight through. They used to wrap it in an inline
   * arrow to close over the id, which handed every card a brand-new prop on
   * every render and made the memo below useless.
   */
  onSelect?: (questionId: string, optionIndex: number) => void;
  reviewMode?: boolean;
  /**
   * Set while a capped review pass has run out of changes and this question is
   * still on its original answer. The options stay readable and focusable but
   * announce that they cannot be changed, rather than silently ignoring clicks:
   * a live-looking control that does nothing reads as a bug.
   */
  lockedReason?: string;
}

function QuestionCard({
  question,
  index,
  selectedIndex,
  onSelect,
  reviewMode = false,
  lockedReason,
}: QuestionCardProps) {
  const passageParts = splitPassage(question.prompt);
  const isAnswered = selectedIndex !== null;
  const isCorrect = selectedIndex === question.correctIndex;
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /**
   * Arrow-key navigation, per the WAI-ARIA radiogroup pattern: the group is a
   * single tab stop and arrows move between options. Without this the options
   * were 4 separate tab stops each, i.e. 144 stops to cross a 36-question
   * section.
   *
   * Deliberately the "selection does not follow focus" variant: arrows move
   * focus only, and Space/Enter selects (routed through onClick by the native
   * button). Selecting on arrow would mean a user arrowing down merely to READ
   * the options has silently answered the question, and nothing in this app can
   * un-answer one. It would also inflate answeredCount, which is what decides
   * whether submitting warns about unanswered questions.
   *
   * Active in review too: arrows still move focus there, they just cannot
   * select. Disabling them would leave a group that announces itself as a radio
   * group while the arrows do nothing.
   */
  function handleKeyDown(event: React.KeyboardEvent, optionIndex: number) {
    const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
    const count = question.options.length;
    const next = (optionIndex + (forward ? 1 : -1) + count) % count;
    const target = optionRefs.current[next];
    target?.focus();
    // focus() alone doesn't scroll an element the browser already considers
    // visible, so arrowing upward can land on an option sitting underneath the
    // h-20 sticky header, hiding both the option and its focus ring. Paired with
    // scroll-mt on the button, this brings it clear of the header, which is
    // two rows tall below `sm`.
    target?.scrollIntoView({ block: "nearest" });
  }

  // Roving tabindex: the selected option is the group's tab stop, or the first
  // option when nothing is selected yet. Clamped because a stored answer index
  // that no longer matches the options array would otherwise leave the group
  // with no tab stop at all, i.e. unreachable by keyboard.
  const tabStop = Math.min(Math.max(selectedIndex ?? 0, 0), question.options.length - 1);

  return (
    <div
      id={`question-${index + 1}`}
      className="scroll-mt-32 border-b border-line py-8 first:pt-0 last:border-b-0 sm:scroll-mt-20"
    >
      <div className="flex items-baseline gap-3">
        <span className="text-sm font-medium text-muted">{index + 1}</span>
        {passageParts ? (
          <div className="min-w-0 flex-1">
            <div className="rounded-md border-l-2 border-line-strong bg-panel py-3 pr-4 pl-4">
              <p className="text-xs font-medium tracking-wide text-muted uppercase">Passage</p>
              <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                <MathText text={passageParts.passage} />
              </p>
            </div>
            <p className="mt-4 leading-relaxed text-foreground">
              <MathText text={passageParts.stem} />
            </p>
          </div>
        ) : (
          <p className="leading-relaxed text-foreground">
            <MathText text={question.prompt} />
          </p>
        )}
      </div>

      {/* A short static name, NOT aria-labelledby the prompt: screen readers
          re-announce a group's name on entry and on every focus move inside it,
          and prompts here embed whole reading passages (the longest is ~1330
          characters), so labeling by the prompt would re-read a passage on
          every arrow key. */}
      <div
        className="mt-4 ml-7 flex flex-col gap-2"
        role="radiogroup"
        aria-label={`Answer options for question ${index + 1}`}
      >
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
              // border-green-700: -600 is 2.95 against --background, under the 3:1 that
              // WCAG 1.4.11 asks of a boundary identifying a control.
              style = "border-green-700 bg-green-50 dark:border-green-500 dark:bg-green-950/40";
              marker = "Correct answer";
            } else if (isSelected && !isCorrectOption) {
              style = "border-red-600 bg-red-50 dark:border-red-500 dark:bg-red-950/40";
              marker = "Your answer";
            }
          } else if (isSelected) {
            // ring-1 on top of the border, not a different color: raising the
            // neutral border to --line-strong made it out-contrast the accent in
            // dark mode (4.82:1 vs 3.11:1), so the unselected options outlined
            // more strongly than the chosen one. Doubling the selected border's
            // weight restores the hierarchy, works for any exam's accent, and
            // adds no layout shift because a ring doesn't affect layout.
            style = "border-accent ring-1 ring-accent bg-accent/10 dark:bg-accent/20";
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
              aria-disabled={reviewMode || Boolean(lockedReason) || undefined}
              tabIndex={optionIndex === tabStop ? 0 : -1}
              onClick={() => {
                if (reviewMode || lockedReason) return;
                onSelect?.(question.id, optionIndex);
              }}
              onKeyDown={(event) => handleKeyDown(event, optionIndex)}
              // min-h-11 is the 44px tap-target minimum, and it doubles as the
              // headroom stacked math (fractions, exponents) needs to sit in a
              // row without the box having to grow around it.
              // transition-[...box-shadow], not transition-colors: the selected
              // state's `ring-1` compiles to a box-shadow in Tailwind v4, which
              // transition-colors does not cover, so the ring snapped on while
              // the border underneath it faded. active:scale gives the press
              // the acknowledgement it had on no touch device, where :hover
              // does not exist at all.
              //
              // text-base, not text-sm: the options were 14px under a 16px
              // stem, i.e. the text a candidate re-reads three times before
              // committing was the smallest text on the card.
              className={`flex min-h-11 scroll-mt-40 items-center sm:scroll-mt-24 justify-between gap-3 rounded-md border px-4 py-2.5 text-left text-base leading-relaxed text-foreground transition-[color,background-color,border-color,box-shadow,transform] ${
                reviewMode || lockedReason ? "" : "active:scale-[0.99]"
              } ${style} ${reviewMode || lockedReason ? "cursor-default" : "cursor-pointer"} ${lockedReason ? "opacity-60" : ""}`}
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

      {lockedReason && !reviewMode && (
        <p className="mt-3 ml-7 text-xs text-muted">{lockedReason}</p>
      )}

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
            {isAnswered ? (isCorrect ? "Correct" : "Incorrect") : "No answer"}
          </p>
          <p className="mt-2 leading-relaxed text-foreground">
            <MathText text={question.explanation} />
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Memoized, and the props above are shaped to make that possible.
 *
 * A section renders up to 36 of these. Every answer click re-rendered all of
 * them — roughly 180 MathText renders and 144 option buttons rebuilt per click —
 * because two things handed each card a new prop every time: an inline
 * `onSelect` arrow in the runners, and `select` itself changing identity on
 * every answer (see the note on it in useAttempt). With both fixed, the
 * remaining props are the stable question object, primitives, and a stable
 * callback, so exactly one card re-renders per click.
 */
export default memo(QuestionCard);
