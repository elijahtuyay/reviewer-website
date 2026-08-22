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

/**
 * The TI-108's key set, and ONLY its key set.
 *
 * An earlier revision had a backspace key and split clear into `C` and `AC`.
 * Both were imports from the pre-Focus Integrated Reasoning calculator, which
 * is the exact device this component's own module header warns against copying
 * from. The real one has no backspace at all and a single `ON/C`: one press
 * clears the entry, a second clears the calculation.
 *
 * Do not add a convenience key here. Every key that exists on screen and not on
 * the exam is a habit a student builds and then loses on test day, which is the
 * same failure this whole feature exists to prevent.
 */
const ROWS: KeySpec[][] = [
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
];

export default function CalculatorPanel({ open, onOpenChange }: CalculatorPanelProps) {
  const [state, setState] = useState(initialCalculatorState);
  /**
   * The expanded explainer under the keypad. Collapsed by default and NOT
   * persisted, so it comes back on a fresh attempt rather than having been read
   * once, months ago, and silently withheld from someone who needs it now.
   */
  const [detailsOpen, setDetailsOpen] = useState(false);
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  /** Wraps toggle + panel, so click-outside can ask "did this land on either of us?". */
  const rootRef = useRef<HTMLDivElement>(null);

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
    /**
     * Click-outside closes, but WITHOUT returning focus the way Escape does.
     * Escape is a deliberate dismissal by someone using the keyboard, so
     * handing focus back to the toggle is the courteous thing; a click has
     * already put focus wherever the user aimed it, and yanking it away would
     * fight them.
     *
     * Bound to `mousedown` rather than `click` so that pressing down on a
     * question option closes the panel before that option's own click lands,
     * rather than leaving the panel open over the thing just selected.
     */
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      onOpenChange(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open, onOpenChange]);

  function handleKey(key: CalculatorKey) {
    setState((current) => press(current, key));
  }

  return (
    // `sticky top-20` parks this directly under the h-20 quiz header once the
    // page scrolls, so the calculator stays reachable through a long
    // multi-source question instead of scrolling away with the first screen.
    <div className="sticky top-20 z-30 -mx-1 mb-4 px-1">
      <div ref={rootRef} className="relative">
        {/* The disclosure pattern: aria-expanded plus aria-controls, and
            deliberately NO aria-haspopup. An earlier revision declared
            haspopup="dialog" while the panel below is role="group", so a
            screen reader announced a dialog popup and then landed the
            reader on a group. */}
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
             * THE WIDTH AND THE BREAKPOINT ARE ONE DECISION, so do not change
             * either alone. The content column is max-w-3xl with px-6, so the
             * button's left edge sits at (viewport - 768) / 2 + 24, and the
             * shifted panel's left edge is that minus the gap minus the width.
             * At 15rem + 1rem the sum comes out positive at exactly 1280, which
             * is why `xl` is the right breakpoint now and was the WRONG one at
             * the previous 17rem + 1.5rem, where the panel hung 40px off the
             * left edge of the screen between 1280 and 1360. Widening the panel
             * without raising the breakpoint reintroduces that bug.
             *
             * `max-h` + `overflow-y-auto` is not cosmetic. The wrapper is
             * `sticky` and this is `absolute` inside it, so once the header
             * pins, the panel's position stops responding to page scroll
             * entirely: anything below the fold is unreachable at ANY scroll
             * position, not merely awkward. On a 1366x768 laptop that silently
             * swallowed the bottom of the panel, and the explanatory note used
             * to live there.
             */
            className="absolute top-full left-0 z-30 mt-2 flex max-h-[calc(100vh-7rem)] w-60 flex-col overflow-y-auto rounded-lg border border-line-strong bg-panel p-3 shadow-lg xl:-translate-x-[calc(100%+1rem)]"
          >
            <div className="shrink-0 rounded-md border border-line bg-background px-3 py-2 text-right">
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

            {/* The one line that has to survive every layout, so it is short,
                permanent, and ABOVE the keypad.

                The full explainer used to live here in three bullets. On a
                1366x768 laptop that pushed the digits below the fold, and
                because the wrapper is sticky the panel does not respond to page
                scroll, so the keypad became unreachable. Before that it sat at
                the BOTTOM of the panel, where the same mechanism made the note
                itself unreachable. One line up here plus detail on demand is
                what fits both constraints: the message that stops someone
                concluding "this calculator is broken" is never more than a
                glance away, and it costs no keypad space. */}
            <p className="mt-2 shrink-0 rounded bg-panel-hover px-2 py-1.5 text-[0.7rem] leading-snug text-foreground/90">
              <strong className="font-semibold">Not a bug:</strong> runs left to right, so{" "}
              <span className="font-mono whitespace-nowrap">2 + 3 × 4</span> is 20.
            </p>

            <div className="mt-3 grid shrink-0 grid-cols-4 gap-1.5">
              {ROWS.flatMap((row) =>
                row.map((spec) => (
                  <CalcButton key={spec.key + spec.label} spec={spec} onPress={handleKey} />
                ))
              )}
              <CalcButton spec={{ label: "0", key: "0" }} onPress={handleKey} />
              <CalcButton spec={{ label: ".", key: ".", srLabel: "Decimal point" }} onPress={handleKey} />
              <button
                type="button"
                onClick={() => handleKey("=")}
                className="col-span-2 flex h-11 items-center justify-center rounded-md bg-accent text-base font-semibold text-accent-foreground hover:opacity-90"
              >
                <span aria-hidden>=</span>
                <span className="sr-only">Equals</span>
              </button>
            </div>

            {/* Detail on demand, below the keypad, collapsed by default. The
                banner carries the urgent half; these are the surprises someone
                meets a few minutes in, when they have somewhere to look. */}
            <div className="mt-2 shrink-0">
              <button
                type="button"
                onClick={() => setDetailsOpen(!detailsOpen)}
                aria-expanded={detailsOpen}
                className="flex h-11 items-center text-[0.7rem] font-medium text-accent-text hover:underline"
              >
                {detailsOpen ? "Hide" : "Why does it do that?"}
              </button>
              {detailsOpen && (
                <ul className="flex flex-col gap-1.5 pb-1 text-[0.7rem] leading-relaxed text-foreground/90">
                  <li>
                    It copies the exam&apos;s calculator exactly. There is no order of operations,
                    so for <span className="font-mono whitespace-nowrap">a×b + c×d</span> bank each
                    product with <span className="font-mono">M+</span>, then press{" "}
                    <span className="font-mono">MRC</span>.
                  </li>
                  <li>
                    <span className="font-mono">%</span> is taken from what you&apos;re adding it
                    to: <span className="font-mono whitespace-nowrap">12 + 10 %</span> shows 1.2,
                    and <span className="font-mono">=</span> gives 13.2.
                  </li>
                  <li>
                    The display holds <strong>8 digits</strong>. Past 99,999,999 it errors until you
                    press <span className="font-mono">ON/C</span>, exactly as on test day.
                  </li>
                </ul>
              )}
            </div>

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
        // Was `text-muted`, which read as disabled next to the digits and put
        // the memory keys, the ones the left-to-right workaround depends on,
        // at the lowest contrast on the pad.
        ? "border-line-strong bg-background text-foreground/80 hover:text-foreground"
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
