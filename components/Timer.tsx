"use client";

import { useEffect, useRef, useState } from "react";

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
  const onExpireRef = useRef(onExpire);
  const onDeadlineChangeRef = useRef(onDeadlineChange);
  // Deadline-based instead of tick-counted: browsers throttle setInterval in
  // backgrounded tabs (sometimes to well under 1/sec), so counting ticks would
  // silently grant extra time. Recomputing remaining time from a wall-clock
  // deadline on every tick self-corrects regardless of how late a tick fires.
  const endAtRef = useRef(endAt);
  const pauseStartRef = useRef<number | null>(null);

  useEffect(() => {
    onExpireRef.current = onExpire;
    onDeadlineChangeRef.current = onDeadlineChange;
  }, [onExpire, onDeadlineChange]);

  useEffect(() => {
    endAtRef.current = endAt;
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

  useEffect(() => {
    let expired = false;
    function tick() {
      if (expired || pauseStartRef.current !== null) return;
      const remaining = Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        expired = true;
        onExpireRef.current();
      }
    }
    tick();
    const interval = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  const isLow = secondsLeft !== null && secondsLeft <= 60;
  const label =
    secondsLeft === null
      ? "--:--"
      : `${Math.floor(secondsLeft / 60)}:${(secondsLeft % 60).toString().padStart(2, "0")}`;

  return (
    <div
      className={`font-mono text-sm tabular-nums ${isLow ? "font-semibold text-red-600 dark:text-red-400" : "text-muted"}`}
    >
      {label}
    </div>
  );
}
