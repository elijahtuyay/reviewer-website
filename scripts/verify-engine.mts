/**
 * Sanity checks for the exam engine, run with `npm run verify:engine`.
 *
 * Not a test framework, just the smallest thing that exercises the pure logic
 * the UI cannot easily show you: the adaptive difficulty ladder and the scoring
 * models. It ASSERTS rather than prints, so a regression fails the run with a
 * non-zero exit code instead of quietly changing the output.
 *
 * It has already earned its place three times: catching a perfect attempt
 * scoring 810 on a band whose maximum is 805, confirming the ladder falls back
 * correctly once a rung is exhausted, and pinning down the scaled model's
 * denominator after a review found that difficulty weighting was a no-op.
 *
 * Imports resolve without the "@/" alias, which is why the modules it touches
 * use `import type` for their type-only imports.
 */
import { initialAdaptiveState, advanceAdaptiveState, pickNextQuestionId } from "../lib/adaptive.ts";
import { scoreAttempt } from "../lib/scoring.ts";
import type { Question } from "../data/schema.ts";
import type { ScoringModel } from "../lib/exams/types.ts";
import { readFileSync } from "node:fs";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}: ${JSON.stringify(actual)}${ok ? "" : ` (expected ${JSON.stringify(expected)})`}`);
}
function expect(label: string, condition: boolean, detail = "") {
  if (!condition) failures++;
  console.log(`${condition ? "ok  " : "FAIL"} ${label}${detail ? ` ${detail}` : ""}`);
}

const rules = { startDifficulty: "medium" as const, stepUpAfter: 2, stepDownAfter: 2 };

// ---------------------------------------------------------------- ladder --
let s = initialAdaptiveState(rules);
const trace: string[] = [s.level];
for (const ok of [true, true, true, true, false, false, false, false, false, false]) {
  s = advanceAdaptiveState(s, ok, rules);
  trace.push(s.level);
}
check(
  "two correct steps up, two wrong steps down, clamped at both ends",
  trace.join(">"),
  "medium>medium>hard>hard>hard>hard>medium>medium>easy>easy>easy"
);

const bank: Question[] = JSON.parse(
  readFileSync(new URL("../data/questions/gmat/verbal.json", import.meta.url), "utf8")
);

function run(allCorrect: boolean) {
  const used: string[] = [];
  let st = initialAdaptiveState(rules);
  for (let i = 0; i < 23; i++) {
    const id = pickNextQuestionId(bank, used, st.level, null);
    if (!id) break;
    used.push(id);
    st = advanceAdaptiveState(st, allCorrect, rules);
  }
  return used;
}
const perfect = run(true);
expect("a 23-question adaptive run serves 23 questions", perfect.length === 23, `got ${perfect.length}`);
expect("no question is served twice", new Set(perfect).size === perfect.length);

// ---------------------------------------------------------------- scoring --
const GMAT: ScoringModel = {
  kind: "scaled",
  min: 205,
  max: 805,
  difficultyWeight: { easy: 1, medium: 2, hard: 3.2 },
  unansweredPenaltyPerQuestion: 0.02,
};
const SECTION = 20;

function pick(difficulty: "easy" | "medium" | "hard", n: number) {
  return bank.filter((q) => q.difficulty === difficulty).slice(0, n);
}
function score(qs: Question[], correctCount: number, total = SECTION) {
  const answers = qs.map((q, i) => ({
    questionId: q.id,
    selectedIndex: i < correctCount ? q.correctIndex : (q.correctIndex + 1) % q.options.length,
  }));
  return scoreAttempt(qs, answers, GMAT, total);
}

const hardPerfect = score(pick("hard", 10).concat(pick("hard", 10)), 20).score;
const easyPerfect = score(pick("easy", 10).concat(pick("easy", 10)), 20).score;
expect(
  "a perfect run on hard questions beats a perfect run on easy ones",
  hardPerfect > easyPerfect,
  `hard=${hardPerfect} easy=${easyPerfect}`
);

const hardPartial = score(pick("hard", 10), 7, SECTION).score;
const easyMost = score(pick("easy", 10), 8, SECTION).score;
expect(
  "difficulty weighting is not a no-op",
  hardPartial > easyMost,
  `7-of-10 hard=${hardPartial} vs 8-of-10 easy=${easyMost}`
);

const finished = score(pick("medium", 10).concat(pick("hard", 10)), 4, SECTION).score;
const bailed = score(pick("medium", 5), 4, SECTION).score;
expect(
  "running out of time costs more than answering and getting it wrong",
  bailed < finished,
  `stopped-at-5=${bailed} finished-20=${finished}`
);

const everything = bank.slice(0, SECTION);
const allRight = scoreAttempt(
  everything,
  everything.map((q) => ({ questionId: q.id, selectedIndex: q.correctIndex })),
  GMAT,
  SECTION
);
expect("score never exceeds the band maximum", allRight.score <= 805, `got ${allRight.score}`);
const nothing = scoreAttempt(everything, [], GMAT, SECTION);
check("an empty attempt scores the band minimum", nothing.score, 205);
check("unreached questions are counted as unanswered", nothing.unansweredCount, SECTION);

const pts = scoreAttempt(
  everything,
  everything.map((q) => ({ questionId: q.id, selectedIndex: q.correctIndex })),
  { kind: "points", pointsPerCorrectAnswer: 3 },
  SECTION
);
check("points model totals marks per correct answer", [pts.score, pts.maxScore], [60, 60]);

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
