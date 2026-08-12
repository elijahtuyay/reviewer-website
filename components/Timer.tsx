"use client";

import { useEffect, useRef, useState } from "react";

interface TimerProps {
  minutes: number;
  onExpire: () => void;
  /** Freezes the countdown without resetting it — used while the pause overlay is showing. */
  paused?: boolean;
}

export default function Timer({ minutes, onExpire, paused = false }: TimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(minutes * 60);
  const onExpireRef = useRef(onExpire);
  // Deadline-based instead of tick-counted: browsers throttle setInterval in
  // backgrounded tabs (sometimes to well under 1/sec), so counting ticks would
  // silently grant extra time. Recomputing remaining time from a wall-clock
  // deadline on every tick self-corrects regardless of how late a tick fires.
  const endAtRef = useRef(0);
  const pauseStartRef = useRef<number | null>(null);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    endAtRef.current = Date.now() + minutes * 60_000;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only initialization, matches the original useState(minutes * 60) behavior of ignoring later prop changes
  }, []);

  useEffect(() => {
    if (paused) {
      pauseStartRef.current = Date.now();
    } else if (pauseStartRef.current !== null) {
      endAtRef.current += Date.now() - pauseStartRef.current;
      pauseStartRef.current = null;
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
    const interval = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const isLow = secondsLeft <= 60;

  return (
    <div
      className={`font-mono text-sm tabular-nums ${isLow ? "font-semibold text-red-600 dark:text-red-400" : "text-muted"}`}
    >
      {mins}:{secs.toString().padStart(2, "0")}
    </div>
  );
}
