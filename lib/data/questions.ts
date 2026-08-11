import { Question, SectionId } from "@/data/schema";
import languageSkills from "@/data/questions/language-skills.json";
import quantitativeSkills from "@/data/questions/quantitative-skills.json";
import logicalReasoning from "@/data/questions/logical-reasoning.json";

const QUESTIONS_BY_SECTION: Record<SectionId, Question[]> = {
  "language-skills": languageSkills as Question[],
  "quantitative-skills": quantitativeSkills as Question[],
  "logical-reasoning": logicalReasoning as Question[],
};

export function getQuestionsForSection(section: SectionId): Question[] {
  return QUESTIONS_BY_SECTION[section];
}

export function getAllQuestions(): Question[] {
  return Object.values(QUESTIONS_BY_SECTION).flat();
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
export function drawRandomQuestionIds(section: SectionId, count: number): string[] {
  return shuffle(QUESTIONS_BY_SECTION[section])
    .slice(0, count)
    .map((q) => q.id);
}

/** Reconstructs the exact question set for a previously-drawn attempt, in the original bank order. */
export function getQuestionsByIds(section: SectionId, ids: string[]): Question[] {
  const idSet = new Set(ids);
  return QUESTIONS_BY_SECTION[section].filter((q) => idSet.has(q.id));
}
