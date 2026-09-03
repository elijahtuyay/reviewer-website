/**
 * Which exam this data belongs to.
 *
 * A plain string, not a closed union, on purpose: `lib/exams/registry.ts` is
 * the single source of truth for which exams exist, and a union here would mean
 * adding an exam required editing this file too. Validate with
 * `isValidExamId()` at the boundary (route params) rather than relying on the
 * type.
 */
export type ExamId = string;

/** Section ids are exam-scoped strings (e.g. NMAT's "language-skills" vs. GMAT's "quant") rather than a single closed union, since each exam defines its own set. */
export type SectionId = string;

export type Difficulty = "easy" | "medium" | "hard";

/** Where a question came from — lets future imports (e.g. a purchased reviewer PDF) merge into the same bank without a schema migration. */
export type QuestionSource = string;

/**
 * A question, in one of three shapes.
 *
 * `kind` is OPTIONAL and absent means "single", which is the reason all 390
 * questions already in the bank needed no edit when the GRE added the other
 * two. A required discriminant would have meant a migration over six JSON files
 * to state the thing that was already true of every one of them.
 *
 * The fields for the other kinds are optional at the type level and required in
 * practice, enforced by `npm run audit:bank` rather than by TypeScript: the
 * bank is JSON loaded through a dynamic import, so the compiler never sees it
 * and a stricter union here would buy nothing but noise at the call sites.
 *
 *  - **single**: `options` + `correctIndex`. Everything NMAT and GMAT ask.
 *  - **multi**: `options` + `correctIndices`, with `selectExactly` when the
 *    exam demands a precise count. GRE Sentence Equivalence is six options and
 *    exactly two right ones, and marking it needs BOTH, not either.
 *  - **numeric**: no options at all. `correctValue`, with an optional
 *    `tolerance` for answers a candidate may legitimately round, and
 *    `answerPrefix`/`answerSuffix` for the unit printed beside the box.
 */
export interface Question {
  id: string;
  section: SectionId;
  topic: string;
  difficulty: Difficulty;
  prompt: string;
  explanation: string;
  source: QuestionSource;

  /** Absent means "single". See the note above before making this required. */
  kind?: "single" | "multi" | "numeric";

  /** Present for "single" and "multi". A numeric-entry question has none. */
  options?: string[];

  /** "single" only. */
  correctIndex?: number;

  /** "multi" only. Every index here must be selected, and no other. */
  correctIndices?: number[];

  /**
   * "multi" only. How many options the candidate must select, or null for
   * "as many as apply". GRE Sentence Equivalence is exactly 2, and the UI
   * states the count rather than letting someone discover it by being marked
   * wrong.
   */
  selectExactly?: number | null;

  /** "numeric" only. The value the entry is marked against. */
  correctValue?: number;

  /**
   * "numeric" only. Absolute tolerance, defaulting to an exact match.
   *
   * Set it whenever the honest answer is a rounded one. A question whose answer
   * is 16.67 must accept 16.67 and 16.6667, and a candidate who is right should
   * never be marked wrong by the third decimal place.
   */
  tolerance?: number;

  /** "numeric" only. Printed beside the entry box, e.g. "₱" before or "%" after. */
  answerPrefix?: string;
  answerSuffix?: string;
}

/**
 * One question and what the candidate put for it.
 *
 * `value` replaced a `selectedIndex: number | null` when the GRE brought
 * question kinds whose answer is not an option index. See `lib/answers.ts` for
 * the shapes and for why every comparison has to go through that module.
 */
export interface Answer {
  questionId: string;
  value: number | number[] | string | null;
}
