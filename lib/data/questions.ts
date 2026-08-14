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

/**
 * Reorders an already-random subset so topics are spread out, aiming for no
 * more than 2 consecutive questions sharing a topic. Without this, questions
 * display in bank order (see getQuestionsByIds below), and since the bank is
 * authored topic-by-topic, a random subset drawn from it still lands in
 * visible topic clusters. Greedily picks from whichever remaining topic has
 * the most items left, skipping a topic only if picking it would make a
 * 3rd-in-a-row. This is a best-effort guarantee, not a hard one: a heavily
 * topic-imbalanced draw (one topic dominating the subset) can still force a
 * run longer than 2 once every other topic is exhausted.
 */
function interleaveByTopic(items: Question[]): Question[] {
  const groups = new Map<string, Question[]>();
  for (const item of items) {
    const group = groups.get(item.topic) ?? [];
    group.push(item);
    groups.set(item.topic, group);
  }

  const result: Question[] = [];
  let lastTopic: string | null = null;
  let secondLastTopic: string | null = null;

  while (result.length < items.length) {
    const candidates = [...groups.entries()]
      .filter(([, group]) => group.length > 0)
      .sort((a, b) => b[1].length - a[1].length);

    const wouldRepeat = ([topic]: [string, Question[]]) =>
      topic === lastTopic && topic === secondLastTopic;
    const [topic, group] = candidates.find((c) => !wouldRepeat(c)) ?? candidates[0];

    const next = group.shift() as Question;
    result.push(next);
    secondLastTopic = lastTopic;
    lastTopic = topic;
  }

  return result;
}

/** Draws a fresh random subset of `count` questions from the section's full bank, arranged so no topic repeats more than twice in a row. */
export function drawRandomQuestionIds(examId: ExamId, section: SectionId, count: number): string[] {
  const drawn = shuffle(getQuestionsForSection(examId, section)).slice(0, count);
  return interleaveByTopic(drawn).map((q) => q.id);
}

/** Reconstructs the exact question set for a previously-drawn attempt, preserving the drawn/interleaved display order. */
export function getQuestionsByIds(examId: ExamId, section: SectionId, ids: string[]): Question[] {
  const questions = getQuestionsForSection(examId, section);
  const byId = new Map(questions.map((q) => [q.id, q]));
  return ids.map((id) => byId.get(id)).filter((q): q is Question => q !== undefined);
}
