"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getExam } from "@/lib/exams/registry";
import { ExamId, SectionId } from "@/data/schema";
import { getSectionBreakdown } from "@/lib/section-result";
import {
  clearExamProgress,
  clearSectionProgress,
  getStoredProgress,
  purgeLegacyPersistedProgress,
} from "@/lib/session-progress";
import ConfirmDialog from "@/components/ConfirmDialog";

interface SessionResetNoticeProps {
  examId: ExamId;
}

interface SavedSection {
  id: SectionId;
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
    for (const section of getExam(examId).sections) {
      const stored = getStoredProgress(examId, section.id);
      // A drawn question set is what makes a section "started" — answering none
      // of it still burns the clock, so it has to be listed either way.
      if (stored.questionIds.length === 0) continue;
      const breakdown = getSectionBreakdown(examId, section.id, section.questionCount);

      if (breakdown.submitted) {
        found.push({
          id: section.id,
          label: section.label,
          detail: breakdown.scoreKnown
            ? `Submitted · ${breakdown.correct}/${breakdown.total} correct`
            : "Submitted",
        });
      } else if (stored.pausedAt === 0 && stored.deadline > 0 && stored.deadline <= now) {
        // The clock ran out while this section sat unopened. Opening it will
        // submit it, so don't advertise it as still being in progress.
        found.push({
          id: section.id,
          label: section.label,
          detail: `Time expired · ${breakdown.answered}/${breakdown.total} answered`,
        });
      } else {
        found.push({
          id: section.id,
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

  /** null = nothing pending, "all" = clear every section, otherwise the single section to clear. */
  const [pendingClear, setPendingClear] = useState<"all" | SavedSection | null>(null);

  function handleConfirmClear() {
    if (pendingClear === "all") {
      clearExamProgress(examId);
      setSaved([]);
    } else if (pendingClear) {
      clearSectionProgress(examId, pendingClear.id);
      setSaved((prev) => prev.filter((s) => s.id !== pendingClear.id));
    }
    setPendingClear(null);
  }

  return (
    <div className="mt-8 rounded-lg border border-line bg-panel px-4 py-3">
      <p className="text-sm font-medium text-foreground">
        You lose your progress when you close this tab
      </p>
      <p className="mt-1 text-sm text-foreground/90">
        Your answers and your timer stay only while this browser tab is open. You can move between
        this page and a section freely. When you close the tab or the browser, the site deletes all
        of it. A section timer continues while you are away from that section. Press Pause first to
        stop it.
      </p>

      {saved.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">
            Saved earlier in this session
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {saved.map((entry) => (
              <li key={entry.id} className="flex items-center gap-1">
                <Link
                  href={`/${examId}/quiz/${entry.id}`}
                  className="flex min-h-11 flex-1 flex-wrap items-center justify-between gap-x-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-panel-hover active:bg-line"
                >
                  <span className="font-medium text-foreground underline underline-offset-2">{entry.label}</span>
                  <span className="text-xs text-muted">{entry.detail}</span>
                </Link>
                {/* Per-section, so discarding one attempt doesn't take the other
                    finished sections with it. Bordered rather than bare text:
                    beside the same-size gray status line, an unstyled button
                    scanned as prose ("12/36 answered Clear"), not a control. */}
                <button
                  type="button"
                  onClick={() => setPendingClear(entry)}
                  aria-label={`Clear saved progress for ${entry.label}`}
                  className="flex h-11 shrink-0 items-center justify-center rounded-md border border-line-strong px-3 text-xs font-medium text-muted transition-colors hover:bg-panel-hover hover:text-foreground active:bg-line"
                >
                  Clear
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Select one of these to continue that attempt. It does not start a new attempt.
          </p>
          {saved.length > 1 && (
            <button
              type="button"
              onClick={() => setPendingClear("all")}
              className="btn btn-secondary mt-3"
            >
              Clear all saved progress
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={pendingClear !== null}
        title={pendingClear === "all" ? "Clear all saved progress?" : "Clear this section?"}
        body={
          pendingClear === "all"
            ? `This deletes your saved work for all ${saved.length} sections above. It includes the sections you already submitted. You cannot undo this.`
            : `This deletes your saved work for ${pendingClear?.label ?? "this section"}. Your other sections do not change. You cannot undo this.`
        }
        confirmLabel={pendingClear === "all" ? "Clear all" : "Clear section"}
        cancelLabel="Keep it"
        onConfirm={handleConfirmClear}
        onCancel={() => setPendingClear(null)}
      />
    </div>
  );
}
