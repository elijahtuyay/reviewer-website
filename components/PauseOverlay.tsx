"use client";

import { useEffect, useId, useRef, useState } from "react";

interface PauseOverlayProps {
  paused: boolean;
  onResume: () => void;
}

const EXIT_DURATION_MS = 200;

/** Covers the full viewport so paused questions can't be read/screenshotted, and freezes the timer while shown. Stays mounted briefly after `paused` goes false so the fade-out can play instead of popping instantly. */
export default function PauseOverlay({ paused, onResume }: PauseOverlayProps) {
  const [stillExiting, setStillExiting] = useState(false);
  const resumeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();

  /**
   * Pausing marks the quiz `inert`, which blurs whatever had focus (the Pause
   * button itself) and drops it to <body>. A screen reader then announces
   * nothing, and a keyboard user has to tab in from the top of the document to
   * find the only control on screen. Moving focus onto Resume both announces
   * the dialog and puts the single way out one Enter away.
   */
  useEffect(() => {
    if (!paused) return;
    resumeRef.current?.focus();
  }, [paused]);

  useEffect(() => {
    if (paused) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off a fixed-duration exit-animation timer, not a render-triggered side effect
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
      <p id={bodyId} className="max-w-xs text-center text-sm text-muted">
        Your timer is paused. Click the button below to resume.
      </p>
      <button
        ref={resumeRef}
        type="button"
        onClick={onResume}
        className="flex h-11 items-center justify-center rounded-md bg-accent px-6 text-sm font-medium text-accent-foreground hover:opacity-90"
      >
        Resume
      </button>
    </div>
  );
}
