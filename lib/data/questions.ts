import { ExamId, Question, SectionId } from "@/data/schema";
import languageSkills from "@/data/questions/language-skills.json";
import quantitativeSkills from "@/data/questions/quantitative-skills.json";
import logicalReasoning from "@/data/questions/logical-reasoning.json";

/** GMAT has no question bank yet (scaffolded route/config only) — sections resolve to empty arrays until a real bank is authored. */
const QUESTIONS_BY_EXAM: Record<ExamId, Record<string, Question[]>> = {
  nmat: {
    "language-skills": languageSkills as Question[],
    "quantitative-skills": quantitativeSkills as Question[],
    "logical-reasoning": logicalReasoning as Question[],
  },
  gmat: {
    quant: [],
    verbal: [],
    "data-insights": [],
  },
};

export function getQuestionsForSection(examId: ExamId, section: SectionId): Question[] {
  return QUESTIONS_BY_EXAM[examId]?.[section] ?? [];
}

export function getAllQuestions(examId: ExamId): Question[] {
  return Object.values(QUESTIONS_BY_EXAM[examId] ?? {}).flat();
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Draws a fresh random subset of `count` questions from the section's full bank. */
export function drawRandomQuestionIds(examId: ExamId, section: SectionId, count: number): string[] {
  return shuffle(getQuestionsForSection(examId, section))
    .slice(0, count)
    .map((q) => q.id);
}

/** Reconstructs the exact question set for a previously-drawn attempt, in the original bank order. */
export function getQuestionsByIds(examId: ExamId, section: SectionId, ids: string[]): Question[] {
  const idSet = new Set(ids);
  return getQuestionsForSection(examId, section).filter((q) => idSet.has(q.id));
}
