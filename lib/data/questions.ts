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
