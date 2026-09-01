"use client";

import Link from "next/link";
import { ExamId } from "@/data/schema";
import { ActiveAttempt } from "@/lib/section-result";
import { NoticeKind } from "@/components/quiz/useAttempt";
import { ExamModule } from "@/lib/exams/types";

/**
 * Chrome shared by every runner. Anything here is exam-agnostic on purpose: if
 * a piece of it needs to differ per exam, it belongs behind a rule in
 * `ExamRules`, not behind an `examId` check.
 */

/** Phrased in the past tense: these banners re-show on every return visit, not just the first. */
const NOTICE_COPY = {
  resumed: {
    title: "You have an attempt already in progress.",
    detail:
      "It was started earlier in this browser session, and its timer has been running since then.",
  },
  completed: {
    title: "You already submitted this section.",
    detail: "It was submitted earlier in this browser session. Your scored review is below.",
  },
  expired: {
    title: "This section was submitted when its time ran out.",
    detail: "Your answers up to that point were scored. Review them below.",
  },
} as const;

export function AttemptNotice({ notice }: { notice: NoticeKind }) {
  return (
    // Mounted unconditionally so that populating it later counts as a content
    // change a screen reader will announce.
    <div role="status" aria-live="polite">
      {notice && (
        <div className="mb-4 rounded-lg border border-line bg-panel px-4 py-3">
          <p className="text-sm font-medium text-foreground">{NOTICE_COPY[notice].title}</p>
          <p className="mt-0.5 text-xs text-muted">{NOTICE_COPY[notice].detail}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Shown when another section holds a live attempt on an exam that locks you to
 * one at a time. Names the way out, because the alternative is a user who feels
 * trapped in a section they opened by mistake.
 */
export function SectionLockScreen({
  examId,
  sectionLabel,
  blockedBy,
}: {
  examId: ExamId;
  sectionLabel: string;
  blockedBy: ActiveAttempt;
}) {
  return (
    <div className="flex flex-1 justify-center bg-background">
      <main className="w-full max-w-lg px-6 py-16 text-center sm:py-24">
        <p className="text-sm font-medium tracking-wide text-muted uppercase">Section locked</p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
          Finish {blockedBy.label} first
        </h1>
        <p className="mt-4 leading-relaxed text-foreground/90">
          {blockedBy.label} is still in progress ({blockedBy.answered} of {blockedBy.total}{" "}
          answered) and its timer is running. Sections are taken one at a time here, the same way
          they are in the real exam, so {sectionLabel} stays closed until that one is submitted.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href={`/${examId}/quiz/${blockedBy.sectionId}`}
            className="btn btn-primary"
          >
            Back to {blockedBy.label}
          </Link>
          <Link
            href={`/${examId}`}
            className="btn btn-secondary"
          >
            Exam setup
          </Link>
        </div>
        <p className="mt-6 text-xs text-muted">
          Don&apos;t want to finish it? Clear that section from the exam setup page and this one
          will open.
        </p>
      </main>
    </div>
  );
}

/**
 * Says out loud that a section gives you no calculator.
 *
 * An absence reads as an unbuilt feature; a sentence reads as a rule. GMAT
 * Quantitative withholds a calculator on purpose, and someone who assumes the
 * tool is available throughout will practice it with one open in another tab,
 * which is pacing that collapses on test day. Saying nothing lets them.
 *
 * This repo has shipped the inverse mistake before: UI copy claiming a section
 * lock the engine did not enforce. This is the same class of defect read the
 * other way round, a real rule the UI stayed silent about.
 *
 * The copy states the rule and stops. An earlier draft went on to tell the
 * reader that practicing with a calculator open "won't survive test day",
 * which is a lecture delivered to someone who has done nothing wrong, on all
 * 21 questions of a sequential section, with no way to dismiss it.
 */
export function NoCalculatorNote({ exam }: { exam: ExamModule }) {
  /**
   * Only worth saying where the SAME exam hands you a calculator somewhere
   * else. That condition is the whole point of the note: on GMAT Focus the
   * tool exists and this section is the exception, which is a genuine rule
   * someone can be caught out by.
   *
   * On an exam that grants none anywhere, this rendered on NMAT Language
   * Skills and told the reader that a preposition question was "meant to come
   * out through reasoning and estimation", and that the exam "doesn't provide
   * one HERE" — implying some other NMAT section does. Both false, on top of
   * being redundant with the setup page, which already says NMAT gives you
   * none in any section.
   */
  const elsewhere = exam.sections.filter((s) => s.calculator !== null);
  if (elsewhere.length === 0) return null;

  return (
    <p className="mb-4 text-xs leading-relaxed text-muted">
      <span className="font-medium text-foreground">No calculator in this section.</span> The{" "}
      {exam.label} provides one only in{" "}
      {elsewhere.map((s) => s.label).join(", ")}.
    </p>
  );
}

/**
 * The back link that collapses to a bare arrow below `sm`. At 390px the full
 * text wrapped onto two lines and squeezed the section title down to
 * "Langua...", which is the h1 of the page you are on.
 */
export function BackToSetup({ examId }: { examId: ExamId }) {
  // inline-flex + min-h/min-w-11: below `sm` this collapses to a bare arrow,
  // which was a ~20px tap target — on the one viewport where it is the only way
  // back to the setup page.
  return (
    <Link
      href={`/${examId}`}
      className="inline-flex min-h-11 min-w-11 items-center text-sm text-muted transition-colors hover:text-foreground"
    >
      <span aria-hidden>&larr;</span>
      <span className="ml-1 hidden sm:inline">Exam setup</span>
      <span className="sr-only">Back to exam setup</span>
    </Link>
  );
}
