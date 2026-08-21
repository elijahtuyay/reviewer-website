"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExamId, SectionId } from "@/data/schema";
import { ActiveAttempt, findActiveAttempt, getSectionBreakdown } from "@/lib/section-result";
import { getStoredProgress } from "@/lib/session-progress";

interface SectionStartButtonProps {
  examId: ExamId;
  sectionId: SectionId;
  sectionLabel: string;
  minutes: number;
}

/** What this section's button should actually do right now. */
type State =
  | { kind: "start" }
  | { kind: "resume"; answered: number; total: number }
  | { kind: "review" }
  | { kind: "blocked"; by: ActiveAttempt };

/**
 * The home page's per-section call to action.
 *
 * It used to be a plain "Start {section}" link, which was wrong in three
 * separate situations and gave the home page a different answer from /nmat for
 * the same click: with an attempt already running it said "Start" but resumed;
 * with a submitted attempt it said "Start" but dropped you into review; and
 * with another section running it said "Start" but is now blocked.
 *
 * The saved state lives in sessionStorage, which cannot be read during render
 * or SSR, so the server markup is the neutral "Start" and this corrects itself
 * on mount. That is the same pattern SessionResetNotice uses on the exam setup
 * page.
 */
export default function SectionStartButton({
  examId,
  sectionId,
  sectionLabel,
  minutes,
}: SectionStartButtonProps) {
  const [state, setState] = useState<State>({ kind: "start" });

  useEffect(() => {
    const stored = getStoredProgress(examId, sectionId);

    if (stored.questionIds.length > 0) {
      if (stored.submitted) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reads sessionStorage, unavailable during render/SSR
        setState({ kind: "review" });
        return;
      }
      const breakdown = getSectionBreakdown(examId, sectionId, stored.questionIds.length);
      setState({ kind: "resume", answered: breakdown.answered, total: breakdown.total });
      return;
    }

    const active = findActiveAttempt(examId, sectionId);
    if (active) {
      setState({ kind: "blocked", by: active });
    }
  }, [examId, sectionId]);

  const href = `/${examId}/quiz/${sectionId}`;

  if (state.kind === "blocked") {
    return (
      <div className="mt-5">
        {/* Not a disabled button: the useful action is going to the section
            that is actually running, so this points there instead of being a
            dead control that only says no. */}
        <Link
          href={`/${examId}/quiz/${state.by.sectionId}`}
          className="flex min-h-11 items-center justify-center rounded-lg border border-line-strong px-4 text-sm font-semibold text-foreground hover:bg-panel-hover"
        >
          Finish {state.by.label} first
        </Link>
        <p className="mt-2 text-center text-xs text-muted">
          One section at a time, like the real exam.
        </p>
      </div>
    );
  }

  const label =
    state.kind === "resume"
      ? `Resume ${sectionLabel}`
      : state.kind === "review"
        ? `Review ${sectionLabel}`
        : `Start ${sectionLabel}`;

  const note =
    state.kind === "resume"
      ? `In progress, ${state.answered}/${state.total} answered`
      : state.kind === "review"
        ? "Already submitted, opens your scored review"
        : // The single most important thing a first-time visitor is not told
          // anywhere else on this page: clicking does not preview the section,
          // it starts it.
          `Your ${minutes}-minute timer starts as soon as you open it`;

  return (
    <div className="mt-5">
      <Link
        href={href}
        className="flex min-h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground transition hover:opacity-90"
      >
        {label}
      </Link>
      <p className="mt-2 text-center text-xs text-muted">{note}</p>
    </div>
  );
}
