"use client";

import { memo, useRef, useState } from "react";
import { Question } from "@/data/schema";
import MathText from "@/components/MathText";
import {
  AnswerValue,
  isAnswered as hasAnswer,
  isCorrectAnswer,
  kindOf,
  parseNumericAnswer,
} from "@/lib/answers";

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

/**
 * GRE Quantitative Comparison presents two quantities to be compared, and the
 * real exam labels and separates them rather than running them into the stem.
 *
 * The stored shape is optional common information, then a line each for
 * "Quantity A:" and "Quantity B:". Rendered as three plain sentences, the two
 * things the whole question is about looked like continuation prose, on the
 * largest single topic in the GRE quantitative bank.
 *
 * Guarded the same way `splitPassage` is: anything that does not match exactly
 * falls through to the ordinary rendering rather than producing a mangled card.
 * Both labels must be present, on their own lines, with the B line last.
 */
const QUANTITY_SHAPE = /^([\s\S]*?)Quantity A:\s*([\s\S]+?)\nQuantity B:\s*([\s\S]+)$/;

function splitQuantities(
  prompt: string
): { common: string; a: string; b: string } | null {
  const match = QUANTITY_SHAPE.exec(prompt);
  if (!match) return null;
  const [, common, a, b] = match;
  // A quantity that itself spans lines is not this shape.
  if (a.includes("\n") || b.includes("\n")) return null;
  if (!a.trim() || !b.trim()) return null;
  return { common: common.trim(), a: a.trim(), b: b.trim() };
}

interface QuestionCardProps {
  question: Question;
  index: number;
  /**
   * The explanation, in review mode only.
   *
   * A prop rather than a field on `question`, because explanations load as
   * their own chunk at submit time — they are up to 47% of a section's bank
   * and none of them can be read before then. Undefined while that chunk is
   * still arriving, which is why the block below renders a waiting line
   * rather than an empty space.
   */
  explanation?: string;
  /**
   * The candidate's answer: an option index, an array of them, or typed text.
   * See `lib/answers.ts` for why this is not a bare number any more.
   */
  value: AnswerValue | null;
  /**
   * Takes the question id as well as the answer, so runners can pass the
   * attempt's `select` straight through. They used to wrap it in an inline
   * arrow to close over the id, which handed every card a brand-new prop on
   * every render and made the memo below useless.
   */
  onSelect?: (questionId: string, value: AnswerValue) => void;
  /**
   * Multi-select only. Sends the INTENT (toggle this option) rather than a
   * computed array, so the new answer is derived from the freshest state.
   *
   * Two clicks inside one frame both read the same `value` prop, because React
   * has not re-rendered between them, so a computed array from the second click
   * overwrote the first. Measured in a real browser: two picks on a Sentence
   * Equivalence in one tick left exactly one selected.
   */
  onToggle?: (questionId: string, optionIndex: number, selectExactly: number | null) => void;
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
  value,
  onSelect,
  onToggle,
  explanation,
  reviewMode = false,
  lockedReason,
}: QuestionCardProps) {
  const passageParts = splitPassage(question.prompt);
  const quantities = passageParts ? null : splitQuantities(question.prompt);
  const kind = kindOf(question);
  const isAnswered = hasAnswer(value);
  const isCorrect = isCorrectAnswer(question, value);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /**
   * The option a third pick pushed out, announced rather than left to be
   * noticed.
   *
   * Once the cap is met, selecting another option replaces the OLDEST. That is
   * a deliberate choice (a dead click reads as a broken checkbox), but it
   * happened in total silence: no message, no live region, and if the dropped
   * option was above the scroll position the candidate never learned that one
   * of their two answers was gone.
   */
  const [replaced, setReplaced] = useState<string | null>(null);

  const options = question.options ?? [];
  /** Which option indices are currently chosen, whatever the question kind. */
  const chosen: number[] =
    kind === "multi"
      ? Array.isArray(value)
        ? value
        : []
      : typeof value === "number"
        ? [value]
        : [];
  const interactive = !reviewMode && !lockedReason;

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
    const count = options.length;
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

  /*
   * Roving tabindex: the selected option is the group's tab stop, or the first
   * option when nothing is selected yet. Clamped because a stored answer index
   * that no longer matches the options array would otherwise leave the group
   * with no tab stop at all, i.e. unreachable by keyboard.
   *
   * Only radiogroups rove. A checkbox group is a series of INDEPENDENT tab
   * stops per WAI-ARIA, because each box toggles on its own and a candidate has
   * to be able to reach the second of two picks without arrowing past the
   * first. Getting this backwards would make Sentence Equivalence unusable by
   * keyboard, which is the question type the multi path exists for.
   */
  const tabStop = Math.min(Math.max(chosen[0] ?? 0, 0), Math.max(0, options.length - 1));

  return (
    <div
      id={`question-${index + 1}`}
      className="scroll-mt-32 border-b border-line py-8 first:pt-0 last:border-b-0 sm:scroll-mt-20"
    >
      <div className="flex items-baseline gap-3">
        <span className="text-sm font-medium text-muted">{index + 1}</span>
        {passageParts ? (
          <div className="min-w-0 flex-1">
            <div className="measure rounded-md border-l-2 border-line-strong bg-panel py-3 pr-4 pl-4">
              <p className="label-caps text-muted">Passage</p>
              <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                <MathText text={passageParts.passage} />
              </p>
            </div>
            <p className="mt-4 leading-relaxed text-foreground">
              <MathText text={passageParts.stem} />
            </p>
          </div>
        ) : quantities ? (
          <div className="min-w-0 flex-1">
            {quantities.common && (
              <p className="leading-relaxed text-foreground">
                <MathText text={quantities.common} />
              </p>
            )}
            {/* Side by side once there is room, stacked on a phone. Equal
                widths, because the question is whether one is larger and a
                wider box would answer it for the candidate. */}
            <div className={`grid gap-3 sm:grid-cols-2 ${quantities.common ? "mt-4" : ""}`}>
              {([
                ["Quantity A", quantities.a],
                ["Quantity B", quantities.b],
              ] as const).map(([label, value]) => (
                <div key={label} className="rounded-md border border-line bg-panel px-4 py-3">
                  <p className="label-caps text-muted">{label}</p>
                  <p className="mt-1 leading-relaxed text-foreground">
                    <MathText text={value} />
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="leading-relaxed text-foreground">
            <MathText text={question.prompt} />
          </p>
        )}
      </div>

      {/*
        How many to pick AND what makes a pick correct, said before the options
        rather than discovered by being marked wrong.

        Two things were wrong here. The count alone omitted the rule that
        DEFINES Sentence Equivalence: the two words must leave the sentence
        meaning the same thing. Without it a candidate reasonably picks the two
        words that each fit the blank, which is a different and easier question.

        And the whole line was gated on a truthy `selectExactly`, so the open
        "select all that apply" variant, which sets it to null, displayed NO
        instruction at all. Its only cue was a clause at the end of a 130-word
        passage, in body type, above three options that look like any other.
      */}
      {kind === "multi" && (
        <p id={`${question.id}-multi-rule`} className="mt-4 ml-7 text-sm font-medium text-accent-text">
          {question.selectExactly === 2
            ? "Select the 2 answers that fit the sentence and give it the same meaning."
            : question.selectExactly
              ? `Select exactly ${question.selectExactly} answers.`
              : "Select every answer that applies. There may be one, two or three."}
        </p>
      )}

      {kind === "numeric" ? (
        <NumericEntry
          question={question}
          index={index}
          value={value}
          onSelect={onSelect}
          reviewMode={reviewMode}
          lockedReason={lockedReason}
        />
      ) : (
      /* A short static name, NOT aria-labelledby the prompt: screen readers
         re-announce a group's name on entry and on every focus move inside it,
         and prompts here embed whole reading passages (the longest is ~1330
         characters), so labeling by the prompt would re-read a passage on
         every arrow key. */
      <div
        className="mt-4 ml-7 flex flex-col gap-2"
        role={kind === "multi" ? "group" : "radiogroup"}
        aria-label={`Answer options for question ${index + 1}`}
        /*
         * The rule has to be ANNOUNCED, not merely adjacent.
         *
         * Tabbing from a radio in one question lands directly on the first
         * checkbox of the next, so a screen-reader user could enter a
         * select-two group without ever hearing that two answers are required.
         * Being the previous DOM sibling is not an association.
         */
        aria-describedby={kind === "multi" ? `${question.id}-multi-rule` : undefined}
      >
        {options.map((option, optionIndex) => {
          const isSelected = chosen.includes(optionIndex);
          const isCorrectOption =
            kind === "multi"
              ? (question.correctIndices ?? []).includes(optionIndex)
              : optionIndex === question.correctIndex;

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
              /*
               * On a select-two question the candidate needs to know WHICH of
               * their two picks was right, and which correct answer they missed.
               * A bare "Correct answer" on every keyed option made a pick you
               * got right look identical to one you never chose, on the one
               * question type where that is the whole result.
               */
              marker = isSelected
                ? "Correct answer, you selected this"
                : kind === "multi"
                  ? "Correct answer, you missed this"
                  : "Correct answer";
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

          /*
           * A SQUARE marker for a checkbox and a round one for a radio.
           *
           * Before this the two were styled identically, so `role="checkbox"`
           * told a screen reader that more than one answer was expected and
           * told a sighted candidate nothing at all. Every test delivery
           * platform, ETS included, uses this shape convention, and on a phone
           * the one instruction line scrolls away before the last option.
           *
           * Drawn with a border rather than an icon so it inherits the option's
           * own state colors and needs no extra contrast tuning.
           */
          const marker_shape = kind === "multi" ? "rounded-[3px]" : "rounded-full";
          /*
           * Filled means "you chose this", and NOTHING else.
           *
           * It used to also fill on any correct option in review, so on a
           * section with 26 unanswered questions every keyed option showed a
           * filled dot, which reads as "you picked this" and is false. The
           * multi markers disambiguate in text; a single-select radio does not.
           * Correctness is carried by the border and the label, which is where
           * it belongs.
           */
          const filled = isSelected;

          return (
            <button
              key={optionIndex}
              ref={(el) => {
                optionRefs.current[optionIndex] = el;
              }}
              type="button"
              role={kind === "multi" ? "checkbox" : "radio"}
              aria-checked={isSelected}
              // aria-disabled rather than `disabled` in review mode: a disabled
              // button is removed from the tab order, which would make the whole
              // review unreachable by keyboard. This keeps every option
              // focusable and announced while ignoring clicks.
              aria-disabled={reviewMode || Boolean(lockedReason) || undefined}
              // See the note on tabStop: checkboxes each keep their own stop.
              tabIndex={kind === "multi" || optionIndex === tabStop ? 0 : -1}
              onClick={() => {
                if (!interactive) return;
                if (kind === "multi") {
                  // Work out what is about to be pushed out BEFORE the toggle,
                  // because afterwards it is simply absent. chosen[0] is the
                  // oldest pick, which is the one toggleMultiAnswer drops.
                  const cap = question.selectExactly ?? null;
                  const evicts =
                    cap !== null && !isSelected && chosen.length >= cap ? options[chosen[0]] : null;
                  setReplaced(evicts);
                  onToggle?.(question.id, optionIndex, cap);
                } else {
                  onSelect?.(question.id, optionIndex);
                }
              }}
              onKeyDown={(event) => {
                // Arrows are the radiogroup pattern and do not belong in a
                // checkbox group, where Tab is the documented way between boxes.
                if (kind === "multi") return;
                handleKeyDown(event, optionIndex);
              }}
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
              /*
               * Stacked below `sm`, side by side above it.
               *
               * The review markers grew from "Correct answer" (~85px) to
               * "Correct answer, you selected this" (~185px) so the candidate
               * can tell which of two picks was right. That took ~100px out of
               * the text column at the one width that cannot spare it: at 390px
               * an unbreakable word painted straight through the marker, up to
               * 31px of overlap, rendering as "impenetreableanswer, you
               * selected this". `min-w-0` lets a flex child shrink below its
               * content, so nothing stopped it.
               */
              className={`flex min-h-11 scroll-mt-40 flex-col items-start gap-1 sm:scroll-mt-24 sm:flex-row sm:items-center sm:justify-between sm:gap-3 rounded-md border px-4 py-2.5 text-left text-base leading-relaxed text-foreground transition-[color,background-color,border-color,box-shadow,transform] ${
                reviewMode || lockedReason ? "" : "active:scale-[0.99]"
              } ${style} ${reviewMode || lockedReason ? "cursor-default" : "cursor-pointer"} ${lockedReason ? "opacity-60" : ""}`}
            >
              <span className="flex min-w-0 items-start gap-3 [overflow-wrap:anywhere]">
                <span
                  aria-hidden
                  className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center border ${marker_shape} ${
                    filled ? "border-current" : "border-muted"
                  }`}
                >
                  {filled && (
                    <span className={`h-2 w-2 bg-current ${marker_shape}`} />
                  )}
                </span>
                <span className="min-w-0">
                  <MathText text={option} />
                </span>
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
      )}

      {/* Polite, and mounted unconditionally so filling it later counts as the
          content change a screen reader announces. */}
      <div role="status" aria-live="polite" className="ml-7">
        {kind === "multi" && replaced && !reviewMode && (
          <p className="mt-2 text-xs text-muted">
            You already selected {question.selectExactly}, so {replaced} was removed.
          </p>
        )}
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
            {explanation ? (
              <MathText text={explanation} />
            ) : (
              // The chunk is in flight. Saying so beats a blank line that reads
              // as an explanation nobody wrote.
              <span className="text-muted">The explanation is loading.</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * GRE Numeric Entry: no options, you type the number.
 *
 * A text input rather than `type="number"`, deliberately. A number input hides
 * what was typed behind browser locale rules, silently discards a trailing
 * decimal point while someone is mid-entry, and answers a scroll wheel over a
 * focused field by changing the value, which on a timed exam is a way to lose
 * an answer you already gave. `inputMode="decimal"` still brings up the numeric
 * keypad on a phone, which is the only part of `type="number"` worth having.
 *
 * The raw text is stored, not a parsed number, so "0.50" stays "0.50" on the
 * review screen instead of being redisplayed as something the candidate did not
 * write. Marking parses it (see `parseNumericAnswer`), and tolerates commas,
 * currency signs and simple fractions, because being marked wrong over a comma
 * teaches nothing about mathematics.
 */
function NumericEntry({
  question,
  index,
  value,
  onSelect,
  reviewMode,
  lockedReason,
}: {
  question: Question;
  index: number;
  value: AnswerValue | null;
  onSelect?: (questionId: string, value: AnswerValue) => void;
  reviewMode: boolean;
  lockedReason?: string;
}) {
  const text = typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
  const entered = parseNumericAnswer(text);
  const correct = isCorrectAnswer(question, text);

  return (
    <div className="mt-4 ml-7">
      <label className="flex items-center gap-2">
        <span className="sr-only">
          Your answer for question {index + 1}
          {question.answerPrefix ? `, in ${question.answerPrefix}` : ""}
          {question.answerSuffix ? `, in ${question.answerSuffix}` : ""}
        </span>
        {question.answerPrefix && (
          <span aria-hidden className="text-base text-muted">
            {question.answerPrefix}
          </span>
        )}
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          readOnly={reviewMode || Boolean(lockedReason)}
          onChange={(event) => {
            if (reviewMode || lockedReason) return;
            onSelect?.(question.id, event.target.value);
          }}
          placeholder="Your answer"
          aria-describedby={`${question.id}-numeric-help`}
          // min-h-11 is the app's 44px tap-target floor, and w-40 is wide enough
          // for eight digits plus a decimal point, which is the most the real
          // exam's own calculator can produce.
          className={`min-h-11 w-40 rounded-md border px-3 text-base text-foreground transition-[color,background-color,border-color] placeholder:text-muted ${
            reviewMode
              ? correct
                ? "border-green-700 bg-green-50 dark:border-green-500 dark:bg-green-950/40"
                : "border-red-600 bg-red-50 dark:border-red-500 dark:bg-red-950/40"
              : "border-line-strong focus:border-accent"
          } ${lockedReason ? "opacity-60" : ""}`}
        />
        {question.answerSuffix && (
          <span aria-hidden className="text-base text-muted">
            {question.answerSuffix}
          </span>
        )}
      </label>

      {/*
        What the box will accept, said out loud.
        `parseNumericAnswer` is generous: it takes a fraction, and it strips
        commas, currency signs and a percent sign. None of that was discoverable,
        so a candidate with the right value sat deciding between "0.5" and "1/2".
      */}
      {!reviewMode && (
        <p id={`${question.id}-numeric-help`} className="mt-2 text-xs text-muted">
          Type a number. A fraction such as 3/4 is accepted.
          {entered === null && text.trim().length > 0 && (
            <span className="ml-1 text-foreground">That is not a number yet.</span>
          )}
        </p>
      )}

      {reviewMode && (
        <p className="mt-2 text-sm text-muted">
          Correct answer:{" "}
          <span className="font-medium text-foreground">
            {question.answerPrefix ?? ""}
            {question.correctValue}
            {question.answerSuffix ?? ""}
          </span>
          {entered !== null && !correct && <> &middot; you entered {text.trim()}</>}
        </p>
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
