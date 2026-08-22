/**
 * THE DATA INSIGHTS CALCULATOR, AS A PURE REDUCER.
 *
 * Models the on-screen calculator the GMAT Focus Edition provides in Data
 * Insights, and ONLY in Data Insights. Quantitative Reasoning does not get one,
 * which is a deliberate property of that section rather than an oversight; see
 * `SectionConfig.calculator` in `lib/exams/types.ts`.
 *
 * No React, no DOM, no imports. That is what lets `npm run verify:engine`
 * assert its behavior directly, which matters more here than usual: several of
 * the behaviors below look exactly like bugs, so the thing that stops a future
 * reader from "fixing" them is an assertion that fails when they do.
 *
 * ── What it actually is ──────────────────────────────────────────────────
 *
 * An emulated TEXAS INSTRUMENTS TI-108, the classroom four-function
 * calculator. That identification is what makes the rest of this file
 * checkable rather than guessed: the TI-108 is documented, so every quirk
 * below has a source instead of a plausible-sounding invention.
 *
 * The key set is exactly: 0-9, `.`, the four operators, `=`, `ON/C`, `+/-`,
 * `√`, `%`, and `M+` / `M-` / `MRC`. Nothing else. In particular there is NO
 * backspace, no parentheses, no exponent key, and no `1/x`.
 *
 * A caution for anyone re-researching this: a lot of prep material still
 * describes the PRE-FOCUS Integrated Reasoning calculator, which had
 * `MS`/`MR`/`MC`, separate `BS`/`CE`/`CA` clear keys, and a `1/x` key. If a
 * source lists `1/x`, it is describing the old device and its other details
 * should not be trusted for Focus either.
 *
 * ── The headline behavior ────────────────────────────────────────────────
 *
 * IT EVALUATES STRICTLY LEFT TO RIGHT AND IGNORES ORDER OF OPERATIONS.
 *
 *     2 + 3 * 4 =   ->   20     (not 14)
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
 * ── Three more quirks, all real, all asserted ────────────────────────────
 *
 *  1. `%` IS CONTEXTUAL, not a plain divide-by-100. With a pending `+` or `-`
 *     it computes the percentage OF THE ACCUMULATOR and leaves it on the
 *     display: `12 + 10 %` shows 1.2, and `=` then gives 13.2. With `*`, `/`,
 *     or nothing pending it divides by 100: `10 %` shows 0.1.
 *
 *  2. REPEATED `=` REPEATS THE LAST OPERATION (the TI-108's "automatic
 *     constant"). `3 + 2 * 5 = = =` gives 625, because the first `=` yields 25
 *     and each further `=` multiplies by 5 again.
 *
 *  3. THE DISPLAY IS EIGHT DIGITS. Anything outside -99,999,999 to 99,999,999
 *     is an overflow: the display errors and only `ON/C` recovers. This is
 *     tighter than it sounds and is reachable in real Data Insights arithmetic,
 *     which is exactly why modeling it matters. A product that errors on test
 *     day must not quietly succeed here.
 *
 * An earlier revision of this file implemented divide-by-100, made repeated `=`
 * inert, allowed 15 digits, and had a backspace key, each with a comment saying
 * the real behavior was unverifiable. It was verifiable; the comments were
 * wrong and were stopping exactly the fix they should have prompted. If you
 * find yourself writing "could not be verified" here, look harder first.
 *
 * ── The one thing still uncertain ────────────────────────────────────────
 *
 * What a REPEATED OPERATOR does. The TI-108's automatic constant suggests
 * `3 + +` applies the operation to the display and yields 6. Our behavior is
 * that a second operator simply replaces the pending one, so `9 + * 3` is
 * 9 * 3. The only sources describing this do so through a third-party
 * simulator's own MDAS toggle, which is a simulator feature rather than an
 * exam one, so this is left as the simpler behavior and flagged rather than
 * guessed at. Correcting a mistyped operator is also the far more common
 * reason a student presses two in a row.
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
  /** The single clear key. One press clears the entry, a second clears everything. */
  | "onC"
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
  /**
   * Whether the display holds a right-hand operand the pending operation should
   * consume.
   *
   * SEPARATE FROM `entryMode`, and the separation is load-bearing. An earlier
   * revision used `entryMode === "typing"` as the fold condition, which
   * conflated "the next digit replaces the display" with "an operand has been
   * supplied since the operator". Those come apart for every key that produces
   * a value without typing one: `√`, `%`, `MRC` and a cleared entry all leave a
   * real operand on screen in "result" mode. The operator branch then failed
   * its guard and overwrote the accumulator, silently discarding the left-hand
   * side, so `2 + 9 √ * 4 =` gave 12 instead of 20.
   *
   * The tell that this was a bug rather than a quirk of the real device: `=`
   * and the operator branch disagreed about identical state. `2 + 9 √ =` gave
   * 5 while `2 + 9 √ + 0 =` gave 3. A calculator may be strange, but it may not
   * contradict itself.
   */
  operandReady: boolean;
  /**
   * The operation and right-hand operand a further `=` should repeat. This is
   * the TI-108's automatic constant; see quirk 2 in the header.
   */
  repeat: { op: Operator; operand: number } | null;
  memory: number;
  /** Drives MRC's second-consecutive-press-clears behavior. Reset by every other key. */
  lastKeyWasMrc: boolean;
  /** Drives ON/C's second-consecutive-press-clears-everything behavior. Reset by every other key. */
  lastKeyWasClear: boolean;
  /** Latched by overflow, divide-by-zero, and the root of a negative. Only ON/C clears it. */
  error: boolean;
}

/**
 * Eight digits, because the real display is eight digits.
 *
 * This is deliberately far tighter than a JavaScript number needs, and the
 * tightness IS the fidelity: a Data Insights product that overflows on test day
 * has to overflow here too, or the practice teaches a calculation the exam will
 * refuse to perform.
 */
const MAX_ENTRY_DIGITS = 8;
const OVERFLOW_LIMIT = 99999999;

/**
 * Below this the display shows zero. Eight digits leaves seven decimal places
 * once the leading "0." is spent, so anything smaller cannot be rendered and
 * the device shows 0 rather than switching to exponent notation, which it has
 * no way to display.
 */
const UNDERFLOW_LIMIT = 1e-7;

export const ERROR_DISPLAY = "Error";

export function initialCalculatorState(): CalculatorState {
  return {
    display: "0",
    accumulator: null,
    pendingOp: null,
    entryMode: "result",
    operandReady: true,
    repeat: null,
    memory: 0,
    lastKeyWasMrc: false,
    lastKeyWasClear: false,
    error: false,
  };
}

/**
 * Formats a computed number for an eight-digit display, or returns null when it
 * cannot be shown at all and the caller should error instead.
 *
 * Never emits exponent notation. An earlier revision used `String()` on the
 * rounded value and claimed in a comment that the plain form "covers every
 * realistic result"; it does not, because `String()` switches to exponent form
 * below 1e-6 and at 1e21. `1 / 10000000 =` is nine keystrokes and displayed
 * "1e-7", which no four-function calculator has ever shown.
 *
 * No thousands separators either: real calculators do not group digits.
 */
function formatResult(value: number): string | null {
  if (!Number.isFinite(value)) return null;
  if (Math.abs(value) > OVERFLOW_LIMIT) return null;
  if (value === 0 || Math.abs(value) < UNDERFLOW_LIMIT) return "0";

  // Spend the eight digits on the integer part first, then give whatever is
  // left to the decimals, which is how a fixed-width display behaves.
  const integerDigits = Math.max(1, Math.floor(Math.log10(Math.abs(value))) + 1);
  const decimals = Math.max(0, MAX_ENTRY_DIGITS - integerDigits);
  const fixed = value.toFixed(decimals);
  // Trailing zeros are an artifact of toFixed, not something the device shows.
  const trimmed = decimals > 0 ? fixed.replace(/\.?0+$/, "") : fixed;
  return trimmed === "" || trimmed === "-" || trimmed === "-0" ? "0" : trimmed;
}

function parseDisplay(state: CalculatorState): number {
  const value = Number.parseFloat(state.display);
  return Number.isFinite(value) ? value : 0;
}

/** Null means "this cannot be shown": a division by zero, or a result past the display's range. */
function apply(left: number, op: Operator, right: number): number | null {
  switch (op) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "*":
      return left * right;
    case "/":
      return right === 0 ? null : left / right;
  }
}

function errored(state: CalculatorState): CalculatorState {
  return {
    ...state,
    display: ERROR_DISPLAY,
    accumulator: null,
    pendingOp: null,
    repeat: null,
    entryMode: "result",
    operandReady: false,
    error: true,
    lastKeyWasMrc: false,
    lastKeyWasClear: false,
  };
}

const DIGITS = new Set<string>(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);

/**
 * A type predicate rather than a bare `DIGITS.has(key)`, so that the switch
 * below narrows to the non-digit keys and TypeScript can prove it exhaustive.
 * A `default` case would silence the fall-through warning at the cost of that
 * check, which is the part worth having: a new key added to `CalculatorKey`
 * should fail the build here.
 */
function isDigit(key: CalculatorKey): key is Digit {
  return DIGITS.has(key);
}

/**
 * The whole calculator. One key press in, the next state out.
 *
 * Every branch derives from `next`, which clears both consecutive-press flags,
 * except the MRC and ON/C branches themselves. That is what makes "MRC twice"
 * mean clear-memory while "MRC, 5, MRC" does not.
 */
export function press(state: CalculatorState, key: CalculatorKey): CalculatorState {
  // ON/C is the only way out of an error, deliberately, and it is what the real
  // device requires too. A calculator that silently recovered on the next digit
  // would let a student carry on from a number that was never computed.
  if (state.error && key !== "onC") return state;

  const next = { ...state, lastKeyWasMrc: false, lastKeyWasClear: false };

  if (isDigit(key)) {
    if (state.entryMode === "result") {
      return { ...next, display: key, entryMode: "typing", operandReady: true };
    }
    // Count significant entry positions, not string length: "-12.5" is three
    // digits typed, and charging the user for the sign and the point would cut
    // the usable entry short.
    const typed = state.display.replace(/[-.]/g, "").length;
    if (typed >= MAX_ENTRY_DIGITS) return next;
    // A bare leading zero is a placeholder, not a digit the user typed.
    const base = state.display === "0" ? "" : state.display === "-0" ? "-" : state.display;
    return { ...next, display: base + key, entryMode: "typing", operandReady: true };
  }

  switch (key) {
    case ".": {
      if (state.entryMode === "result") {
        return { ...next, display: "0.", entryMode: "typing", operandReady: true };
      }
      if (state.display.includes(".")) return next;
      return { ...next, display: state.display + ".", entryMode: "typing", operandReady: true };
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
       * `operandReady` is what makes a corrected operator free: pressing `+`
       * then `*` with nothing supplied between them replaces the pending
       * operator instead of folding the accumulator into itself. See the field's
       * own comment for why this is not `entryMode`.
       */
      if (state.pendingOp !== null && state.operandReady && state.accumulator !== null) {
        const folded = apply(state.accumulator, state.pendingOp, parseDisplay(state));
        const shown = folded === null ? null : formatResult(folded);
        if (folded === null || shown === null) return errored(next);
        return {
          ...next,
          display: shown,
          accumulator: folded,
          pendingOp: key,
          entryMode: "result",
          operandReady: false,
          repeat: null,
        };
      }
      return {
        ...next,
        accumulator: parseDisplay(state),
        pendingOp: key,
        entryMode: "result",
        operandReady: false,
        repeat: null,
      };
    }

    case "=": {
      /**
       * Two paths. A pending operation resolves and is REMEMBERED; with nothing
       * pending, a remembered one repeats. That is the automatic constant, and
       * it is why `3 + 2 * 5 = = =` is 625 rather than 25: the first `=` gives
       * 25 and each further one multiplies by 5 again.
       */
      if (state.pendingOp !== null && state.accumulator !== null) {
        const operand = parseDisplay(state);
        const result = apply(state.accumulator, state.pendingOp, operand);
        const shown = result === null ? null : formatResult(result);
        if (result === null || shown === null) return errored(next);
        return {
          ...next,
          display: shown,
          accumulator: null,
          pendingOp: null,
          entryMode: "result",
          operandReady: true,
          repeat: { op: state.pendingOp, operand },
        };
      }
      if (state.repeat !== null) {
        const result = apply(parseDisplay(state), state.repeat.op, state.repeat.operand);
        const shown = result === null ? null : formatResult(result);
        if (result === null || shown === null) return errored(next);
        return { ...next, display: shown, entryMode: "result", operandReady: true };
      }
      return { ...next, entryMode: "result", operandReady: true };
    }

    case "+/-": {
      // Works mid-entry as well as on a result, so a negative can be typed as
      // digits-then-sign the way it is on a physical calculator.
      if (state.display === "0") return { ...next, operandReady: true };
      const flipped = state.display.startsWith("-") ? state.display.slice(1) : "-" + state.display;
      return { ...next, display: flipped, operandReady: true };
    }

    case "sqrt": {
      const value = parseDisplay(state);
      if (value < 0) return errored(next);
      const shown = formatResult(Math.sqrt(value));
      if (shown === null) return errored(next);
      return { ...next, display: shown, entryMode: "result", operandReady: true };
    }

    case "%": {
      /**
       * Contextual, not a plain divide-by-100, and this is the behavior an
       * earlier revision got backwards while claiming it was unverifiable.
       *
       * With a pending `+` or `-` it means "this percent OF the running total":
       * `12 + 10 %` shows 1.2, and `=` then gives 13.2. With `*`, `/`, or
       * nothing pending there is no base to take a percentage of, so it simply
       * divides by 100 and `10 %` shows 0.1.
       */
      const value = parseDisplay(state);
      const base =
        (state.pendingOp === "+" || state.pendingOp === "-") && state.accumulator !== null
          ? state.accumulator * (value / 100)
          : value / 100;
      const shown = formatResult(base);
      if (shown === null) return errored(next);
      return { ...next, display: shown, entryMode: "result", operandReady: true };
    }

    case "onC": {
      /**
       * One key, two behaviors, exactly as on the device: the first press
       * clears the entry and keeps the pending operation, so a mistyped
       * right-hand number costs one key rather than the whole sum; a second
       * consecutive press clears the calculation as well.
       *
       * Memory survives both. It is cleared with MRC twice, which is what makes
       * the memory workaround for the left-to-right quirk usable at all: the
       * clear between the two products has to preserve what M+ just stored.
       */
      if (state.lastKeyWasClear && !state.error) {
        return { ...initialCalculatorState(), memory: state.memory };
      }
      return {
        ...next,
        display: "0",
        entryMode: "result",
        operandReady: true,
        error: false,
        lastKeyWasClear: true,
      };
    }

    case "mrc": {
      /**
       * First press recalls, a second CONSECUTIVE press clears. That is the
       * Focus key set, and it is why this is one of the two branches that sets
       * its own consecutive-press flag rather than clearing it.
       */
      if (state.lastKeyWasMrc) {
        return { ...next, memory: 0, lastKeyWasMrc: false };
      }
      const shown = formatResult(state.memory);
      if (shown === null) return errored(next);
      return {
        ...next,
        display: shown,
        entryMode: "result",
        operandReady: true,
        lastKeyWasMrc: true,
      };
    }

    case "m+":
    case "m-": {
      /**
       * Memory has the same eight-digit ceiling as the display, and pushing it
       * past that errors rather than storing a number the device could never
       * show. The existing memory is left intact when that happens.
       *
       * Neither key touches the display, so `operandReady` is deliberately left
       * alone: `2 + 3 M+ * 4` still has 3 sitting there as a live operand.
       */
      const updated = key === "m+" ? state.memory + parseDisplay(state) : state.memory - parseDisplay(state);
      if (!Number.isFinite(updated) || Math.abs(updated) > OVERFLOW_LIMIT) return errored(next);
      return { ...next, memory: updated, entryMode: "result" };
    }
  }
}

/** Whether to light the `M` indicator. Without it there is no way to tell whether an M+ registered. */
export function hasMemory(state: CalculatorState): boolean {
  return state.memory !== 0;
}
