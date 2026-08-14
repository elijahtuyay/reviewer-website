"use client";

import { useEffect, useState } from "react";

interface PauseOverlayProps {
  paused: boolean;
  onResume: () => void;
}

const EXIT_DURATION_MS = 200;

/** Covers the full viewport so paused questions can't be read/screenshotted, and freezes the timer while shown. Stays mounted briefly after `paused` goes false so the fade-out can play instead of popping instantly. */
export default function PauseOverlay({ paused, onResume }: PauseOverlayProps) {
  const [stillExiting, setStillExiting] = useState(false);

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
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background/80 backdrop-blur-2xl transition-opacity duration-200 motion-reduce:transition-none ${
        paused ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/25 via-transparent to-accent/10" />
      <p className="text-lg font-medium text-foreground">Paused</p>
      <p className="max-w-xs text-center text-sm text-muted">
        Your timer is paused. Click the button below to resume.
      </p>
      <button
        type="button"
        onClick={onResume}
        className="flex h-11 items-center justify-center rounded-md bg-accent px-6 text-sm font-medium text-accent-foreground hover:opacity-90"
      >
        Resume
      </button>
    </div>
  );
}
