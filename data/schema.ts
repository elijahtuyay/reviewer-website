export type SectionId = "language-skills" | "quantitative-skills" | "logical-reasoning";

export type Difficulty = "easy" | "medium" | "hard";

/** Where a question came from — lets future imports (e.g. a purchased reviewer PDF) merge into the same bank without a schema migration. */
export type QuestionSource = "original" | "nmat-reviewer-pdf";

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
  section: SectionId;
  answers: Answer[];
  startedAt: number;
  submittedAt: number | null;
}
