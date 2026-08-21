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

export interface Question {
  id: string;
  section: SectionId;
  topic: string;
  difficulty: Difficulty;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  source: QuestionSource;
}

export interface Answer {
  questionId: string;
  selectedIndex: number | null;
}

export interface QuizAttempt {
  exam: ExamId;
  section: SectionId;
  answers: Answer[];
  startedAt: number;
  submittedAt: number | null;
}
