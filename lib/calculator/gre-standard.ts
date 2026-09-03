/**
 * THE GRE ON-SCREEN CALCULATOR, AS A PURE REDUCER.
 *
 * Models the calculator ETS provides in Quantitative Reasoning. Like
 * `basic-di.ts` it has no React, no DOM and no imports, which is what lets
 * `npm run verify:engine` assert its behavior directly.
 *
 * ── IT IS NOT THE GMAT'S CALCULATOR, AND THAT IS THE WHOLE POINT ──────────
 *
 * `basic-di.ts` models a TI-108: strictly left to right, so `2 + 3 x 4` is 20.
 * This device honors order of operations and gives 14. It also has parentheses,
 * a memory subtract, a Transfer Display key, and it accepts typing. Sharing one
 * model between the two would teach a candidate the wrong arithmetic for
 * whichever exam they are not taking, and this repo has already shipped a
 * calculator that borrowed three details from the wrong device.
 *
 * Behaviors taken from ETS's description and from the published behavior of the
 * delivered device:
 *
 *  - **Order of operations.** Multiplication and division bind tighter than
 *    addition and subtraction, and parentheses override both.
 *  - **Eight-digit display.** A result that cannot be shown in eight digits is
 *    an error, and so is a memory value past the same ceiling.
 *  - **ERROR on divide by zero and on the square root of a negative.** Only
 *    `C` recovers.
 *  - **Memory is one register**: `M+` adds the display to it, `M-` subtracts,
 *    `MR` recalls it to the display, `MC` clears it. An indicator shows while
 *    it holds a value.
 *  - **Transfer Display** hands the current value to the answer box. That is a
 *    UI action rather than a state change, so it is not modeled here beyond
 *    exposing the value through `displayValue`.
 *
 * ── DELIBERATELY NOT MODELED ─────────────────────────────────────────────
 *
 * There is no exponent, logarithm, pi or trigonometric key on the real device,
 * so there is none here. A percent key is absent for the same reason: the GMAT
 * device has one and this one does not.
 *
 * ── ONE THING THAT IS GENUINELY UNKNOWN ──────────────────────────────────
 *
 * What the device does with an unmatched closing parenthesis is not documented
 * anywhere reliable. It is ignored here, which is the conservative reading: a
 * stray `)` cannot corrupt an expression the candidate has already entered.
 */

export type GreOperator = "+" | "-" | "*" | "/";

export type GreCalculatorKey =
  | "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
  | "."
  | GreOperator
  | "="
  | "("
  | ")"
  | "sqrt"
  | "negate"
  | "C"
  | "M+"
  | "M-"
  | "MR"
  | "MC";

/** A committed piece of the expression. Numbers arrive as values, never as text. */
type Token =
  | { kind: "number"; value: number }
  | { kind: "op"; value: GreOperator }
  | { kind: "open" }
  | { kind: "close" };

export interface GreCalculatorState {
  /** Exactly what the display shows. */
  display: string;
  /** The expression committed so far. The number being typed is NOT in here. */
  tokens: Token[];
  /**
   * The digits being typed, or null when the display is showing a result
   * rather than an entry. The distinction decides whether the next digit
   * appends or starts fresh.
   */
  entry: string | null;
  memory: number;
  error: boolean;
}

const MAX_DIGITS = 8;
const OVERFLOW_LIMIT = 99999999;
const UNDERFLOW_LIMIT = 1e-7;

export const GRE_ERROR_DISPLAY = "Error";

export function initialGreCalculatorState(): GreCalculatorState {
  return { display: "0", tokens: [], entry: null, memory: 0, error: false };
}

export function hasGreMemory(state: GreCalculatorState): boolean {
  return state.memory !== 0;
}

/** The number the display currently stands for, for Transfer Display. */
export function displayValue(state: GreCalculatorState): number | null {
  if (state.error) return null;
  const parsed = Number.parseFloat(state.display);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Format a value for an eight-digit display.
 *
 * Identical in spirit to the GMAT device's: spend the digits on the integer
 * part first, judge overflow AFTER rounding because the limit is about what can
 * be shown, and never show the trailing zeros `toFixed` invents.
 */
function format(value: number): string | null {
  if (!Number.isFinite(value)) return null;
  if (value === 0 || Math.abs(value) < UNDERFLOW_LIMIT) return "0";

  const integerDigits = Math.max(1, Math.floor(Math.log10(Math.abs(value))) + 1);
  const decimals = Math.max(0, MAX_DIGITS - integerDigits);
  const fixed = value.toFixed(decimals);
  if (Math.abs(Number.parseFloat(fixed)) > OVERFLOW_LIMIT) return null;

  const trimmed = decimals > 0 ? fixed.replace(/\.?0+$/, "") : fixed;
  return trimmed === "" || trimmed === "-" || trimmed === "-0" ? "0" : trimmed;
}

function errored(state: GreCalculatorState): GreCalculatorState {
  return { ...state, display: GRE_ERROR_DISPLAY, tokens: [], entry: null, error: true };
}

/** How many digits the entry already holds, ignoring the sign and the point. */
function digitCount(entry: string): number {
  return entry.replace(/[-.]/g, "").length;
}

const DIGITS = new Set(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);

/**
 * Evaluate a committed token list.
 *
 * A two-stage shunting-yard: to RPN honoring precedence and parentheses, then a
 * stack evaluation. Returns null on any arithmetic the device refuses, which
 * the caller turns into ERROR.
 */
function evaluate(tokens: Token[]): number | null {
  const output: Token[] = [];
  const ops: Token[] = [];
  const precedence = (op: GreOperator) => (op === "*" || op === "/" ? 2 : 1);

  for (const token of tokens) {
    if (token.kind === "number") {
      output.push(token);
    } else if (token.kind === "op") {
      while (ops.length > 0) {
        const top = ops[ops.length - 1];
        if (top.kind !== "op" || precedence(top.value) < precedence(token.value)) break;
        output.push(ops.pop()!);
      }
      ops.push(token);
    } else if (token.kind === "open") {
      ops.push(token);
    } else {
      let matched = false;
      while (ops.length > 0) {
        const top = ops.pop()!;
        if (top.kind === "open") {
          matched = true;
          break;
        }
        output.push(top);
      }
      // An unmatched close is ignored rather than failing the expression.
      if (!matched) continue;
    }
  }
  while (ops.length > 0) {
    const top = ops.pop()!;
    if (top.kind === "open") continue;
    output.push(top);
  }

  const stack: number[] = [];
  for (const token of output) {
    if (token.kind === "number") {
      stack.push(token.value);
      continue;
    }
    if (token.kind !== "op") continue;
    const right = stack.pop();
    const left = stack.pop();
    if (left === undefined || right === undefined) return null;
    if (token.value === "/" && right === 0) return null;
    const result =
      token.value === "+"
        ? left + right
        : token.value === "-"
          ? left - right
          : token.value === "*"
            ? left * right
            : left / right;
    if (!Number.isFinite(result)) return null;
    stack.push(result);
  }
  return stack.length === 1 ? stack[0] : null;
}

/** The value the display stands for right now, entry or result. */
function currentValue(state: GreCalculatorState): number {
  const parsed = Number.parseFloat(state.entry ?? state.display);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Commit whatever is on the display as a number token, unless the previous
 * token already supplied one (which happens after a `)`).
 */
function commitEntry(state: GreCalculatorState): Token[] {
  const previous = state.tokens[state.tokens.length - 1];
  if (state.entry === null && previous && (previous.kind === "number" || previous.kind === "close")) {
    return state.tokens;
  }
  return [...state.tokens, { kind: "number", value: currentValue(state) }];
}

export function pressGre(
  state: GreCalculatorState,
  key: GreCalculatorKey
): GreCalculatorState {
  // Only C recovers from an error, exactly as on the device.
  if (state.error && key !== "C") return state;

  /*
   * C clears the CALCULATION, never the memory. That is what MC is for, and
   * the separation is the whole reason memory is useful on a device with no
   * order-of-operations escape hatch: you bank a subtotal, clear, and carry on.
   * An earlier version returned the initial state wholesale and silently wiped
   * the register.
   */
  if (key === "C") return { ...initialGreCalculatorState(), memory: state.memory };

  if (DIGITS.has(key)) {
    const entry = state.entry ?? "";
    if (digitCount(entry) >= MAX_DIGITS) return state;
    // A leading zero is replaced rather than appended to.
    const next = entry === "" || entry === "0" ? key : entry + key;
    return { ...state, entry: next, display: next };
  }

  if (key === ".") {
    const entry = state.entry ?? "";
    if (entry.includes(".")) return state;
    const next = entry === "" ? "0." : entry + ".";
    return { ...state, entry: next, display: next };
  }

  if (key === "negate") {
    const entry = state.entry;
    if (entry !== null) {
      const next = entry.startsWith("-") ? entry.slice(1) : "-" + entry;
      return { ...state, entry: next, display: next };
    }
    const flipped = format(-currentValue(state));
    if (flipped === null) return errored(state);
    return { ...state, display: flipped };
  }

  if (key === "sqrt") {
    const value = currentValue(state);
    if (value < 0) return errored(state);
    const shown = format(Math.sqrt(value));
    if (shown === null) return errored(state);
    // The root REPLACES the entry, so the next digit starts a new number.
    return { ...state, display: shown, entry: null };
  }

  if (key === "(") {
    // Only where a number could begin. After a number or a close it would be
    // an implied multiplication, which this device does not do.
    const previous = state.tokens[state.tokens.length - 1];
    if (state.entry !== null) return state;
    if (previous && (previous.kind === "number" || previous.kind === "close")) return state;
    return { ...state, tokens: [...state.tokens, { kind: "open" }] };
  }

  if (key === ")") {
    const open = state.tokens.filter((t) => t.kind === "open").length;
    const close = state.tokens.filter((t) => t.kind === "close").length;
    if (open <= close) return state;
    const tokens = commitEntry(state);
    const last = tokens[tokens.length - 1];
    if (!last || last.kind === "op" || last.kind === "open") return state;
    return { ...state, tokens: [...tokens, { kind: "close" }], entry: null };
  }

  if (key === "+" || key === "-" || key === "*" || key === "/") {
    const previous = state.tokens[state.tokens.length - 1];
    // A second operator replaces the pending one, which is the commoner intent
    // when correcting a mistype.
    if (state.entry === null && previous && previous.kind === "op") {
      return { ...state, tokens: [...state.tokens.slice(0, -1), { kind: "op", value: key }] };
    }
    const tokens = commitEntry(state);
    return { ...state, tokens: [...tokens, { kind: "op", value: key }], entry: null };
  }

  if (key === "=") {
    const tokens = commitEntry(state);
    // Close anything still open, so an unbalanced expression still evaluates.
    const open = tokens.filter((t) => t.kind === "open").length;
    const close = tokens.filter((t) => t.kind === "close").length;
    const balanced: Token[] = [...tokens];
    for (let i = 0; i < open - close; i += 1) balanced.push({ kind: "close" });

    const result = evaluate(balanced);
    if (result === null) return errored(state);
    const shown = format(result);
    if (shown === null) return errored(state);
    return { ...state, display: shown, tokens: [], entry: null };
  }

  if (key === "MC") return { ...state, memory: 0 };

  if (key === "MR") {
    const shown = format(state.memory);
    if (shown === null) return errored(state);
    return { ...state, display: shown, entry: null };
  }

  if (key === "M+" || key === "M-") {
    const delta = currentValue(state);
    const next = key === "M+" ? state.memory + delta : state.memory - delta;
    // Memory obeys the same ceiling the display does.
    if (format(next) === null) return errored(state);
    return { ...state, memory: next };
  }

  return state;
}
