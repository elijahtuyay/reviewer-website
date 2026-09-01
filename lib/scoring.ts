import type { Answer, Difficulty, Question } from "@/data/schema";
import type { ScoringModel } from "@/lib/exams/types";

export interface TopicBreakdown {
  topic: string;
  correct: number;
  total: number;
  /**
   * Served but not answered. Tracked separately because "0/8" cannot tell a
   * candidate whether they got a topic wrong or never reached it, and the
   * results screen was reporting topics the user had skipped entirely as though
   * they had failed them.
   */
  unanswered: number;
}

export interface ScoreResult {
  /** The number shown to the candidate: raw points, or a scaled band score. */
  score: number;
  /** The ceiling `score` is measured against. */
  maxScore: number;
  /** Present for scaled models, so the results screen can show the floor of the band too. */
  minScore: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  totalQuestions: number;
  byTopic: TopicBreakdown[];
  /**
   * How many questions of each difficulty were served, and how many of those
   * were right. On an adaptive section this is the visible trace of how the
   * exam read you, and it is the most interesting part of the result.
   */
  served: Record<Difficulty, number>;
  correctByDifficulty: Record<Difficulty, number>;
  /** Which scoring model produced this, so the UI can label it correctly. */
  kind: ScoringModel["kind"];
}

/**
 * Scores an attempt under whichever model the exam declares.
 *
 * "points" is a straight count times a per-answer value: every question is
 * worth the same, which is what a fixed-form exam does.
 *
 * "scaled" weights each correct answer by how hard the question was, then maps
 * the result onto the exam's band. That is what makes an adaptive section
 * behave the way candidates are told it behaves: missing a few of the hardest
 * questions can still leave a strong score, while sweeping only easy ones
 * cannot. Unreached questions are then penalized on top, because on the real
 * thing running out of time costs far more than guessing wrong.
 */
export function scoreAttempt(
  questions: Question[],
  answers: Answer[],
  model: ScoringModel,
  /**
   * How long the section is SUPPOSED to be. Defaults to the number of questions
   * served, which is the same thing for a fixed-form exam.
   *
   * It is not the same thing on an adaptive section, where questions are served
   * one at a time and running out of time means the rest were never seen. Left
   * to default, a candidate who answered 4 questions and stalled was scored out
   * of 4 and walked away with a high band score, which made timing out the
   * cheapest route to a good result: the exact opposite of the lesson the
   * unanswered penalty exists to teach.
   */
  sectionQuestionCount?: number
): ScoreResult {
  const answerByQuestionId = new Map(answers.map((a) => [a.questionId, a.selectedIndex]));
  const topicMap = new Map<string, TopicBreakdown>();

  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;
  let earnedWeight = 0;
  let availableWeight = 0;
  const served: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
  const correctByDifficulty: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };

  for (const question of questions) {
    const selectedIndex = answerByQuestionId.get(question.id) ?? null;
    const isCorrect = selectedIndex === question.correctIndex;
    served[question.difficulty]++;
    if (isCorrect) correctByDifficulty[question.difficulty]++;

    if (selectedIndex === null || selectedIndex === undefined) {
      unansweredCount++;
    } else if (isCorrect) {
      correctCount++;
    } else {
      incorrectCount++;
    }

    if (model.kind === "scaled") {
      const weight = model.difficultyWeight[question.difficulty];
      availableWeight += weight;
      if (isCorrect) earnedWeight += weight;
    }

    if (!topicMap.has(question.topic)) {
      topicMap.set(question.topic, { topic: question.topic, correct: 0, total: 0, unanswered: 0 });
    }
    const topicEntry = topicMap.get(question.topic)!;
    topicEntry.total++;
    if (isCorrect) topicEntry.correct++;
    else if (selectedIndex === null) topicEntry.unanswered++;
  }

  const byTopic = Array.from(topicMap.values());
  const totalQuestions = Math.max(sectionQuestionCount ?? questions.length, questions.length);
  // Questions never served are unanswered too, not absent.
  const unanswered = unansweredCount + (totalQuestions - questions.length);

  if (model.kind === "points") {
    return {
      score: correctCount * model.pointsPerCorrectAnswer,
      maxScore: totalQuestions * model.pointsPerCorrectAnswer,
      minScore: 0,
      correctCount,
      incorrectCount,
      unansweredCount: unanswered,
      totalQuestions,
      byTopic,
      served,
      correctByDifficulty,
      kind: "points",
    };
  }

  /**
   * The denominator is a FIXED reference, not the weight of what happened to be
   * served.
   *
   * Normalizing by the served weight made `difficultyWeight` a no-op: any
   * all-correct run scored the maximum, so sweeping twenty easy questions beat
   * getting seven of ten hard ones right. That is the opposite of what an
   * adaptive exam measures, and the opposite of what this file and the results
   * screen both claim. Measuring against a full section of the hardest
   * available material means climbing the ladder is what earns the top of the
   * band, which is the whole point of the mechanic.
   */
  const hardestWeight = Math.max(
    model.difficultyWeight.easy,
    model.difficultyWeight.medium,
    model.difficultyWeight.hard
  );
  availableWeight = totalQuestions * hardestWeight;

  const ratio = availableWeight > 0 ? Math.min(1, earnedWeight / availableWeight) : 0;
  const penalty = Math.min(1, unanswered * model.unansweredPenaltyPerQuestion);
  // The penalty scales what was earned rather than subtracting from the floor,
  // so it can never push a score below the band's minimum.
  const adjusted = Math.max(0, ratio * (1 - penalty));
  const span = model.max - model.min;
  // Real band scores move in fixed steps, not continuously, so this rounds to
  // the nearest 10 and stops the number looking spuriously precise.
  //
  // Rounding the OFFSET from the floor, not the absolute score: the band starts
  // at 205, so rounding the absolute value to a multiple of 10 pushed a perfect
  // attempt to 810, ten points above the declared maximum. The clamp is a
  // second belt: a model whose span is not a multiple of 10 must still never
  // report a score outside its own band.
  const steps = Math.round((adjusted * span) / 10) * 10;
  const score = Math.min(model.max, Math.max(model.min, model.min + steps));

  return {
    score,
    maxScore: model.max,
    minScore: model.min,
    correctCount,
    incorrectCount,
    unansweredCount: unanswered,
    totalQuestions,
    byTopic,
    served,
    correctByDifficulty,
    kind: "scaled",
  };
}
