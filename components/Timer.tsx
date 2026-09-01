"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** Checkpoints announced to assistive technology, descending. */
const THRESHOLDS = [600, 300, 60];

interface TimerProps {
  /** Wall-clock epoch ms when time runs out. Owned by the quiz page so it survives a reload. */
  endAt: number;
  onExpire: () => void;
  /** Freezes the countdown without resetting it — used while the pause overlay is showing. */
  paused?: boolean;
  /** Fired when resuming from a pause shifts the deadline, so the caller can persist the new one. */
  onDeadlineChange?: (endAt: number) => void;
}

export default function Timer({ endAt, onExpire, paused = false, onDeadlineChange }: TimerProps) {
  // Starts null rather than a computed value: `Date.now()` can't be called in the
  // render body (react-hooks/purity), so the first real value lands on the first
  // tick, which the mount effect fires immediately.
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  /**
   * What the screen reader hears. Only set when a threshold is crossed, so the
   * live region is silent for 44 of the 45 minutes rather than reading the
   * clock aloud every second.
   */
  const [announcement, setAnnouncement] = useState("");
  const announcedRef = useRef<Set<number>>(new Set());
  /** False until the first real reading has seeded the latch. See the effect below. */
  const seededRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  const onDeadlineChangeRef = useRef(onDeadlineChange);
  // Deadline-based instead of tick-counted: browsers throttle setInterval in
  // backgrounded tabs (sometimes to well under 1/sec), so counting ticks would
  // silently grant extra time. Recomputing remaining time from a wall-clock
  // deadline on every tick self-corrects regardless of how late a tick fires.
  const endAtRef = useRef(endAt);
  const pauseStartRef = useRef<number | null>(null);
  /** Guards against firing onExpire twice if the tick loop is restarted at 0. */
  const expiredRef = useRef(false);

  useEffect(() => {
    onExpireRef.current = onExpire;
    onDeadlineChangeRef.current = onDeadlineChange;
  }, [onExpire, onDeadlineChange]);

  // Layout effect, not a passive one: this also seeds the very first value, and
  // running it before paint avoids a frame of placeholder "--:--" on every mount.
  useLayoutEffect(() => {
    endAtRef.current = endAt;
    // A deadline handed down mid-pause is a new attempt (e.g. Retake), not a
    // resumption of this one — rebase the pause origin so the pending resume
    // shift doesn't get added on top of the fresh deadline.
    if (pauseStartRef.current !== null) {
      pauseStartRef.current = Date.now();
    } else {
      // A deadline in the future means a live attempt, so a previous expiry
      // (e.g. before a Retake) must not keep the guard latched.
      if (endAt > Date.now()) expiredRef.current = false;
      // Same reasoning for the announcement latch. "Restart section" renders
      // while the Timer is still mounted, so a Retake hands down a new deadline
      // WITHOUT a remount; leaving the latch set meant the fresh 45-minute
      // attempt could never announce its 10- and 5-minute warnings again.
      announcedRef.current = new Set();
      seededRef.current = false;
      // Repaint immediately instead of waiting for the next scheduled tick.
      setSecondsLeft(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
    }
  }, [endAt]);

  useEffect(() => {
    if (paused) {
      pauseStartRef.current = Date.now();
    } else if (pauseStartRef.current !== null) {
      const shifted = endAtRef.current + (Date.now() - pauseStartRef.current);
      endAtRef.current = shifted;
      pauseStartRef.current = null;
      onDeadlineChangeRef.current?.(shifted);
    }
  }, [paused]);

  // Self-rescheduling timeout aligned to the moment the displayed second is due
  // to change, rather than a fixed 1000ms interval.
  //
  // A plain setInterval drifts: each tick fires at 1000ms + however long the
  // event loop was busy, so the sampled remaining time slides relative to the
  // real second boundaries. Combined with rounding to the nearest second, a tick
  // that lands late enough skips a value outright (…0:10, 0:08…). Rounding is
  // also wrong on its own terms for a countdown: it shows "0:10" when only 9.5s
  // are left, and reaches 0:00 a half-second before time is actually up.
  //
  // Ceiling matches how a countdown should read (any fraction of a second
  // remaining still displays as that second), and scheduling the next wake for
  // the exact instant that value is due to decrement keeps the display in step
  // with the wall clock no matter how late an individual callback runs.
  useEffect(() => {
    if (paused) return;

    let timeout: ReturnType<typeof setTimeout> | undefined;

    function tick() {
      const remainingMs = endAtRef.current - Date.now();
      const remaining = Math.max(0, Math.ceil(remainingMs / 1000));
      setSecondsLeft(remaining);

      if (remaining <= 0) {
        if (!expiredRef.current) {
          expiredRef.current = true;
          onExpireRef.current();
        }
        return;
      }

      // Time until remainingMs crosses the next lower whole second. Floored at a
      // small positive value so a mis-measured boundary can't spin the loop.
      const msUntilNextSecond = remainingMs - (remaining - 1) * 1000;
      timeout = setTimeout(tick, Math.max(50, msUntilNextSecond));
    }

    tick();
    // Background tabs get their timers throttled, so re-sync the moment the tab
    // is looked at again instead of waiting out a stale, long-delayed timeout.
    function resync() {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timeout);
      tick();
    }
    document.addEventListener("visibilitychange", resync);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener("visibilitychange", resync);
    };
  }, [paused, endAt]);

  /**
   * Time checkpoints, announced once each.
   *
   * Before this the countdown was a plain div with no role and no live region,
   * and the only "running out" signal was color and weight at 60 seconds. A
   * screen-reader user therefore got NO warning of any kind before the section
   * submitted itself under them. Sixty seconds is also very late for a visual
   * warning, which is why five minutes now changes the color too.
   */
  useEffect(() => {
    if (secondsLeft === null || paused) return;

    // Seed from the FIRST reading rather than announcing on `<= threshold`.
    // Resuming an attempt with 3:00 left mounts the timer already below both the
    // 10- and 5-minute marks, and announcing state rather than a crossing made a
    // screen reader say "10 minutes remaining" and then, one second later, "5
    // minutes remaining" to someone three minutes from an auto-submit.
    if (!seededRef.current) {
      seededRef.current = true;
      for (const threshold of THRESHOLDS) {
        if (secondsLeft <= threshold) announcedRef.current.add(threshold);
      }
      return;
    }

    for (const threshold of THRESHOLDS) {
      if (secondsLeft > threshold || announcedRef.current.has(threshold)) continue;
      announcedRef.current.add(threshold);
      const minutes = threshold / 60;
      setAnnouncement(
        `${minutes} minute${minutes === 1 ? "" : "s"} remaining in this section.`
      );
      return;
    }
  }, [secondsLeft, paused]);

  const isLow = secondsLeft !== null && secondsLeft <= 60;
  const isWarning = secondsLeft !== null && secondsLeft <= 300;
  const label =
    secondsLeft === null
      ? "--:--"
      : `${Math.floor(secondsLeft / 60)}:${(secondsLeft % 60).toString().padStart(2, "0")}`;

  // text-base and --foreground by default, not text-sm and --muted: this is a
  // timed exam, and the countdown was visually subordinate to the bordered
  // Pause button sitting next to it.
  const tone = isLow
    ? "text-red-700 dark:text-red-400"
    : isWarning
      ? "text-amber-700 dark:text-amber-400"
      : "text-foreground";

  return (
    <div className="flex flex-col items-end">
      <div
        // role="timer" rather than aria-hidden. Hiding the digits outright did
        // stop the per-second chatter, but it also removed the only way for a
        // screen-reader user to ASK what time is left — which they need before
        // committing to a long reading-comprehension passage. A timer role is
        // readable on demand and is not an implicit live region, so it does not
        // announce itself; the separate polite region below does the announcing,
        // and only at checkpoints.
        role="timer"
        aria-label={secondsLeft === null ? "Time remaining" : `${label} remaining in this section`}
        className={`font-mono text-base font-semibold tabular-nums ${tone}`}
      >
        {label}
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
