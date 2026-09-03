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
import {
  pressGre,
  initialGreCalculatorState,
  hasGreMemory,
  displayValue,
} from "../lib/calculator/gre-standard.ts";
import type { GreCalculatorKey } from "../lib/calculator/gre-standard.ts";
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
  scoreStep: 10,
  denominator: "fixed-reference",
};

/** The GRE band, to prove the step is honored and not hard-coded at ten. */
const GRE: ScoringModel = {
  kind: "scaled",
  min: 130,
  max: 170,
  difficultyWeight: { easy: 1, medium: 2, hard: 3.2 },
  unansweredPenaltyPerQuestion: 0.02,
  scoreStep: 1,
  denominator: "served",
};
const SECTION = 20;

function pick(difficulty: "easy" | "medium" | "hard", n: number) {
  return bank.filter((q) => q.difficulty === difficulty).slice(0, n);
}
/** A deliberately wrong answer for any question kind. */
function wrongFor(q: Question) {
  const options = q.options ?? [];
  return ((q.correctIndex ?? 0) + 1) % Math.max(1, options.length);
}
function score(qs: Question[], correctCount: number, total = SECTION) {
  const answers = qs.map((q, i) => ({
    questionId: q.id,
    value: i < correctCount ? (q.correctIndex ?? 0) : wrongFor(q),
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
  everything.map((q) => ({ questionId: q.id, value: q.correctIndex ?? 0 })),
  GMAT,
  SECTION
);
expect("score never exceeds the band maximum", allRight.score <= 805, `got ${allRight.score}`);
const nothing = scoreAttempt(everything, [], GMAT, SECTION);
check("an empty attempt scores the band minimum", nothing.score, 205);
check("unreached questions are counted as unanswered", nothing.unansweredCount, SECTION);

/*
 * The band step is DECLARED, not fixed at ten.
 *
 * A 130-170 measure rounded to the nearest ten leaves a candidate five
 * reachable scores, which is what the GRE would have got by inheriting the
 * GMAT's constant. These assert that both bands move in their own step and that
 * neither can leave its own range.
 */
const greAll = scoreAttempt(
  everything,
  everything.map((q) => ({ questionId: q.id, value: q.correctIndex ?? 0 })),
  GRE,
  SECTION
);
expect("the GRE band never exceeds its maximum", greAll.score <= 170, `got ${greAll.score}`);
/*
 * A NON-ADAPTIVE scaled exam must be able to REACH its maximum, and this is the
 * assertion whose absence let a real defect ship.
 *
 * Under the fixed reference the GMAT needs, a flawless GRE attempt scored about
 * 159 of 170, because the denominator assumed a full section of the hardest
 * material while a random draw averages far less. Nothing caught it: the old
 * check only asserted the score stayed BELOW the ceiling, which it did, by
 * eleven points, on a perfect run.
 */
check("a flawless run on a non-adaptive exam reaches the maximum", greAll.score, 170);
const greEasyPerfect = scoreAttempt(
  pick("easy", 10),
  pick("easy", 10).map((q) => ({ questionId: q.id, value: q.correctIndex ?? 0 })),
  GRE,
  10
);
check(
  "a flawless run reaches the maximum whatever the draw held",
  greEasyPerfect.score,
  170
);
/*
 * Difficulty must still COUNT on a partial run, which is the property "served"
 * could plausibly have destroyed and does not: getting the hard half right beats
 * getting the easy half right.
 */
const mixed = pick("easy", 10).concat(pick("hard", 10));
const hardHalfRight = scoreAttempt(
  mixed,
  mixed.map((q, i) => ({ questionId: q.id, value: i >= 10 ? (q.correctIndex ?? 0) : wrongFor(q) })),
  GRE,
  20
);
const easyHalfRight = scoreAttempt(
  mixed,
  mixed.map((q, i) => ({ questionId: q.id, value: i < 10 ? (q.correctIndex ?? 0) : wrongFor(q) })),
  GRE,
  20
);
expect(
  "difficulty still counts on a served-denominator exam",
  hardHalfRight.score > easyHalfRight.score,
  `hard-half=${hardHalfRight.score} easy-half=${easyHalfRight.score}`
);
/* A zero or negative step would produce NaN before the clamp ever sees it. */
for (const m of [GMAT, GRE]) {
  if (m.kind === "scaled") expect(`${m.min}-${m.max} declares a positive score step`, m.scoreStep > 0);
}
check("an empty GRE attempt scores the band minimum", scoreAttempt(everything, [], GRE, SECTION).score, 130);
const greHalf = scoreAttempt(
  everything,
  everything.map((q, i) => ({
    questionId: q.id,
    value: i < SECTION / 2 ? (q.correctIndex ?? 0) : wrongFor(q),
  })),
  GRE,
  SECTION
);
expect(
  "a GRE score is not forced to a multiple of ten",
  greHalf.score > 130 && greHalf.score < 170,
  `got ${greHalf.score}`
);

/*
 * The two question kinds the GRE brought. Both are marked through
 * lib/answers.ts, and both were unmarkable by the old `=== correctIndex` test:
 * an array is never `===` an index, and a typed string never is either.
 */
const seQuestion: Question = {
  id: "verify-se",
  section: "verbal",
  topic: "Sentence Equivalence",
  difficulty: "medium",
  prompt: "Verify multi-select marking.",
  explanation: "Both required options must be chosen, and no others.",
  source: "verify",
  kind: "multi",
  options: ["a", "b", "c", "d", "e", "f"],
  correctIndices: [1, 4],
  selectExactly: 2,
};
const numQuestion: Question = {
  id: "verify-num",
  section: "quantitative",
  topic: "Numeric Entry",
  difficulty: "medium",
  prompt: "Verify numeric marking.",
  explanation: "Parsed, with tolerance.",
  source: "verify",
  kind: "numeric",
  correctValue: 16.67,
  tolerance: 0.01,
};

function markOne(q: Question, value: number | number[] | string | null) {
  return scoreAttempt([q], [{ questionId: q.id, value }], { kind: "points", pointsPerCorrectAnswer: 1 }, 1)
    .correctCount;
}
check("select-two marks both correct options as right", markOne(seQuestion, [1, 4]), 1);
check("order does not matter on a select-two", markOne(seQuestion, [4, 1]), 1);
check("one of the two required picks is not correct", markOne(seQuestion, [1]), 0);
check("a third pick is not correct", markOne(seQuestion, [1, 4, 5]), 0);
check("a wrong pair is not correct", markOne(seQuestion, [0, 2]), 0);
check("numeric entry accepts the exact value", markOne(numQuestion, "16.67"), 1);
check("numeric entry accepts within tolerance", markOne(numQuestion, "16.666"), 1);
check("numeric entry accepts an equivalent fraction", markOne(numQuestion, "50/3"), 1);
check("numeric entry strips a thousands separator", markOne({ ...numQuestion, correctValue: 1250, tolerance: 0 }, "1,250"), 1);
check("numeric entry rejects a value outside tolerance", markOne(numQuestion, "16.5"), 0);
check("numeric entry rejects junk", markOne(numQuestion, "about sixteen"), 0);
check("an empty numeric entry is unanswered, not wrong", markOne(numQuestion, "   "), 0);
expect(
  "an empty numeric entry counts as unanswered",
  scoreAttempt([numQuestion], [{ questionId: numQuestion.id, value: "  " }], { kind: "points", pointsPerCorrectAnswer: 1 }, 1)
    .unansweredCount === 1
);

/* ------------------------------------------- the GRE calculator ---------- */

/*
 * The device ETS provides in Quantitative Reasoning, which is NOT the TI-108
 * the GMAT provides. These assertions exist as much to stop someone
 * "simplifying" the two calculators into one as to catch a regression.
 */
function greRun(keys: GreCalculatorKey[]) {
  let s = initialGreCalculatorState();
  for (const k of keys) s = pressGre(s, k);
  return s;
}
const greKeys = (text: string): GreCalculatorKey[] =>
  text.split(" ").filter(Boolean) as GreCalculatorKey[];
const greDisplay = (text: string) => greRun(greKeys(text)).display;

// THE defining difference. The GMAT device gives 20 for this.
check("order of operations: multiplication binds tighter than addition", greDisplay("2 + 3 * 4 ="), "14");
check("the GMAT device gives 20 for the same keys", type("2 + 3 * 4 =").display, "20");
check("division binds tighter than subtraction", greDisplay("1 0 - 6 / 2 ="), "7");
check("equal precedence runs left to right", greDisplay("8 / 4 * 2 ="), "4");

// Parentheses, which the GMAT device does not have at all.
check("parentheses override precedence", greDisplay("( 2 + 3 ) * 4 ="), "20");
check("nested parentheses", greDisplay("( 2 + ( 3 * 4 ) ) ="), "14");
check("an unclosed parenthesis still evaluates at equals", greDisplay("( 2 + 3 * 4 ="), "14");
check("a stray closing parenthesis is ignored", greDisplay("2 + 3 ) ="), "5");
check("an open parenthesis after a number is refused", greDisplay("2 ( 3 ="), "23");

// The keys it shares with every calculator.
check("square root", greDisplay("9 sqrt"), "3");
check("the square root of a negative errors", greDisplay("9 negate sqrt"), "Error");
check("a root feeds the next operation", greDisplay("9 sqrt + 1 ="), "4");
check("sign change on an entry", greDisplay("5 negate ="), "-5");
check("divide by zero errors", greDisplay("5 / 0 ="), "Error");
check("only C recovers from an error", greRun([...greKeys("5 / 0 ="), "7"]).display, "Error");
check("C recovers", greRun([...greKeys("5 / 0 ="), "C", "7"]).display, "7");
check("a second decimal point is ignored, the digit after it is not", greDisplay("1 . 5 . 5 ="), "1.55");
check("a leading zero is replaced", greDisplay("0 7 ="), "7");

// Eight digits, and the ceiling applies to memory too.
check("the display holds eight digits", greDisplay("1 2 3 4 5 6 7 8 9"), "12345678");
check("a result past eight digits errors", greDisplay("9 9 9 9 9 9 9 9 * 9 ="), "Error");
check("memory adds", greRun(greKeys("7 M+ C MR")).display, "7");
check("memory subtracts", greRun(greKeys("7 M+ C 2 M- C MR")).display, "5");
check("memory clears", greRun(greKeys("7 M+ MC C MR")).display, "0");
expect(
  "memory survives a clear, which is what makes it useful",
  greRun(greKeys("7 M+ C MR")).memory === 7
);
expect("the memory indicator follows the register", hasGreMemory(greRun(greKeys("7 M+"))));
expect("an empty register shows no indicator", !hasGreMemory(greRun(greKeys("7 M+ MC"))));
check("a memory value past the ceiling errors", greDisplay("9 9 9 9 9 9 9 9 M+ M+ M+ M+ M+ M+ M+ M+ M+ M+ M+"), "Error");

// Transfer Display hands the shown value to a Numeric Entry box.
expect("the display value is available to transfer", displayValue(greRun(greKeys("1 2 . 5 ="))) === 12.5);
expect("an errored display transfers nothing", displayValue(greRun(greKeys("5 / 0 ="))) === null);

const pts = scoreAttempt(
  everything,
  everything.map((q) => ({ questionId: q.id, value: q.correctIndex ?? 0 })),
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
check(
  "memory overflow errors and leaves memory intact",
  [type("9 9 9 9 9 9 9 9 m+ m+").display, type("9 9 9 9 9 9 9 9 m+ m+").memory],
  ["Error", 99999999]
);

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
/**
 * The chained accumulator must carry the DISPLAYED value, not full double
 * precision, or the calculator gives two answers for the same arithmetic
 * depending on whether `=` was pressed in the middle. There was no assertion
 * covering this and the bug shipped: `1 / 3 * 3 =` returned exactly 1 while
 * `1 / 3 = * 3 =` returned 0.9999999.
 */
check(
  "a chained fold and an explicit equals agree on a repeating decimal",
  [type("1 / 3 * 3 =").display, type("1 / 3 = * 3 =").display],
  ["0.9999999", "0.9999999"]
);
check(
  "the same holds for an ordinary percent-of-total calculation",
  [type("1 4 7 / 3 6 0 * 1 0 0 =").display, type("1 4 7 / 3 6 0 = * 1 0 0 =").display],
  ["40.83333", "40.83333"]
);
check("a value that rounds into range is shown, not errored", type("9 9 9 9 9 9 9 9 + . 4 =").display, "99999999");
check("a value that rounds out of range still errors", type("9 9 9 9 9 9 9 9 + . 5 =").display, "Error");
check("equals with no second operand reuses the first", type("2 + =").display, "4");
check("a sign flip after an operator is treated as a supplied operand", type("2 + +/- * 4 =").display, "0");

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
