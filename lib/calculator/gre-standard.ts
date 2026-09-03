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
 *  - **Transfer Display** hands the current value to the answer box. The value
 *    is exposed through `displayValue`, but NOTHING IS WIRED to the Numeric
 *    Entry field yet, so a candidate reads the display and retypes it. The cost
 *    is a habit rather than an answer: on test day the key exists.
 *
 * ── DELIBERATELY NOT MODELED ─────────────────────────────────────────────
 *
 * There is no exponent, logarithm, pi or trigonometric key on the real device,
 * so there is none here. A percent key is absent for the same reason: the GMAT
 * device has one and this one does not.
 *
 * ── NOT MODELED, AND WORTH KNOWING ───────────────────────────────────────
 *
 * There is no keyboard entry. The real device accepts typing; this one does not,
 * for the same fidelity reason `basic-di.ts` gives at length.
 *
 * ── TWO THINGS THAT ARE GENUINELY UNKNOWN ────────────────────────────────
 *
 * What the device does with an unmatched closing parenthesis is not documented
 * anywhere reliable. It is ignored here, which is the conservative reading: a
 * stray `)` cannot corrupt an expression the candidate has already entered.
 *
 * Whether a repeated `=` repeats the last operation is also undocumented. The
 * GMAT's TI-108 does (its "automatic constant", asserted in verify:engine), and
 * this one does NOT, which is a real divergence between the two devices that
 * rests on an absence of evidence rather than on evidence of absence.
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
  /**
   * True when the DISPLAY holds an operand that is not yet in `tokens`.
   *
   * SEPARATE FROM `entry` ON PURPOSE, and this is the single most important
   * field in the file. `entry` means "the next digit appends", which is NOT the
   * same as "an operand is available": `sqrt`, `MR`, `negate` on a result, and a
   * closed parenthesis all produce a value with `entry` still null.
   *
   * Overloading `entry === null` as the fold condition is the exact bug
   * PROJECT_CONTEXT records against the GMAT device under "Do not overload
   * `entryMode`", and this reducer reproduced it verbatim: `2 + 9 √ × 4 =`
   * returned 8, because the operator branch read "no operand supplied", threw
   * away the 3 the square root had just produced, and replaced the `+` with the
   * `×`.
   */
  operandReady: boolean;
  memory: number;
  error: boolean;
}

const MAX_DIGITS = 8;
const OVERFLOW_LIMIT = 99999999;
const UNDERFLOW_LIMIT = 1e-7;

export const GRE_ERROR_DISPLAY = "Error";

export function initialGreCalculatorState(): GreCalculatorState {
  return { display: "0", tokens: [], entry: null, operandReady: false, memory: 0, error: false };
}

export function hasGreMemory(state: GreCalculatorState): boolean {
  return state.memory !== 0;
}

/**
 * How many parentheses are open.
 *
 * The `(` and `)` keys change nothing on the display, so without this the only
 * feedback for either is the eventual answer. A candidate who opens one and
 * forgets has no way to see it, and `(` is silently refused where it would be
 * an implied multiply, so `5 ( 3 ) =` shows 53 with no signal that anything was
 * rejected.
 */
export function openParenCount(state: GreCalculatorState): number {
  const open = state.tokens.filter((t) => t.kind === "open").length;
  const close = state.tokens.filter((t) => t.kind === "close").length;
  return Math.max(0, open - close);
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
  return {
    ...state,
    display: GRE_ERROR_DISPLAY,
    tokens: [],
    entry: null,
    operandReady: false,
    error: true,
  };
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
/**
 * Commit the display as an operand, but ONLY when there genuinely is one.
 *
 * An earlier version fell back to pushing `parseFloat(display)` whenever the
 * previous token was not a number, which invented an operand out of whatever
 * happened to be on screen: `2 + ( ) =` pulled the stale 2 into the parentheses
 * and returned 4.
 */
function commitEntry(state: GreCalculatorState): Token[] {
  if (state.entry !== null || state.operandReady) {
    return [...state.tokens, { kind: "number", value: currentValue(state) }];
  }
  return state.tokens;
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
    // "-0" is the sign-flipped empty entry, so a digit replaces the zero and
    // keeps the sign. Without this, 0 +/- 5 displayed "-05".
    const next =
      entry === "" || entry === "0" ? key : entry === "-0" ? "-" + key : entry + key;
    return { ...state, entry: next, display: next, operandReady: false };
  }

  if (key === ".") {
    const entry = state.entry ?? "";
    if (entry.includes(".")) return state;
    const next = entry === "" ? "0." : entry + ".";
    return { ...state, entry: next, display: next, operandReady: false };
  }

  if (key === "negate") {
    const entry = state.entry;
    if (entry !== null) {
      const next = entry.startsWith("-") ? entry.slice(1) : "-" + entry;
      return { ...state, entry: next, display: next };
    }
    const flipped = format(-currentValue(state));
    if (flipped === null) return errored(state);
    // The flipped value IS an operand, even though nobody typed it.
    return { ...state, display: flipped, operandReady: true };
  }

  if (key === "sqrt") {
    const value = currentValue(state);
    if (value < 0) return errored(state);
    const shown = format(Math.sqrt(value));
    if (shown === null) return errored(state);
    // The root REPLACES the entry, so the next digit starts a new number, but
    // the value it produced is an operand and must not be thrown away.
    return { ...state, display: shown, entry: null, operandReady: true };
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

    /*
     * Reject an empty or dangling group BEFORE committing anything.
     *
     * The guard used to run after `commitEntry`, which had already pushed
     * `parseFloat(display)` and made the check unreachable: `2 + ( ) =` pulled
     * the stale 2 into the parentheses and returned 4.
     */
    const lastCommitted = state.tokens[state.tokens.length - 1];
    const haveOperand = state.entry !== null || state.operandReady;
    if (!haveOperand && (!lastCommitted || lastCommitted.kind === "op" || lastCommitted.kind === "open")) {
      return state;
    }

    /*
     * COLLAPSE the closed group to its value.
     *
     * The group is evaluated and replaced by a single number token, which does
     * three things at once: the display shows what the parentheses are worth,
     * `sqrt` and `negate` pressed next operate on that subtotal rather than on
     * the last number typed inside it, and the value cannot be dropped. Before
     * this, `( 2 + 3 ) √ =` showed the square root of 3 and then returned 5.
     */
    const tokens = commitEntry(state);
    let depth = 0;
    let openIndex = -1;
    for (let i = tokens.length - 1; i >= 0; i -= 1) {
      const token = tokens[i];
      if (token.kind === "close") depth += 1;
      else if (token.kind === "open") {
        if (depth === 0) {
          openIndex = i;
          break;
        }
        depth -= 1;
      }
    }
    if (openIndex < 0) return state;

    const inner = evaluate(tokens.slice(openIndex + 1));
    if (inner === null) return errored(state);
    const shown = format(inner);
    if (shown === null) return errored(state);

    /*
     * The group LEAVES the token list and lives on the display as an
     * uncommitted operand, rather than being pushed back as a number token.
     *
     * Both would show the right value, and only this one composes: the next
     * operator commits it exactly once. Writing it back as a token AND flagging
     * it ready pushed it twice, so `( 2 + 3 ) * 4 =` became two operands with no
     * operator between them and errored.
     */
    return {
      ...state,
      tokens: tokens.slice(0, openIndex),
      display: shown,
      entry: null,
      operandReady: true,
    };
  }

  if (key === "+" || key === "-" || key === "*" || key === "/") {
    const previous = state.tokens[state.tokens.length - 1];
    /*
     * A second operator replaces the pending one, which is the commoner intent
     * when correcting a mistype.
     *
     * The condition is `!operandReady`, NOT `entry === null`. A square root, a
     * memory recall, a sign flip or a closed group all leave `entry` null while
     * the display holds a real operand, and reading that as "nothing was
     * supplied" ate both the value and the previous operator.
     */
    if (state.entry === null && !state.operandReady && previous && previous.kind === "op") {
      return { ...state, tokens: [...state.tokens.slice(0, -1), { kind: "op", value: key }] };
    }
    const tokens = commitEntry(state);
    return {
      ...state,
      tokens: [...tokens, { kind: "op", value: key }],
      entry: null,
      operandReady: false,
    };
  }

  if (key === "=") {
    /*
     * Normalize before evaluating, and the ORDER matters.
     *
     * Balance first, because an unclosed group only BECOMES an empty group once
     * its closing parenthesis is supplied: `2 + ( =` is `2 + ( )`, and cleaning
     * before balancing left the open paren to starve the `+` of its right-hand
     * operand and error.
     *
     * Then drop empty groups, then any trailing operator. Both are mistypes
     * rather than reasons to refuse the whole sum, which is the forgiving
     * reading a candidate under time pressure needs.
     */
    const tokens = [...commitEntry(state)];

    const open = tokens.filter((tok) => tok.kind === "open").length;
    const close = tokens.filter((tok) => tok.kind === "close").length;
    for (let i = 0; i < open - close; i += 1) tokens.push({ kind: "close" });

    // Run to a fixpoint: removing one dangling operator can expose an empty
    // group, and removing that can expose another dangling operator.
    for (let pass = 0; pass < 8; pass += 1) {
      const before = tokens.length;
      for (let i = tokens.length - 2; i >= 0; i -= 1) {
        // Re-read the neighbour each pass: an earlier splice in this same loop
        // shrinks the array, so tokens[i + 1] can be gone by the time i reaches
        // it. Without this the loop threw on ( 2 + 3 ) 5 =.
        const here = tokens[i];
        const next = tokens[i + 1];
        if (!here || !next) continue;
        // An operator with nothing after it inside a group, then the empty group.
        if (here.kind === "op" && next.kind === "close") tokens.splice(i, 1);
        else if (here.kind === "open" && next.kind === "close") tokens.splice(i, 2);
      }
      while (tokens.length > 0 && tokens[tokens.length - 1].kind === "op") tokens.pop();
      if (tokens.length === before) break;
    }

    // Nothing entered at all: equals is a no-op, not an error.
    if (tokens.length === 0) return state;

    const result = evaluate(tokens);
    if (result === null) return errored(state);
    const shown = format(result);
    if (shown === null) return errored(state);
    // The result is the left operand of whatever the user types next.
    return { ...state, display: shown, tokens: [], entry: null, operandReady: true };
  }

  if (key === "MC") return { ...state, memory: 0 };

  if (key === "MR") {
    const shown = format(state.memory);
    if (shown === null) return errored(state);
    // A recalled value is an operand, exactly like a typed one.
    return { ...state, display: shown, entry: null, operandReady: true };
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
