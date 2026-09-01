import type { Difficulty, Question } from "@/data/schema";
import type { AdaptiveRules } from "@/lib/exams/types";

/**
 * Difficulty selection for computer-adaptive sections.
 *
 * The real thing is an item-response-theory model that re-estimates ability
 * after every answer and picks the item that most reduces uncertainty. This is
 * the behavior that model produces, implemented over the three difficulty
 * rungs the question bank actually has: answer correctly and the questions get
 * harder, miss and they get easier, and the ladder is what the score is
 * weighted by.
 *
 * It is a faithful simulation of the *experience*, not a reimplementation of
 * anyone's proprietary scoring, and the results screen says so.
 */

const LADDER: Difficulty[] = ["easy", "medium", "hard"];

export interface AdaptiveState {
  /** Where on the ladder the next question is drawn from. */
  level: Difficulty;
  /** Consecutive correct answers at the current level. */
  correctStreak: number;
  /** Consecutive wrong answers at the current level. */
  wrongStreak: number;
}

export function initialAdaptiveState(rules: AdaptiveRules): AdaptiveState {
  return { level: rules.startDifficulty, correctStreak: 0, wrongStreak: 0 };
}

function step(level: Difficulty, direction: 1 | -1): Difficulty {
  const i = LADDER.indexOf(level);
  const next = Math.min(LADDER.length - 1, Math.max(0, i + direction));
  return LADDER[next];
}

/**
 * Folds one answer into the state. A streak that moves the level resets both
 * counters, so the level changes on a run rather than oscillating on every
 * alternating right/wrong pair.
 */
export function advanceAdaptiveState(
  state: AdaptiveState,
  wasCorrect: boolean,
  rules: AdaptiveRules
): AdaptiveState {
  if (wasCorrect) {
    const correctStreak = state.correctStreak + 1;
    if (correctStreak >= rules.stepUpAfter) {
      return { level: step(state.level, 1), correctStreak: 0, wrongStreak: 0 };
    }
    return { level: state.level, correctStreak, wrongStreak: 0 };
  }

  const wrongStreak = state.wrongStreak + 1;
  if (wrongStreak >= rules.stepDownAfter) {
    return { level: step(state.level, -1), correctStreak: 0, wrongStreak: 0 };
  }
  return { level: state.level, correctStreak: 0, wrongStreak };
}

/**
 * Picks the next question id at (or nearest to) the target difficulty, from
 * whatever has not been served yet.
 *
 * "Nearest to" matters: a section can exhaust one rung, and refusing to serve
 * anything then would end the attempt early. Walking outward from the target
 * keeps the section the length it is supposed to be, and topic spread is
 * respected as a tiebreak so an adaptive run does not turn into six
 * consecutive questions on the same topic.
 */
export function pickNextQuestionId(
  pool: Question[],
  usedIds: string[],
  target: Difficulty,
  lastTopic: string | null
): string | null {
  const used = new Set(usedIds);
  const remaining = pool.filter((q) => !used.has(q.id));
  if (remaining.length === 0) return null;

  const targetIndex = LADDER.indexOf(target);
  // Rungs ordered by distance from the target, ties broken toward the harder
  // one so a candidate who is doing well is not quietly stepped down.
  const byDistance = [...LADDER].sort((a, b) => {
    const da = Math.abs(LADDER.indexOf(a) - targetIndex);
    const db = Math.abs(LADDER.indexOf(b) - targetIndex);
    if (da !== db) return da - db;
    return LADDER.indexOf(b) - LADDER.indexOf(a);
  });

  for (const level of byDistance) {
    const atLevel = remaining.filter((q) => q.difficulty === level);
    if (atLevel.length === 0) continue;
    const freshTopic = atLevel.filter((q) => q.topic !== lastTopic);
    const choices = freshTopic.length > 0 ? freshTopic : atLevel;
    return choices[Math.floor(Math.random() * choices.length)].id;
  }

  return null;
}
