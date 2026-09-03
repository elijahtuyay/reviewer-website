"use client";

import type { ReactNode } from "react";
import {
  CalculatorKey,
  hasMemory,
  initialCalculatorState,
  press,
} from "@/lib/calculator/basic-di";
import {
  GreCalculatorKey,
  hasGreMemory,
  initialGreCalculatorState,
  pressGre,
} from "@/lib/calculator/gre-standard";

/**
 * THE TWO CALCULATORS, AS DATA FOR ONE SHELL.
 *
 * `CalculatorPanel` owns the parts that took real work to get right and must
 * never diverge: the sticky/absolute positioning, the MEASURED max-height, the
 * width-and-breakpoint coupling, the click-outside and Escape handling, and the
 * memory indicator on the closed toggle. Everything that differs between the
 * two devices lives here instead.
 *
 * Duplicating the shell was the obvious alternative and is exactly what
 * CLAUDE.md forbids: the same bug would then need fixing at two call sites, and
 * the panel's own header records three layout bugs that were each found once.
 *
 * State is `unknown` at this boundary because the two reducers have unrelated
 * state shapes. The casts are contained to the two model definitions below, and
 * each is immediately adjacent to the reducer that proves it.
 */
export interface KeySpec {
  label: string;
  key: string;
  /** An accessible name, where the glyph does not read well aloud. */
  srLabel?: string;
  variant?: "op" | "fn" | "mem";
  /** Grid columns to span. Used by the wide equals key. */
  span?: 2;
  /** Rendered as the accent-filled primary key. */
  primary?: boolean;
}

export interface CalculatorModel {
  /** Names the device on the toggle, for a candidate who has met both. */
  label: string;
  initial: () => unknown;
  press: (state: unknown, key: string) => unknown;
  display: (state: unknown) => string;
  hasMemory: (state: unknown) => boolean;
  /** Rows of a four-column keypad. */
  rows: KeySpec[][];
  /** The one line that has to survive every layout, above the keypad. */
  banner: ReactNode;
  /** Detail on demand, below the keypad, collapsed by default. */
  details: ReactNode;
}

/* ------------------------------------------------------- GMAT Focus, DI --- */

/**
 * The TI-108's key set, and ONLY its key set.
 *
 * An earlier revision had a backspace key and split clear into `C` and `AC`.
 * Both were imports from the pre-Focus Integrated Reasoning calculator, which
 * is the exact device this feature's own notes warn against copying from. The
 * real one has no backspace at all and a single `ON/C`.
 *
 * Do not add a convenience key. Every key that exists on screen and not on the
 * exam is a habit a student builds and then loses on test day.
 */
const BASIC_DI_ROWS: KeySpec[][] = [
  [
    { label: "MRC", key: "mrc", srLabel: "Memory recall, press twice to clear memory", variant: "mem" },
    { label: "M+", key: "m+", srLabel: "Memory add", variant: "mem" },
    { label: "M−", key: "m-", srLabel: "Memory subtract", variant: "mem" },
    { label: "ON/C", key: "onC", srLabel: "Clear entry, press twice to clear everything", variant: "fn" },
  ],
  [
    { label: "√", key: "sqrt", srLabel: "Square root", variant: "fn" },
    { label: "%", key: "%", srLabel: "Percent", variant: "fn" },
    { label: "+/−", key: "+/-", srLabel: "Change sign", variant: "fn" },
    { label: "÷", key: "/", srLabel: "Divide", variant: "op" },
  ],
  [
    { label: "7", key: "7" },
    { label: "8", key: "8" },
    { label: "9", key: "9" },
    { label: "×", key: "*", srLabel: "Multiply", variant: "op" },
  ],
  [
    { label: "4", key: "4" },
    { label: "5", key: "5" },
    { label: "6", key: "6" },
    { label: "−", key: "-", srLabel: "Minus", variant: "op" },
  ],
  [
    { label: "1", key: "1" },
    { label: "2", key: "2" },
    { label: "3", key: "3" },
    { label: "+", key: "+", srLabel: "Plus", variant: "op" },
  ],
  [
    { label: "0", key: "0" },
    { label: ".", key: ".", srLabel: "Decimal point" },
    { label: "=", key: "=", srLabel: "Equals", span: 2, primary: true },
  ],
];

export const BASIC_DI_MODEL: CalculatorModel = {
  label: "Calculator",
  initial: () => initialCalculatorState(),
  press: (state, key) => press(state as never, key as CalculatorKey),
  display: (state) => (state as { display: string }).display,
  hasMemory: (state) => hasMemory(state as never),
  rows: BASIC_DI_ROWS,
  banner: (
    <>
      <strong className="font-semibold">Not a bug:</strong> it calculates left to right, so{" "}
      <span className="font-mono whitespace-nowrap">2 + 3 × 4</span> is 20.
    </>
  ),
  details: (
    <>
      <li>
        This is a copy of the exam calculator. It has no order of operations. For{" "}
        <span className="font-mono whitespace-nowrap">a×b + c×d</span>, add each product to memory
        with <span className="font-mono">M+</span>. Then press <span className="font-mono">MRC</span>.
      </li>
      <li>
        With <span className="font-mono">+</span> or <span className="font-mono">−</span>,{" "}
        <span className="font-mono">%</span> takes that percentage of the running total:{" "}
        <span className="font-mono whitespace-nowrap">12 + 10 %</span> shows 1.2, and{" "}
        <span className="font-mono">=</span> shows 13.2. With <span className="font-mono">×</span> or{" "}
        <span className="font-mono">÷</span>, <span className="font-mono">%</span> divides by 100.
      </li>
      <li>
        The display holds <strong>8 digits</strong>. Above 99,999,999 it shows an error. Press{" "}
        <span className="font-mono">ON/C</span> to clear it. The real exam calculator does the same.
      </li>
    </>
  ),
};

/* ------------------------------------------------------------------ GRE --- */

/**
 * A DIFFERENT DEVICE, and the differences are the point.
 *
 * It has parentheses, which the TI-108 does not, and no percent key, which the
 * TI-108 does. `C` clears the calculation while leaving memory alone, where the
 * TI-108 uses one `ON/C` for both jobs. The arithmetic differs too: see
 * `lib/calculator/gre-standard.ts`.
 */
const GRE_ROWS: KeySpec[][] = [
  [
    { label: "MC", key: "MC", srLabel: "Memory clear", variant: "mem" },
    { label: "MR", key: "MR", srLabel: "Memory recall", variant: "mem" },
    { label: "M+", key: "M+", srLabel: "Memory add", variant: "mem" },
    { label: "M−", key: "M-", srLabel: "Memory subtract", variant: "mem" },
  ],
  [
    { label: "(", key: "(", srLabel: "Open parenthesis", variant: "fn" },
    { label: ")", key: ")", srLabel: "Close parenthesis", variant: "fn" },
    { label: "√", key: "sqrt", srLabel: "Square root", variant: "fn" },
    { label: "C", key: "C", srLabel: "Clear the calculation", variant: "fn" },
  ],
  [
    { label: "7", key: "7" },
    { label: "8", key: "8" },
    { label: "9", key: "9" },
    { label: "÷", key: "/", srLabel: "Divide", variant: "op" },
  ],
  [
    { label: "4", key: "4" },
    { label: "5", key: "5" },
    { label: "6", key: "6" },
    { label: "×", key: "*", srLabel: "Multiply", variant: "op" },
  ],
  [
    { label: "1", key: "1" },
    { label: "2", key: "2" },
    { label: "3", key: "3" },
    { label: "−", key: "-", srLabel: "Minus", variant: "op" },
  ],
  [
    { label: "0", key: "0" },
    { label: ".", key: ".", srLabel: "Decimal point" },
    { label: "+/−", key: "negate", srLabel: "Change sign", variant: "fn" },
    { label: "+", key: "+", srLabel: "Plus", variant: "op" },
  ],
  [{ label: "=", key: "=", srLabel: "Equals", span: 2, primary: true }],
];

export const GRE_MODEL: CalculatorModel = {
  label: "Calculator",
  initial: () => initialGreCalculatorState(),
  press: (state, key) => pressGre(state as never, key as GreCalculatorKey),
  display: (state) => (state as { display: string }).display,
  hasMemory: (state) => hasGreMemory(state as never),
  rows: GRE_ROWS,
  banner: (
    <>
      <strong className="font-semibold">Order of operations:</strong>{" "}
      <span className="font-mono whitespace-nowrap">2 + 3 × 4</span> is 14, not 20.
    </>
  ),
  details: (
    <>
      <li>
        This calculator follows order of operations, so multiplication and division happen before
        addition and subtraction. Use <span className="font-mono">( )</span> to change that.
      </li>
      <li>
        <span className="font-mono">C</span> clears the calculation and leaves memory alone. Use{" "}
        <span className="font-mono">MC</span> to clear memory.
      </li>
      <li>
        The display holds <strong>8 digits</strong>. A larger result shows an error, and so does a
        division by zero or the square root of a negative number. Press{" "}
        <span className="font-mono">C</span> to clear it.
      </li>
    </>
  ),
};
