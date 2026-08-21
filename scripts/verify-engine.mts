/**
 * Sanity checks for the exam engine, run with `npm run verify:engine`.
 *
 * Not a test framework, just the smallest thing that exercises the pure logic
 * the UI cannot easily show you: the adaptive difficulty ladder and the scoring
 * models. It has already earned its place twice, catching a perfect attempt
 * scoring 810 on a band whose maximum is 805, and confirming that the ladder
 * falls back correctly once a difficulty rung is exhausted.
 *
 * Imports resolve without the "@/" alias, which is why the modules it touches
 * use `import type` for their type-only imports.
 */
import { initialAdaptiveState, advanceAdaptiveState, pickNextQuestionId } from "../lib/adaptive.ts";
import { scoreAttempt } from "../lib/scoring.ts";
import type { Question } from "../data/schema.ts";
import { readFileSync } from "node:fs";

const rules = { startDifficulty: "medium" as const, stepUpAfter: 2, stepDownAfter: 2 };

let s = initialAdaptiveState(rules);
const trace: string[] = [s.level];
for (const ok of [true, true, true, true, false, false, false, false, false, false]) {
  s = advanceAdaptiveState(s, ok, rules);
  trace.push(s.level);
}
console.log("streak trace:", trace.join(" -> "));

const bank: Question[] = JSON.parse(readFileSync(new URL("../data/questions/gmat/verbal.json", import.meta.url), "utf8"));

function run(allCorrect: boolean) {
  const used: string[] = [];
  const served: string[] = [];
  let st = initialAdaptiveState(rules);
  for (let i = 0; i < 23; i++) {
    const id = pickNextQuestionId(bank, used, st.level, null);
    if (!id) return "RAN DRY at " + i;
    used.push(id);
    served.push(bank.find((q) => q.id === id)!.difficulty[0]);
    st = advanceAdaptiveState(st, allCorrect, rules);
  }
  return served.join("") + "  (unique " + new Set(used).size + "/" + used.length + ")";
}
console.log("all-correct run :", run(true));
console.log("all-wrong run   :", run(false));

const model = {
  kind: "scaled" as const,
  min: 205,
  max: 805,
  difficultyWeight: { easy: 1, medium: 2, hard: 3.2 },
  unansweredPenaltyPerQuestion: 0.02,
};
const qs = bank.slice(0, 20);
const right = qs.map((q) => ({ questionId: q.id, selectedIndex: q.correctIndex }));
const wrong = qs.map((q) => ({
  questionId: q.id,
  selectedIndex: (q.correctIndex + 1) % q.options.length,
}));
console.log("scaled all correct   :", scoreAttempt(qs, right, model).score);
console.log("scaled all wrong     :", scoreAttempt(qs, wrong, model).score);
console.log("scaled half answered :", scoreAttempt(qs, right.slice(0, 10), model).score, "(10 unanswered)");
console.log("scaled none answered :", scoreAttempt(qs, [], model).score);

const pts = scoreAttempt(qs, right, { kind: "points", pointsPerCorrectAnswer: 3 });
console.log("points all correct   :", pts.score, "/", pts.maxScore);
console.log("difficulty served    :", JSON.stringify(scoreAttempt(qs, right, model).served));
