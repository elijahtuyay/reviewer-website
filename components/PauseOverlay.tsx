"use client";

import { useEffect, useId, useRef, useState } from "react";
import { getLastFocused, restoreFocus } from "@/lib/last-focused";

interface PauseOverlayProps {
  paused: boolean;
  onResume: () => void;
  /** Time left at the moment of pausing, pre-formatted. Undefined renders the overlay without a clock. */
  frozenTimeLabel?: string;
}

const EXIT_DURATION_MS = 200;

/** Covers the full viewport so paused questions can't be read/screenshotted, and freezes the timer while shown. Stays mounted briefly after `paused` goes false so the fade-out can play instead of popping instantly. */
export default function PauseOverlay({ paused, onResume, frozenTimeLabel }: PauseOverlayProps) {
  const [stillExiting, setStillExiting] = useState(false);
  const resumeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();
  /**
   * Whether this component has ever actually been paused. Without it the exit
   * effect below fires on first mount too, holding the overlay in the tree for
   * 200ms on every quiz page load. That was invisible when this was an
   * unlabelled transparent div, but it now carries role="dialog"
   * aria-modal="true", and an assistive technology is required to hide the rest
   * of the document while such a dialog is open: a screen reader whose tree
   * scan landed in that window would announce "Paused" over a hidden quiz the
   * user had only just opened. The invisible Resume button was tabbable during
   * it too, since `pointer-events-none` stops the mouse, not the keyboard.
   */
  const hasPausedRef = useRef(false);
  /** Whatever had focus when the pause began, so resuming can hand it back. */
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  /**
   * Pausing marks the quiz `inert`, which blurs whatever had focus (the Pause
   * button itself) and drops it to <body>. A screen reader then announces
   * nothing, and a keyboard user has to tab in from the top of the document to
   * find the only control on screen. Moving focus onto Resume both announces
   * the dialog and puts the single way out one Enter away.
   *
   * The cleanup restores focus to the control that opened the overlay. Without
   * it, resuming left focus on a button that was about to unmount, so it landed
   * on <body> and the next Tab restarted from the skip link at the top of the
   * document rather than continuing from the Pause button (WCAG 2.4.3).
   *
   * getLastFocused(), NOT document.activeElement: pausing sets `inert` on the
   * quiz in the same commit that opens this overlay, and React applies every DOM
   * mutation before it runs passive effects, so activeElement is already <body>
   * by the time this line runs. The restore below then dutifully focused <body>
   * and the bug it was written to fix was still there. See lib/last-focused.ts.
   */
  useEffect(() => {
    if (!paused) return;
    previouslyFocusedRef.current = getLastFocused();
    resumeRef.current?.focus();

    /**
     * aria-modal="true" tells assistive technology the rest of the document is
     * hidden, so the keyboard has to agree. The quiz content is `inert`, but
     * SiteHeader and SiteFooter are not, and Tab walked straight into them.
     * There is exactly one control in here, so the trap is simply "Tab keeps
     * you on Resume". Escape is deliberately NOT a way out: this overlay is an
     * anti-cheat screen, and dismissing it has to be a deliberate act.
     */
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      event.preventDefault();
      resumeRef.current?.focus();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      restoreFocus(previouslyFocusedRef.current);
    };
  }, [paused]);

  useEffect(() => {
    if (paused) {
      hasPausedRef.current = true;
      return;
    }
    // Nothing to fade out from on first mount — see hasPausedRef above.
    if (!hasPausedRef.current) return;
    setStillExiting(true);
    const timeout = setTimeout(() => setStillExiting(false), EXIT_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [paused]);

  if (!paused && !stillExiting) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background/80 backdrop-blur-2xl transition-opacity duration-200 motion-reduce:transition-none ${
        paused ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/25 via-transparent to-accent/10" />
      <p id={titleId} className="text-lg font-medium text-foreground">
        Paused
      </p>
      {/* The remaining time is the thing you paused in order to look at, and
          the overlay covers the header clock that would otherwise show it. */}
      {frozenTimeLabel && (
        <p className="font-mono text-3xl tabular-nums text-foreground">{frozenTimeLabel}</p>
      )}
      {/* One sentence, not a fragment hanging off the number above it. The
          old copy rendered as "Paused" / "25:02" / "left when you paused. Your
          timer is stopped until you resume." — a clause starting lowercase
          whose subject was a separate block two elements up. */}
      <p id={bodyId} className="max-w-xs text-center text-sm text-muted">
        {frozenTimeLabel
          ? "That is the time you had left. The clock is stopped until you resume."
          : "The clock is stopped until you resume."}
      </p>
      <button
        ref={resumeRef}
        type="button"
        onClick={onResume}
        // Untabbable once the overlay is fading out, so the 200ms exit window
        // can't park focus on a control that is invisible and on its way out.
        tabIndex={paused ? 0 : -1}
        className="flex h-11 items-center justify-center rounded-md bg-accent px-6 text-sm font-medium text-accent-foreground hover:opacity-90"
      >
        Resume
      </button>
    </div>
  );
}
