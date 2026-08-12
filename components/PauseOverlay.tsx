"use client";

interface PauseOverlayProps {
  onResume: () => void;
}

/** Covers the full viewport so paused questions can't be read/screenshotted, and freezes the timer while shown. */
export default function PauseOverlay({ onResume }: PauseOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background/80 backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/25 via-transparent to-accent/10" />
      <p className="text-lg font-medium text-foreground">Exam paused</p>
      <p className="max-w-xs text-center text-sm text-muted">
        Your timer is paused and the questions are hidden. Resume when you&apos;re ready to
        continue.
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
