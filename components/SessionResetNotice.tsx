"use client";

import { useCallback, useEffect, useState } from "react";
import { getExamConfig } from "@/lib/exam-config";
import { ExamId } from "@/data/schema";
import { getSectionBreakdown } from "@/lib/section-result";
import {
  clearExamProgress,
  getStoredProgress,
  purgeLegacyPersistedProgress,
} from "@/lib/session-progress";

interface SessionResetNoticeProps {
  examId: ExamId;
}

interface SavedSection {
  label: string;
  detail: string;
}

/**
 * Sets expectations on the section-select page: attempts only live for as long as
 * the browser session does. Also surfaces which sections already have saved work,
 * so a resumed attempt is never a surprise on the way into the quiz.
 */
export default function SessionResetNotice({ examId }: SessionResetNoticeProps) {
  const [saved, setSaved] = useState<SavedSection[]>([]);

  const readSaved = useCallback(() => {
    const found: SavedSection[] = [];
    const now = Date.now();
    for (const section of getExamConfig(examId).sections) {
      const stored = getStoredProgress(examId, section.id);
      // A drawn question set is what makes a section "started" — answering none
      // of it still burns the clock, so it has to be listed either way.
      if (stored.questionIds.length === 0) continue;
      const breakdown = getSectionBreakdown(examId, section.id, section.questionCount);

      if (breakdown.submitted) {
        found.push({
          label: section.label,
          detail: `Submitted · ${breakdown.correct}/${breakdown.total} correct`,
        });
      } else if (stored.pausedAt === 0 && stored.deadline > 0 && stored.deadline <= now) {
        // The clock ran out while this section sat unopened. Opening it will
        // submit it, so don't advertise it as still being in progress.
        found.push({
          label: section.label,
          detail: `Time expired · ${breakdown.answered}/${breakdown.total} answered`,
        });
      } else {
        found.push({
          label: section.label,
          detail: `In progress · ${breakdown.answered}/${breakdown.total} answered`,
        });
      }
    }
    return found;
  }, [examId]);

  // sessionStorage isn't readable during render/SSR, so the saved-attempt list is
  // filled in after mount rather than being part of the server-rendered markup.
  useEffect(() => {
    purgeLegacyPersistedProgress();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads sessionStorage, unavailable during render/SSR
    setSaved(readSaved());
  }, [readSaved]);

  function handleClear() {
    clearExamProgress(examId);
    setSaved([]);
  }

  return (
    <div className="mt-8 rounded-lg border border-line bg-panel px-4 py-3">
      <p className="text-sm font-medium text-foreground">Progress is cleared when you close this tab</p>
      <p className="mt-1 text-sm text-foreground/90">
        Your answers and timer are kept only while this browser tab stays open, so you can move
        between this page and a section freely. Closing the tab or the browser clears all sections.
        Note that a section&apos;s timer keeps running while you are away from it.
      </p>

      {saved.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">
            Saved from earlier in this session
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {saved.map((entry) => (
              <li key={entry.label} className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span className="text-foreground">{entry.label}</span>
                <span className="text-xs text-muted">{entry.detail}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Opening one of these picks up that attempt instead of starting a new one.
          </p>
          <button
            type="button"
            onClick={handleClear}
            className="mt-3 flex h-11 items-center justify-center rounded-md border border-line px-3 text-sm font-medium text-foreground hover:bg-panel-hover"
          >
            Clear saved progress
          </button>
        </div>
      )}
    </div>
  );
}
