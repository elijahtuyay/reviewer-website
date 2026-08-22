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
import { press, initialCalculatorState } from "../lib/calculator/basic-di.ts";
import type { CalculatorKey, CalculatorState } from "../lib/calculator/basic-di.ts";
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

// ------------------------------------------------------------- calculator --
/**
 * The Data Insights calculator, an emulated TI-108.
 *
 * Several of these assert behavior that looks like a bug, so they exist as much
 * to stop a future reader "fixing" the device as to catch a regression. If the
 * left-to-right checks start failing because someone taught it precedence, the
 * calculator is now wrong and the test is right.
 */
function type(keys: string): CalculatorState {
  return keys
    .trim()
    .split(/\s+/)
    .reduce((st, k) => press(st, k as CalculatorKey), initialCalculatorState());
}

// -- the headline quirk, and the workaround for it
check("ignores order of operations and evaluates left to right", type("2 + 3 * 4 =").display, "20");
check(
  "1350x8 + 1050x18 typed straight through gives the LEFT-TO-RIGHT answer",
  type("1 3 5 0 * 8 + 1 0 5 0 * 1 8 =").display,
  "213300"
);
check(
  "the same sum via the memory keys gives the mathematically correct answer",
  type("1 3 5 0 * 8 = m+ onC 1 0 5 0 * 1 8 = m+ mrc").display,
  "29700"
);

// -- the fold guard. Every one of these was WRONG before `operandReady`
// existed: a value-producing key left the display in "result" mode, the
// operator branch failed its guard, and the pending operation was discarded.
check("a square root mid-chain does not drop the pending operation", type("2 + 9 sqrt * 4 =").display, "20");
check("a percent mid-chain does not drop the pending operation", type("1 2 0 + 1 5 % + 0 =").display, "138");
check("M+ mid-chain does not drop the pending operation", type("2 + 3 m+ * 4 =").display, "20");
check("a recall mid-chain does not drop the pending operation", type("5 m+ onC onC 2 + mrc * 4 =").display, "28");
check(
  "= and the operator branch agree about identical state",
  [type("2 + 9 sqrt =").display, type("2 + 9 sqrt + 0 =").display],
  ["5", "5"]
);
check("a corrected operator replaces the pending one without folding", type("9 + * 3 =").display, "27");

// -- percent is contextual, not divide-by-100
check("percent of a pending sum takes it from the accumulator", type("1 2 + 1 0 %").display, "1.2");
check("that percent then resolves with equals", type("1 2 + 1 0 % =").display, "13.2");
check("percent with nothing pending divides by one hundred", type("1 0 %").display, "0.1");
check("percent under multiplication divides by one hundred", type("8 * 5 0 % =").display, "4");

// -- the automatic constant
check("repeated equals repeats the last operation", type("3 + 2 * 5 = = =").display, "625");
check("equals with nothing pending and nothing remembered stands still", type("7 =").display, "7");

// -- the eight-digit display
check("entry stops at eight digits", type("1 2 3 4 5 6 7 8 9").display, "12345678");
check("a result past the display range overflows", type("9 9 9 9 9 9 9 9 * 9 =").display, "Error");
check("only ON/C clears an overflow", type("9 9 9 9 9 9 9 9 * 9 = 5 + 1 =").display, "Error");
check("results never use exponent notation", type("1 / 1 0 0 0 0 0 0 0 =").display, "0.0000001");
check("a result too small to show reads as zero", type("1 / 1 0 0 0 0 0 0 0 = / 1 0 0 =").display, "0");

// -- errors
check("divide by zero errors", type("9 / 0 =").display, "Error");
check("the square root of a negative errors", type("9 +/- sqrt").display, "Error");
check("ON/C recovers from an error", type("9 / 0 = onC 7").display, "7");
check("memory overflow errors and leaves memory intact", type("9 9 9 9 9 9 9 9 m+ m+").display, "Error");

// -- clear semantics: one key, two behaviors
check(
  "one ON/C clears the entry, two clear the calculation",
  [type("8 + 5 onC 2 =").display, type("8 + 5 onC onC 2 =").display],
  ["10", "2"]
);
check("ON/C preserves memory, which is what makes the workaround usable", type("7 m+ onC onC").memory, 7);

// -- memory recall
check("a second consecutive MRC clears memory", type("5 m+ mrc mrc").memory, 0);
check("an MRC broken by another key does not clear memory", type("5 m+ mrc 9 mrc").memory, 5);

// -- formatting
check("float noise never reaches the display", type(". 1 + . 2 =").display, "0.3");
check("a sign flip after an operator is treated as a supplied operand", type("2 + +/- * 4 =").display, "0");

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
