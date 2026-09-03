"use client";

import Link from "next/link";
import { use } from "react";
import { findExam, findSection } from "@/lib/exams/registry";
import { useAttempt } from "@/components/quiz/useAttempt";
import { SectionLockScreen } from "@/components/quiz/shared";
import FreeFormRunner from "@/components/quiz/FreeFormRunner";
import SequentialRunner from "@/components/quiz/SequentialRunner";

/**
 * The quiz route is a shell, not an implementation.
 *
 * It resolves the exam from the registry, runs the shared attempt hook, and
 * hands the result to whichever runner the exam's `rules.navigation` selects.
 * Adding an exam never touches this file; adding a genuinely new WAY of taking
 * an exam means adding a runner and a value to that rule, which is the only
 * place a new interaction model should have to appear.
 *
 * The parent server layout already 404s an invalid or unavailable exam/section
 * before this ever renders, so the lookups below are type narrowing rather than
 * a real gate — `notFound()` is not a supported call from a Client Component.
 */
export default function QuizPage({
  params,
}: {
  params: Promise<{ examId: string; section: string }>;
}) {
  const { examId, section: sectionId } = use(params);

  const exam = findExam(examId);
  const section = exam ? findSection(examId, sectionId) : undefined;
  const enabled = Boolean(exam && section && exam.available);

  const attempt = useAttempt({
    // Hooks cannot be called conditionally, so a placeholder keeps the call
    // unconditional while `enabled` stops it doing any work for a bad route.
    exam: exam ?? PLACEHOLDER_EXAM,
    section: section ?? PLACEHOLDER_SECTION,
    enabled,
  });

  if (!exam || !section || !exam.available) return null;
  if (attempt.phase === "loading") return null;

  if (attempt.phase === "error") {
    return (
      <div className="flex flex-1 justify-center bg-background">
        <main className="w-full max-w-lg px-6 py-16 text-center sm:py-24">
          <p className="text-sm font-medium tracking-wide text-muted uppercase">Load error</p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
            The questions did not arrive
          </h1>
          <p className="mt-4 leading-relaxed text-foreground/90">
            The site could not load {section.label}. The cause is usually a lost connection. This
            attempt did not start, and it used none of your time. A reload costs you nothing.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn btn-primary"
            >
              Try again
            </button>
            <Link
              href={`/${exam.id}`}
              className="btn btn-secondary"
            >
              Back to sections
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (attempt.phase === "locked" && attempt.blockedBy) {
    return (
      <SectionLockScreen
        examId={exam.id}
        sectionLabel={section.label}
        blockedBy={attempt.blockedBy}
      />
    );
  }

  const Runner = exam.rules.navigation === "sequential" ? SequentialRunner : FreeFormRunner;
  return <Runner exam={exam} section={section} attempt={attempt} />;
}

/** Never rendered: only exists so the hook call above can stay unconditional. */
const PLACEHOLDER_SECTION = {
  id: "",
  label: "",
  description: "",
  questionCount: 0,
  minutes: 0,
  calculator: null,
};

const PLACEHOLDER_EXAM = {
  id: "",
  label: "",
  shortLabel: "",
  description: "",
  theme: { accent: "#000000", accentForeground: "#ffffff" },
  available: false,
  sections: [],
  rules: {
    navigation: "free" as const,
    allowSkip: true,
    adaptive: null,
    reviewEdit: null,
    sectionOrder: "fixed" as const,
    lockToOneSection: false,
    optionalBreakMinutes: null,
  },
  scoring: { kind: "points" as const, pointsPerCorrectAnswer: 1 },
  loadSection: async () => [],
};
