"use client";

import Link from "next/link";
import { getExamConfig } from "@/lib/exam-config";
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
  const sections = getExamConfig(examId).sections;

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
              }
            : isCurrent
              ? { submitted: false, total: section.questionCount, answered: currentAnsweredCount, skipped: 0, correct: 0, incorrect: 0 }
              : getSectionBreakdown(examId, section.id, section.questionCount);

        const content = (
          <>
            <span className="text-sm font-medium">{section.label}</span>
            {breakdown.submitted ? (
              <span className="flex gap-2 text-xs">
                <span className="text-green-700 dark:text-green-400">{breakdown.correct} correct</span>
                <span className="text-red-700 dark:text-red-400">{breakdown.incorrect} wrong</span>
                <span className="text-muted">{breakdown.skipped} skipped</span>
              </span>
            ) : (
              <span className="text-xs text-muted">
                {breakdown.answered}/{section.questionCount}
              </span>
            )}
          </>
        );

        const baseClasses = "flex flex-col gap-0.5 rounded-md border px-3 py-2.5 transition-colors";
        const activeClasses = isCurrent ? "border-accent bg-accent/10 dark:bg-accent/20" : "border-line";

        if (!isNavigable) {
          return (
            <div key={section.id} className={`${baseClasses} ${activeClasses} cursor-not-allowed opacity-60`}>
              {content}
              <span className="text-[11px] text-muted">Locked until current section is submitted</span>
            </div>
          );
        }

        return (
          <Link
            key={section.id}
            href={`/${examId}/quiz/${section.id}`}
            className={`${baseClasses} ${activeClasses} ${isCurrent ? "" : "hover:bg-panel-hover"}`}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
