/**
 * THE DATA INSIGHTS CALCULATOR, AS A PURE REDUCER.
 *
 * Models the on-screen calculator the GMAT Focus Edition provides in Data
 * Insights, and ONLY in Data Insights. Quantitative Reasoning does not get one,
 * which is a deliberate property of that section rather than an oversight; see
 * `SectionConfig.calculator` in `lib/exams/types.ts`.
 *
 * No React, no DOM, no imports. That is what lets `npm run verify:engine`
 * assert its behavior directly, which matters more here than usual: the
 * headline behavior below looks exactly like a bug, so the thing that stops a
 * future reader from "fixing" it is an assertion that fails when they do.
 *
 * ── The headline behavior ────────────────────────────────────────────────
 *
 * IT EVALUATES STRICTLY LEFT TO RIGHT AND IGNORES ORDER OF OPERATIONS.
 *
 *     2 + 3 * 4 =   →   20     (not 14)
 *
 * There are no parentheses and no way to override it. This is not a
 * simplification we chose; it is what the real calculator does, and it is the
 * single most valuable thing this feature teaches. A student who practices on a
 * mathematically correct calculator meets this one on test day and gets a wrong
 * answer with complete confidence.
 *
 * The official workaround is the memory keys: compute the first product, M+,
 * clear, compute the second, M+, then MRC. `verify-engine.mts` asserts both the
 * naive path and the memory path, so the quirk cannot silently regress.
 *
 * ── Two behaviors sources disagree on ────────────────────────────────────
 *
 * Flagged rather than asserted as fidelity, because they could not be verified
 * against the official software:
 *
 *  1. `%` is documented only as "converts to percent equivalent". Basic
 *     calculators split between plain divide-by-100 and a contextual reading
 *     where `200 + 10 %` yields 220. We implement divide-by-100: it matches the
 *     wording, and it can never silently return a number the user did not ask
 *     for. If someone confirms the contextual behavior against the real tool,
 *     that is a deliberate change here plus a new assertion, not a bug fix.
 *
 *  2. Repeated `=` does NOT repeat the last operation. Many four-function
 *     calculators do. No source describes what this one does, so it does the
 *     inert thing rather than inventing a behavior a user might come to rely on.
 *
 * The memory key set (M+ / M- / MRC, with no store key) follows the GMAT Focus
 * rendering. Older write-ups describe MS/MR/M+/MC and separate BS/CE/CA clear
 * keys; those describe a pre-Focus calculator. Note there is genuinely no store
 * key, so "put this number in memory" means AC-ing memory and then M+. That is
 * awkward on the real exam, and reproducing the awkwardness is the point.
 */

export type Operator = "+" | "-" | "*" | "/";

export type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

export type CalculatorKey =
  | Digit
  | "."
  | Operator
  | "="
  | "+/-"
  | "sqrt"
  | "%"
  | "back"
  | "clear"
  | "allClear"
  | "mrc"
  | "m+"
  | "m-";

export interface CalculatorState {
  /** Exactly what the screen shows. A string, because "0." and "1.50" are real display states a number cannot represent. */
  display: string;
  /** The pending left-hand operand, or null when there is no operation in flight. */
  accumulator: number | null;
  pendingOp: Operator | null;
  /**
   * "typing" means the user is building the current number and a digit appends.
   * "result" means the display holds something the calculator produced, so the
   * next digit REPLACES it rather than appending to it.
   */
  entryMode: "typing" | "result";
  memory: number;
  /** Drives MRC's second-consecutive-press-clears behavior. Reset by every other key. */
  lastKeyWasMrc: boolean;
  /** Latched by divide-by-zero and by the square root of a negative. Only AC clears it. */
  error: boolean;
}

/** Digits the display will accept. Past this, further digit presses are ignored rather than silently truncating. */
const MAX_ENTRY_DIGITS = 15;

/**
 * Significant digits kept when formatting a computed result.
 *
 * Twelve, not fifteen, and the gap is doing real work: binary floating point
 * makes 0.1 + 0.2 come out as 0.30000000000000004, which at fifteen digits
 * reaches the display and reads as a broken calculator. Rounding to twelve
 * absorbs the representation error while leaving far more precision than any
 * Data Insights question needs.
 */
const DISPLAY_SIGNIFICANT_DIGITS = 12;

export const ERROR_DISPLAY = "Error";

export function initialCalculatorState(): CalculatorState {
  return {
    display: "0",
    accumulator: null,
    pendingOp: null,
    entryMode: "result",
    memory: 0,
    lastKeyWasMrc: false,
    error: false,
  };
}

/**
 * Formats a computed number the way the screen shows it.
 *
 * No thousands separators: real calculators do not group digits, and adding
 * them here would make the display disagree with the device being modeled.
 * Trailing zeros from the rounding are stripped, so 0.30000000000000004 becomes
 * "0.3" rather than "0.300000000000".
 */
function formatResult(value: number): string {
  if (!Number.isFinite(value)) return ERROR_DISPLAY;
  if (value === 0) return "0";
  const rounded = Number(value.toPrecision(DISPLAY_SIGNIFICANT_DIGITS));
  // toPrecision would hand back exponent notation for very large or very small
  // magnitudes; String() on the already-rounded number keeps the plain form
  // wherever JavaScript is willing to, which covers every realistic result.
  return String(rounded);
}

function parseDisplay(state: CalculatorState): number {
  const value = Number.parseFloat(state.display);
  return Number.isFinite(value) ? value : 0;
}

function apply(left: number, op: Operator, right: number): number | null {
  switch (op) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "*":
      return left * right;
    case "/":
      // Null is the error signal. Returning Infinity and letting the formatter
      // catch it would work, but it would also mean 1/0 and an overflow reach
      // the same branch by accident rather than by decision.
      return right === 0 ? null : left / right;
  }
}

function errored(state: CalculatorState): CalculatorState {
  return { ...state, display: ERROR_DISPLAY, accumulator: null, pendingOp: null, entryMode: "result", error: true, lastKeyWasMrc: false };
}

const DIGITS = new Set<string>(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);

/**
 * A type predicate rather than a bare `DIGITS.has(key)`, so that the switch
 * below narrows to the non-digit keys and TypeScript can prove it exhaustive.
 * With a plain boolean check the digit branch stays in the union, the switch
 * has no matching case for it, and the compiler correctly reports that the
 * function can fall through without returning. Adding a `default` would silence
 * that at the cost of the exhaustiveness check, which is the part worth having:
 * a new key added to `CalculatorKey` should fail the build here.
 */
function isDigit(key: CalculatorKey): key is Digit {
  return DIGITS.has(key);
}

/**
 * The whole calculator. One key press in, the next state out.
 *
 * Every branch clears `lastKeyWasMrc` except the MRC branch itself, which is
 * what makes "MRC twice" mean clear-memory while "MRC, 5, MRC" does not.
 */
export function press(state: CalculatorState, key: CalculatorKey): CalculatorState {
  // AC is the only way out of an error, deliberately. A calculator that
  // silently recovered on the next digit would let a student carry on from a
  // number that was never computed.
  if (state.error && key !== "allClear") return state;

  const next = { ...state, lastKeyWasMrc: false };

  if (isDigit(key)) {
    if (state.entryMode === "result") {
      return { ...next, display: key, entryMode: "typing" };
    }
    // Count significant entry positions, not string length: "-12.5" is three
    // digits typed, and charging the user for the sign and the point would cut
    // the usable entry short.
    const typed = state.display.replace(/[-.]/g, "").length;
    if (typed >= MAX_ENTRY_DIGITS) return next;
    // A bare leading zero is a placeholder, not a digit the user typed.
    const base = state.display === "0" ? "" : state.display === "-0" ? "-" : state.display;
    return { ...next, display: base + key, entryMode: "typing" };
  }

  switch (key) {
    case ".": {
      if (state.entryMode === "result") return { ...next, display: "0.", entryMode: "typing" };
      if (state.display.includes(".")) return next;
      return { ...next, display: state.display + ".", entryMode: "typing" };
    }

    case "+":
    case "-":
    case "*":
    case "/": {
      /**
       * The left-to-right rule, and the reason this file exists.
       *
       * Fold the pending operation as soon as the next operator arrives, rather
       * than holding it to compare precedence. `2 + 3 *` computes 5 the instant
       * `*` is pressed, so the 4 that follows multiplies 5, not 3.
       *
       * The `entryMode === "typing"` guard is what makes a corrected operator
       * free: pressing `+` then `*` with nothing typed between them just
       * replaces the pending operator instead of folding the accumulator into
       * itself.
       */
      if (state.pendingOp !== null && state.entryMode === "typing" && state.accumulator !== null) {
        const folded = apply(state.accumulator, state.pendingOp, parseDisplay(state));
        if (folded === null) return errored(next);
        return { ...next, display: formatResult(folded), accumulator: folded, pendingOp: key, entryMode: "result" };
      }
      return { ...next, accumulator: parseDisplay(state), pendingOp: key, entryMode: "result" };
    }

    case "=": {
      // No pending operation means no repeat of the previous one; see the
      // header note. The display simply stands.
      if (state.pendingOp === null || state.accumulator === null) {
        return { ...next, entryMode: "result" };
      }
      const result = apply(state.accumulator, state.pendingOp, parseDisplay(state));
      if (result === null) return errored(next);
      return { ...next, display: formatResult(result), accumulator: null, pendingOp: null, entryMode: "result" };
    }

    case "+/-": {
      // Works mid-entry as well as on a result, so a negative can be typed as
      // digits-then-sign the way it is on a physical calculator.
      if (state.display === "0" || state.display === ERROR_DISPLAY) return next;
      const flipped = state.display.startsWith("-") ? state.display.slice(1) : "-" + state.display;
      return { ...next, display: flipped };
    }

    case "sqrt": {
      const value = parseDisplay(state);
      if (value < 0) return errored(next);
      return { ...next, display: formatResult(Math.sqrt(value)), entryMode: "result" };
    }

    case "%": {
      // Divide by 100. See the header note on why this reading was chosen over
      // the contextual one.
      return { ...next, display: formatResult(parseDisplay(state) / 100), entryMode: "result" };
    }

    case "back": {
      // Only meaningful while typing. Backspacing a computed result would let
      // the user edit a number the calculator produced into one it never did.
      if (state.entryMode !== "typing") return next;
      const trimmed = state.display.slice(0, -1);
      if (trimmed === "" || trimmed === "-") return { ...next, display: "0", entryMode: "result" };
      return { ...next, display: trimmed };
    }

    case "clear": {
      // Clears the entry only: the pending operation and its left operand
      // survive, so a mistyped right-hand number costs one key, not the sum.
      return { ...next, display: "0", entryMode: "result" };
    }

    case "allClear": {
      // Everything except memory, which is the convention on every calculator
      // that has both keys, and which is what makes the memory workaround for
      // the left-to-right quirk usable at all: AC between the two products has
      // to preserve what M+ just stored.
      return { ...initialCalculatorState(), memory: state.memory };
    }

    case "mrc": {
      /**
       * First press recalls, a second CONSECUTIVE press clears. That is the
       * Focus rendering, and it is why this is the one branch that sets
       * `lastKeyWasMrc` instead of clearing it.
       */
      if (state.lastKeyWasMrc) {
        return { ...next, memory: 0, lastKeyWasMrc: false };
      }
      return { ...next, display: formatResult(state.memory), entryMode: "result", lastKeyWasMrc: true };
    }

    case "m+":
      return { ...next, memory: state.memory + parseDisplay(state), entryMode: "result" };

    case "m-":
      return { ...next, memory: state.memory - parseDisplay(state), entryMode: "result" };
  }
}

/** Whether to light the `M` indicator. Without it there is no way to tell whether an M+ registered. */
export function hasMemory(state: CalculatorState): boolean {
  return state.memory !== 0;
}
