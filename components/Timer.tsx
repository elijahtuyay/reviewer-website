"use client";

import { useEffect, useRef, useState } from "react";

interface TimerProps {
  minutes: number;
  onExpire: () => void;
}

export default function Timer({ minutes, onExpire }: TimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(minutes * 60);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onExpireRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const isLow = secondsLeft <= 60;

  return (
    <div
      className={`font-mono text-sm tabular-nums ${isLow ? "font-semibold text-red-600" : "text-neutral-600"}`}
    >
      {mins}:{secs.toString().padStart(2, "0")}
    </div>
  );
}
