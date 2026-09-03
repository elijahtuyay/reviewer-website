import type { Question } from "@/data/schema";

/**
 * WHAT A CANDIDATE'S ANSWER IS, now that not every question is "pick one of
 * four".
 *
 * Until the GRE arrived, an answer was an option index and nothing else, and
 * `Record<string, number>` was written into sessionStorage, compared with
 * `!==`, and read straight into the scorer. The GRE breaks that in two places
 * that are not optional extras but whole question types:
 *
 *  - **Sentence Equivalence** gives six options and requires EXACTLY TWO. It is
 *    roughly a sixth of the Verbal measure. Rendering it as a single-select
 *    would not be a simplification, it would be a different question with a
 *    different answer.
 *  - **Numeric Entry** has no options at all. You type the number.
 *
 * So an answer is now one of three shapes, and every comparison goes through
 * this file rather than through `===` at a call site. That matters more than it
 * looks: `answers[id] !== original` is correct for a number and silently WRONG
 * for an array, because two arrays with the same contents are never `===`. The
 * review-allowance check and the adaptive ladder both used that comparison, so
 * a multi-select question would have burned a review change on every render and
 * been scored as "changed" when nothing had changed.
 *
 * `number` stays the representation for single-choice, so every one of the 390
 * questions already in the bank, and every attempt already in a user's
 * sessionStorage, keeps working with no migration.
 */
export type AnswerValue = number | number[] | string;

/** A stored answer map, as it lives in sessionStorage. */
export type AnswerMap = Record<string, AnswerValue>;

/** The three shapes a question can take. Absent means "single", so existing bank files need no edit. */
export type QuestionKind = "single" | "multi" | "numeric";

export function kindOf(question: Question): QuestionKind {
  return question.kind ?? "single";
}

/**
 * Has the candidate put anything here at all?
 *
 * Deliberately NOT the same question as "is this answer complete" — see
 * `isComplete`. A half-finished Sentence Equivalence (one of the two picked) is
 * answered enough to be worth saving and worth showing as touched, but it is
 * not a submittable answer.
 */
export function isAnswered(value: AnswerValue | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

/**
 * Is this a usable answer for this question?
 *
 * Only differs from `isAnswered` for a multi-select with a required count, and
 * that is exactly where the difference matters: on an exam that refuses to
 * advance without an answer, "I clicked one of the two" must not count.
 */
export function isComplete(question: Question, value: AnswerValue | null | undefined): boolean {
  if (!isAnswered(value)) return false;
  if (kindOf(question) === "multi" && question.selectExactly) {
    return Array.isArray(value) && value.length === question.selectExactly;
  }
  if (kindOf(question) === "numeric") {
    return parseNumericAnswer(value) !== null;
  }
  return true;
}

/**
 * Numeric entry, parsed leniently on purpose.
 *
 * A candidate typing a value under time pressure writes "1,250", "$3.50",
 * " 0.75 " and "3/4", and none of those should be marked wrong for a reason
 * that has nothing to do with the mathematics. Commas, currency signs and
 * surrounding space are stripped, and a simple fraction is evaluated, because
 * GRE Numeric Entry genuinely does ask for fractions.
 *
 * Returns null when the text is not a number, which is what makes an empty or
 * junk entry count as unanswered rather than as wrong.
 */
export function parseNumericAnswer(value: AnswerValue | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const cleaned = value.replace(/[\s,₱$%]/g, "");
  if (cleaned.length === 0) return null;

  const fraction = cleaned.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    if (denominator === 0) return null;
    const result = Number(fraction[1]) / denominator;
    return Number.isFinite(result) ? result : null;
  }

  if (!/^-?\d*\.?\d+$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Is this answer correct?
 *
 * The single place that knows how each question kind is marked. The scorer, the
 * review screen and the adaptive ladder all call it, which is what stops the
 * three of them from drifting apart on a new question kind.
 */
export function isCorrectAnswer(question: Question, value: AnswerValue | null | undefined): boolean {
  if (!isComplete(question, value)) return false;

  switch (kindOf(question)) {
    case "multi": {
      if (!Array.isArray(value)) return false;
      const expected = question.correctIndices ?? [];
      if (value.length !== expected.length) return false;
      const chosen = new Set(value);
      return expected.every((index) => chosen.has(index));
    }
    case "numeric": {
      const entered = parseNumericAnswer(value);
      if (entered === null || question.correctValue === undefined) return false;
      // A tolerance rather than an equality test, because "0.33" and "1/3" are
      // the same answer to a candidate and are not the same float.
      const tolerance = question.tolerance ?? 1e-9;
      return Math.abs(entered - question.correctValue) <= tolerance;
    }
    default:
      return value === question.correctIndex;
  }
}

/**
 * Are these the same answer?
 *
 * Exists because `a !== b` is wrong for arrays and this comparison decides
 * whether a capped review change gets spent. Order-insensitive for multi-select:
 * picking B then D is the same answer as picking D then B, and charging someone
 * a review change for re-clicking the same two options in the other order would
 * be indefensible.
 */
export function sameAnswer(a: AnswerValue | null | undefined, b: AnswerValue | null | undefined): boolean {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const left = [...a].sort((x, y) => x - y);
    const right = [...b].sort((x, y) => x - y);
    return left.every((value, index) => value === right[index]);
  }
  return false;
}

/**
 * Toggle one option inside a multi-select answer, honoring the required count.
 *
 * When the cap is already met, selecting a further option replaces the OLDEST
 * selection rather than being ignored. A dead click on a full Sentence
 * Equivalence would read as a broken checkbox, and "deselect something first"
 * is a rule the real test does not impose on the candidate either.
 */
export function toggleMultiAnswer(
  current: AnswerValue | null | undefined,
  index: number,
  selectExactly: number | null | undefined
): number[] {
  const chosen = Array.isArray(current) ? [...current] : [];
  const at = chosen.indexOf(index);
  if (at >= 0) {
    chosen.splice(at, 1);
    return chosen;
  }
  chosen.push(index);
  if (selectExactly && chosen.length > selectExactly) {
    return chosen.slice(chosen.length - selectExactly);
  }
  return chosen;
}
