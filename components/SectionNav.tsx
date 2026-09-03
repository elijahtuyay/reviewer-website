"use client";

import Link from "next/link";
import { useMemo } from "react";
import { getExam } from "@/lib/exams/registry";
import { ExamId, SectionId } from "@/data/schema";
import { getSectionBreakdown } from "@/lib/section-result";
import { ScoreResult } from "@/lib/scoring";

interface SectionNavProps {
  examId: ExamId;
  currentSection: SectionId;
  currentAnsweredCount: number;
  /** True while the current section is still in progress — the real NMAT locks you into a section until it's finished. */
  locked: boolean;
  /** The current section's live score, once submitted — avoids re-deriving it from localStorage for the section the user is actively on. */
  currentResult?: ScoreResult | null;
}

export default function SectionNav({
  examId,
  currentSection,
  currentAnsweredCount,
  locked,
  currentResult,
}: SectionNavProps) {
  const sections = getExam(examId).sections;

  /**
   * The OTHER sections' saved state, read once.
   *
   * getSectionBreakdown is a synchronous sessionStorage.getItem plus a
   * JSON.parse, and this ran inside the render body — so on the quiz page it
   * executed on every answer click, twice, as main-thread I/O during render.
   * Those sections cannot change while this tab is sitting on this page (the
   * section lock is what guarantees it), so reading them once per section is
   * not a cache, it is the correct number of reads.
   */
  const storedBreakdowns = useMemo(() => {
    const map = new Map<SectionId, ReturnType<typeof getSectionBreakdown>>();
    for (const section of sections) {
      if (section.id === currentSection) continue;
      map.set(section.id, getSectionBreakdown(examId, section.id, section.questionCount));
    }
    return map;
  }, [examId, currentSection, sections]);

  return (
    <nav className="flex flex-col gap-1.5">
      <p className="mb-1 px-1 text-xs font-medium tracking-wide text-muted uppercase">Sections</p>
      {sections.map((section) => {
        const isCurrent = section.id === currentSection;
        const isNavigable = isCurrent || !locked;

        const breakdown =
          isCurrent && currentResult
            ? {
                submitted: true,
                total: currentResult.totalQuestions,
                answered: currentResult.correctCount + currentResult.incorrectCount,
                skipped: currentResult.unansweredCount,
                correct: currentResult.correctCount,
                incorrect: currentResult.incorrectCount,
                score: currentResult.score,
                maxScore: currentResult.maxScore,
                scoreKnown: true,
              }
            : isCurrent
              ? {
                  submitted: false,
                  total: section.questionCount,
                  answered: currentAnsweredCount,
                  skipped: 0,
                  correct: 0,
                  incorrect: 0,
                  score: null,
                  maxScore: null,
                  scoreKnown: false,
                }
              : (storedBreakdowns.get(section.id) ??
                getSectionBreakdown(examId, section.id, section.questionCount));

        const content = (
          <>
            <span className="text-sm font-medium">{section.label}</span>
            {breakdown.submitted && !breakdown.scoreKnown ? (
              <span className="text-xs text-muted">Submitted</span>
            ) : breakdown.submitted ? (
              <span className="flex gap-2 text-xs">
                {/* green-800, not -700: on --background the -700 measures 4.49, which is a
                    fail by 0.01. On bg-green-50 (the answer options) -700 is fine. */}
                <span className="text-green-800 dark:text-green-400">{breakdown.correct} correct</span>
                <span className="text-red-700 dark:text-red-400">{breakdown.incorrect} incorrect</span>
                <span className="text-muted">{breakdown.skipped} with no answer</span>
              </span>
            ) : (
              <span className="text-xs text-muted">
                {breakdown.answered}/{breakdown.total}
              </span>
            )}
          </>
        );

        const baseClasses = "flex flex-col gap-0.5 rounded-md border px-3 py-2.5 transition-colors";
        // Non-current entries are links whose border is the only thing marking
        // them as a control, so they need the 3:1 boundary too.
        const activeClasses = isCurrent
          ? "border-accent bg-accent/10 dark:bg-accent/20"
          : "border-line-strong";

        if (!isNavigable) {
          // Locked entries keep the quieter --line: the 3:1 boundary exists to
          // mark something as an interactive control, and this one deliberately
          // isn't. Giving it the control border made a disabled card read as
          // clickable.
          const lockedClasses = isCurrent ? activeClasses : "border-line";
          return (
            <div key={section.id} className={`${baseClasses} ${lockedClasses} cursor-not-allowed opacity-60`}>
              {content}
              <span className="text-xs text-muted">
                Locked until you submit the current section
              </span>
            </div>
          );
        }

        return (
          <Link
            key={section.id}
            href={`/${examId}/quiz/${section.id}`}
            className={`${baseClasses} ${activeClasses} ${isCurrent ? "" : "hover:bg-panel-hover active:bg-line"}`}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
