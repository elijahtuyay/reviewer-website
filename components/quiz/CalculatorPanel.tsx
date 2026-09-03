"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  BASIC_DI_MODEL,
  CalculatorModel,
  GRE_MODEL,
  KeySpec,
} from "@/components/quiz/calculator-models";

/**
 * The on-screen calculator, as a disclosure anchored to the top left of a
 * section.
 *
 * Rendered only where `section.calculator` says so: GMAT Data Insights and GRE
 * Quantitative Reasoning, which get DIFFERENT devices. This file is the shell
 * and nothing more. The arithmetic lives in `lib/calculator/basic-di.ts` and
 * `lib/calculator/gre-standard.ts`, and the keypad, banner and explainer come
 * from `calculator-models.tsx`, which is what lets `npm run verify:engine`
 * assert the behavior without a DOM.
 *
 * EVERYTHING DEVICE-SPECIFIC MUST COME FROM THE MODEL. This component shipped
 * once with `model.banner` and `model.details` declared, supplied correctly per
 * device, and never read: the GRE panel told candidates it "calculates left to
 * right, so 2 + 3 x 4 is 20", which is the opposite of what its own reducer
 * does, and named three keys its keypad does not have. TypeScript cannot see an
 * unread object field, so the only guard is that every device-specific string
 * in here reads from `model`.
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
  /**
   * Which device. The two exams provide genuinely different calculators, and
   * the difference is not cosmetic: one honors order of operations and the
   * other does not. See `calculator-models.tsx`.
   */
  kind: "basic-di" | "gre-standard";
}

const MODELS: Record<CalculatorPanelProps["kind"], CalculatorModel> = {
  "basic-di": BASIC_DI_MODEL,
  "gre-standard": GRE_MODEL,
};

export default function CalculatorPanel({ open, onOpenChange, kind }: CalculatorPanelProps) {
  const model = MODELS[kind];
  const [state, setState] = useState<unknown>(() => model.initial());
  /**
   * The expanded explainer under the keypad. Collapsed by default and NOT
   * persisted, so it comes back on a fresh attempt rather than having been read
   * once, months ago, and silently withheld from someone who needs it now.
   */
  const [detailsOpen, setDetailsOpen] = useState(false);
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  /** Wraps toggle + panel, so click-outside can ask "did this land on either of us?". */
  const panelRef = useRef<HTMLDivElement>(null);
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

  function handleKey(key: string) {
    setState((current: unknown) => model.press(current, key));
  }

  /**
   * Keeps --calc-max-h equal to the space actually left below the panel's top
   * edge. Runs on scroll and resize because both change that distance: scrolling
   * pins the sticky wrapper (moving the panel UP by the height of everything
   * above it) and the resume banner changes it again by appearing at all.
   */
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    function measure() {
      const el = panelRef.current;
      if (!el) return;
      // Read the top from the element's own box, then leave a 1rem gutter so the
      // last key row is never flush against the bottom of the screen.
      const top = el.getBoundingClientRect().top;
      el.style.setProperty("--calc-max-h", `${Math.max(160, window.innerHeight - top - 16)}px`);
    }

    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [open]);

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
          {model.label}
          {model.hasMemory(state) && (
            // Memory survives closing the panel, so the indicator has to be
            // visible on the closed toggle too. Otherwise a stored value is
            // invisible until reopened, which is how a stale M+ silently ends
            // up in the next calculation.
            <span className="rounded bg-accent/15 px-1.5 py-0.5 text-xs font-semibold text-accent-text dark:bg-accent/25">
              M
            </span>
          )}
          <span aria-hidden className={`text-xs text-muted transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}>
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
             *
             * The cap is MEASURED, not a constant, and that is the whole point.
             *
             * Any hard-coded subtrahend encodes one assumption about how far
             * down the panel starts, and that distance is not fixed: the sticky
             * wrapper is only pinned once the page has scrolled, and the resume
             * banner pushes everything down another ~80px when it is showing.
             * A constant tuned for the pinned case (the previous 11rem, and the
             * 7rem before it) is therefore too generous at scrollY 0 — so the
             * panel overflowed the viewport WITHOUT ever reaching its own cap,
             * which meant no internal scrollbar appeared to rescue the user and
             * the "=" key simply sat under the fold. Measured at 1366x768 with
             * the banner: panel top 357, "=" bottom 779, viewport 768.
             *
             * --calc-max-h is written from the element's real bounding box on
             * scroll and resize, so the panel always stops 1rem above the fold
             * and scrolls internally past that.
             */
            ref={panelRef}
            style={{ maxHeight: "var(--calc-max-h, calc(100vh - 11rem))" }}
            // scrollbar-gutter: stable — once the panel scrolls, Chrome paints its
            // overlay scrollbar across the right-hand key column (ON/C, the
            // divide and multiply keys read as shaved). Nothing is clipped by
            // layout, but reserving the gutter keeps the keys fully drawn.
            className="absolute top-full left-0 z-30 mt-2 flex w-60 flex-col overflow-y-auto rounded-lg border border-line-strong bg-panel p-3 shadow-lg [scrollbar-gutter:stable] xl:-translate-x-[calc(100%+1rem)]"
          >
            <div className="shrink-0 rounded-md border border-line bg-background px-3 py-2 text-right">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs font-semibold">
                  <span
                    className={model.hasMemory(state) ? "text-accent-text" : "text-transparent"}
                    aria-hidden={!model.hasMemory(state)}
                  >
                    M
                  </span>
                  {/* Open parentheses, which are otherwise invisible: neither
                      key changes the display, so a forgotten one is unfindable. */}
                  {model.status?.(state) && (
                    <span className="text-accent-text">{model.status(state)}</span>
                  )}
                </span>
                {/* Polite, not assertive: results should be announced when the
                    user lands on them, not interrupt every intermediate digit. */}
                <output
                  aria-live="polite"
                  className="min-w-0 truncate font-mono text-2xl tabular-nums text-foreground"
                >
                  {model.display(state)}
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
            {/* The one line that has to survive every layout, so it is short,
                permanent, and ABOVE the keypad. From the model: the two devices
                disagree about the answer to the very sum it quotes. */}
            <p className="mt-2 shrink-0 rounded bg-panel-hover px-2 py-1.5 text-xs leading-snug text-foreground/90">
              {model.banner}
            </p>

            {/* Every key comes from the model, the wide equals included, so the
                two devices cannot drift apart in this file. */}
            <div className="mt-3 grid shrink-0 grid-cols-4 gap-1.5">
              {model.rows.flatMap((row) =>
                row.map((spec) => (
                  <CalcButton key={spec.key + spec.label} spec={spec} onPress={handleKey} />
                ))
              )}
            </div>

            {/* Detail on demand, below the keypad, collapsed by default. The
                banner carries the urgent half; these are the surprises someone
                meets a few minutes in, when they have somewhere to look. */}
            <div className="mt-2 shrink-0">
              <button
                type="button"
                onClick={() => setDetailsOpen(!detailsOpen)}
                aria-expanded={detailsOpen}
                className="flex h-11 items-center text-xs font-medium text-accent-text hover:underline"
              >
                {detailsOpen ? "Hide" : "Why does it do that?"}
              </button>
              {detailsOpen && (
                <ul className="flex flex-col gap-1.5 pb-1 text-xs leading-relaxed text-foreground/90">
                  {model.details}
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

function CalcButton({ spec, onPress }: { spec: KeySpec; onPress: (key: string) => void }) {
  /*
   * `span` and `primary` are honored here, and were not.
   *
   * Both were declared on KeySpec, set on the equals key of both devices, and
   * read by nothing. On the GMAT that silently REGRESSED a key which used to be
   * written out explicitly as a wide accent button, and on the GRE it left `=`
   * alone in column one of a four-column grid with three empty cells beside it,
   * pushing the key below the panel's own fold at 1366x768.
   */
  const tone = spec.primary
    ? "border-transparent bg-accent font-semibold text-accent-foreground hover:opacity-90"
    : spec.variant === "op"
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
      className={`flex h-11 items-center justify-center rounded-md border text-sm transition-[color,background-color,border-color,transform] active:scale-95 ${
        spec.primary ? "" : "text-foreground hover:bg-panel-hover active:bg-panel-hover"
      } ${spec.span === 4 ? "col-span-4" : spec.span === 2 ? "col-span-2" : ""} ${tone}`}
    >
      <span aria-hidden>{spec.label}</span>
      <span className="sr-only">{spec.srLabel ?? spec.label}</span>
    </button>
  );
}
