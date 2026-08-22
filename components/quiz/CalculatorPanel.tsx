"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  CalculatorKey,
  hasMemory,
  initialCalculatorState,
  press,
} from "@/lib/calculator/basic-di";

/**
 * The on-screen calculator, as a disclosure anchored to the top left of a
 * section.
 *
 * Rendered only where `section.calculator` says so, which today is GMAT Data
 * Insights and nothing else. All the arithmetic lives in
 * `lib/calculator/basic-di.ts`; this file is the keypad and nothing more, which
 * is what lets `npm run verify:engine` assert the behavior without a DOM.
 *
 * ── Deliberately NOT keyboard-enterable ──────────────────────────────────
 *
 * There is no global keydown handler mapping number keys to the calculator, and
 * that is a fidelity decision rather than a missing feature. The real exam's
 * calculator is mouse-driven, so type-to-enter would hand a practicing student
 * a speed advantage that evaporates on test day, which is the same failure mode
 * as practicing Quantitative with a calculator open.
 *
 * Accessibility does not suffer for it: every key is a real focusable
 * `<button>`, so Tab-and-Enter operates the whole thing, which is what WCAG
 * asks for. If someone later adds a keydown handler to make it "nicer", they
 * will be trading exam fidelity for convenience without realizing it.
 */

interface CalculatorPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Label, key, and an optional accessible name where the glyph does not read well aloud. */
type KeySpec = { label: string; key: CalculatorKey; srLabel?: string; variant?: "op" | "fn" | "mem" };

const ROWS: KeySpec[][] = [
  [
    { label: "MRC", key: "mrc", srLabel: "Memory recall, press twice to clear", variant: "mem" },
    { label: "M+", key: "m+", srLabel: "Memory add", variant: "mem" },
    { label: "M−", key: "m-", srLabel: "Memory subtract", variant: "mem" },
    { label: "AC", key: "allClear", srLabel: "All clear", variant: "fn" },
  ],
  [
    { label: "√", key: "sqrt", srLabel: "Square root", variant: "fn" },
    { label: "%", key: "%", srLabel: "Percent", variant: "fn" },
    { label: "←", key: "back", srLabel: "Backspace", variant: "fn" },
    { label: "C", key: "clear", srLabel: "Clear entry", variant: "fn" },
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
    { label: "+/−", key: "+/-", srLabel: "Change sign" },
    { label: "+", key: "+", srLabel: "Plus", variant: "op" },
  ],
];

export default function CalculatorPanel({ open, onOpenChange }: CalculatorPanelProps) {
  const [state, setState] = useState(initialCalculatorState);
  /**
   * Shown until dismissed, once per attempt.
   *
   * The left-to-right rule is the single most useful thing this calculator
   * teaches and the one thing nobody discovers on their own: without being told,
   * a student simply gets a wrong answer and never learns why. Deliberately not
   * persisted, so it reappears on a fresh attempt rather than being read once
   * months ago and forgotten.
   */
  const [noteDismissed, setNoteDismissed] = useState(false);
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);

  /**
   * Escape closes and hands focus back to the toggle. Without the focus return,
   * closing drops focus to <body> and the next Tab restarts from the top of the
   * document rather than continuing from the button that was just used (WCAG
   * 2.4.3), the same fix PauseOverlay carries.
   */
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      onOpenChange(false);
      toggleRef.current?.focus();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  function handleKey(key: CalculatorKey) {
    setState((current) => press(current, key));
  }

  return (
    // `sticky top-20` parks this directly under the h-20 quiz header once the
    // page scrolls, so the calculator stays reachable through a long
    // multi-source question instead of scrolling away with the first screen.
    <div className="sticky top-20 z-30 -mx-1 mb-4 px-1">
      <div className="relative">
        <button
          ref={toggleRef}
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex h-11 items-center gap-2 rounded-md border border-line-strong bg-background px-3 text-sm font-medium text-foreground hover:bg-panel-hover"
        >
          {/* An inline SVG, not the 🖩 emoji, which renders as a tofu box on
              Windows: U+1F5A9 has almost no font coverage there. Verified in a
              headless screenshot before it was replaced. */}
          <CalculatorIcon />
          Calculator
          {hasMemory(state) && (
            // Memory survives closing the panel, so the indicator has to be
            // visible on the closed toggle too. Otherwise a stored value is
            // invisible until reopened, which is how a stale M+ silently ends
            // up in the next calculation.
            <span className="rounded bg-accent/15 px-1.5 py-0.5 text-xs font-semibold text-accent-text dark:bg-accent/25">
              M
            </span>
          )}
          <span aria-hidden className={`text-xs text-muted transition-transform ${open ? "rotate-180" : ""}`}>
            ▾
          </span>
        </button>

        {open && (
          <div
            id={panelId}
            role="group"
            aria-label="On-screen calculator"
            /**
             * On a narrow screen the panel drops straight under the button and
             * floats over the question, which is the right trade there: it is
             * toggled as needed and closed again.
             *
             * Once the viewport is wide enough it shifts left into the gutter
             * instead, so it reads alongside the question rather than on top of
             * a table someone is mid-way through.
             *
             * The 1360px threshold is arithmetic, not a guess, and `xl` (1280)
             * is specifically WRONG here. The content column is max-w-3xl, so
             * the gutter is (viewport - 768) / 2; the panel needs its own 17rem
             * plus a 1.5rem gap, or 296px. At 1280 the gutter is only 256px and
             * the panel hangs 40px off the left edge of the screen. Breaking at
             * 1360 leaves the shifted panel a small positive margin. If the
             * panel width or the column width changes, redo this sum.
             */
            className="absolute top-full left-0 z-30 mt-2 w-[17rem] rounded-lg border border-line-strong bg-panel p-3 shadow-lg min-[1360px]:-translate-x-[calc(100%+1.5rem)]"
          >
            <div className="rounded-md border border-line bg-background px-3 py-2 text-right">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-xs font-semibold ${hasMemory(state) ? "text-accent-text" : "text-transparent"}`}
                  aria-hidden={!hasMemory(state)}
                >
                  M
                </span>
                {/* Polite, not assertive: results should be announced when the
                    user lands on them, not interrupt every intermediate digit. */}
                <output
                  aria-live="polite"
                  className="min-w-0 truncate font-mono text-2xl tabular-nums text-foreground"
                >
                  {state.display}
                </output>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {ROWS.flatMap((row) =>
                row.map((spec) => (
                  <CalcButton key={spec.key + spec.label} spec={spec} onPress={handleKey} />
                ))
              )}
              <button
                type="button"
                onClick={() => handleKey("=")}
                className="col-span-4 flex h-11 items-center justify-center rounded-md bg-accent text-base font-semibold text-accent-foreground hover:opacity-90"
              >
                =
              </button>
            </div>

            {!noteDismissed && (
              <div className="mt-3 rounded-md border border-line bg-background px-3 py-2">
                <p className="text-xs leading-relaxed text-foreground/90">
                  Like the real one, this works <strong>left to right</strong> and ignores order of
                  operations: <span className="font-mono">2 + 3 × 4</span> gives 20, not 14. For
                  something like <span className="font-mono">a×b + c×d</span>, use{" "}
                  <span className="font-mono">M+</span> to bank each product, then{" "}
                  <span className="font-mono">MRC</span>.
                </p>
                <button
                  type="button"
                  onClick={() => setNoteDismissed(true)}
                  className="mt-2 flex h-11 items-center text-xs font-medium text-accent-text hover:underline"
                >
                  Got it
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CalculatorIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden
    >
      <rect x="2.5" y="1.5" width="11" height="13" rx="1.5" />
      <rect x="4.75" y="3.75" width="6.5" height="2.5" rx="0.5" />
      <circle cx="5.5" cy="9" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="8" cy="9" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="9" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="5.5" cy="11.5" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="8" cy="11.5" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="11.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CalcButton({ spec, onPress }: { spec: KeySpec; onPress: (key: CalculatorKey) => void }) {
  const tone =
    spec.variant === "op"
      ? "border-line-strong bg-panel-hover font-semibold"
      : spec.variant === "mem" || spec.variant === "fn"
        ? "border-line-strong bg-background text-muted hover:text-foreground"
        : "border-line-strong bg-background font-medium";

  return (
    // h-11 keeps every key on the 44px minimum the rest of the app holds to.
    <button
      type="button"
      onClick={() => onPress(spec.key)}
      className={`flex h-11 items-center justify-center rounded-md border text-sm text-foreground transition-colors hover:bg-panel-hover ${tone}`}
    >
      <span aria-hidden>{spec.label}</span>
      <span className="sr-only">{spec.srLabel ?? spec.label}</span>
    </button>
  );
}
