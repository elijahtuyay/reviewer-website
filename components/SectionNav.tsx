"use client";

import Link from "next/link";
import { SECTIONS } from "@/lib/exam-config";
import { SectionId } from "@/data/schema";
import { getAnsweredCount } from "@/lib/local-progress";

interface SectionNavProps {
  currentSection: SectionId;
  currentAnsweredCount: number;
  /** True while the current section is still in progress — the real NMAT locks you into a section until it's finished. */
  locked: boolean;
}

export default function SectionNav({ currentSection, currentAnsweredCount, locked }: SectionNavProps) {
  return (
    <nav className="flex flex-col gap-1.5">
      <p className="mb-1 px-1 text-xs font-medium tracking-wide text-muted uppercase">Sections</p>
      {SECTIONS.map((section) => {
        const isCurrent = section.id === currentSection;
        const answeredCount = isCurrent ? currentAnsweredCount : getAnsweredCount(section.id);
        const isNavigable = isCurrent || !locked;

        const content = (
          <>
            <span className="text-sm font-medium">{section.label}</span>
            <span className="text-xs text-muted">
              {answeredCount}/{section.questionCount}
            </span>
          </>
        );

        const baseClasses = "flex flex-col gap-0.5 rounded-md border px-3 py-2.5 transition-colors";
        const activeClasses = isCurrent
          ? "border-blue-600 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/30"
          : "border-line";

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
            href={`/quiz/${section.id}`}
            className={`${baseClasses} ${activeClasses} ${isCurrent ? "" : "hover:bg-panel-hover"}`}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
