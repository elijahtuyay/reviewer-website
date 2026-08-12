import { Answer, Question } from "@/data/schema";

export interface TopicBreakdown {
  topic: string;
  correct: number;
  total: number;
}

export interface ScoreResult {
  score: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  totalQuestions: number;
  byTopic: TopicBreakdown[];
}

export function scoreAttempt(questions: Question[], answers: Answer[], pointsPerCorrectAnswer: number): ScoreResult {
  const answerByQuestionId = new Map(answers.map((a) => [a.questionId, a.selectedIndex]));
  const topicMap = new Map<string, TopicBreakdown>();

  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;

  for (const question of questions) {
    const selectedIndex = answerByQuestionId.get(question.id) ?? null;
    const isCorrect = selectedIndex === question.correctIndex;

    if (selectedIndex === null || selectedIndex === undefined) {
      unansweredCount++;
    } else if (isCorrect) {
      correctCount++;
    } else {
      incorrectCount++;
    }

    if (!topicMap.has(question.topic)) {
      topicMap.set(question.topic, { topic: question.topic, correct: 0, total: 0 });
    }
    const topicEntry = topicMap.get(question.topic)!;
    topicEntry.total++;
    if (isCorrect) topicEntry.correct++;
  }

  return {
    score: correctCount * pointsPerCorrectAnswer,
    correctCount,
    incorrectCount,
    unansweredCount,
    totalQuestions: questions.length,
    byTopic: Array.from(topicMap.values()),
  };
}
