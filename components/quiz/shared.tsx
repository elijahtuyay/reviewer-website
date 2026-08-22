"use client";

import Link from "next/link";
import { ExamId } from "@/data/schema";
import { ActiveAttempt } from "@/lib/section-result";
import { NoticeKind } from "@/components/quiz/useAttempt";

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
            className="flex min-h-11 items-center justify-center rounded-md bg-accent px-5 text-sm font-medium text-accent-foreground hover:opacity-90"
          >
            Back to {blockedBy.label}
          </Link>
          <Link
            href={`/${examId}`}
            className="flex min-h-11 items-center justify-center rounded-md border border-line-strong px-5 text-sm font-medium text-foreground hover:bg-panel-hover"
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
 * Quantitative withholds a calculator on purpose, because the section is built
 * so every question yields to reasoning and estimation, and someone practicing
 * it with a calculator open in another tab is building pacing that collapses on
 * test day. Saying nothing lets them do exactly that.
 *
 * This repo has shipped the inverse mistake before: UI copy claiming a section
 * lock the engine did not enforce. This is the same class of defect read the
 * other way round, a real rule the UI stayed silent about.
 */
export function NoCalculatorNote({ examLabel }: { examLabel: string }) {
  return (
    <p className="mb-4 text-xs leading-relaxed text-muted">
      <span className="font-medium text-foreground">No calculator in this section.</span> The{" "}
      {examLabel} doesn&apos;t provide one here, so every question is meant to come out through
      reasoning and estimation. Practicing with one open is a habit that won&apos;t survive test
      day.
    </p>
  );
}

/**
 * The back link that collapses to a bare arrow below `sm`. At 390px the full
 * text wrapped onto two lines and squeezed the section title down to
 * "Langua...", which is the h1 of the page you are on.
 */
export function BackToSetup({ examId }: { examId: ExamId }) {
  return (
    <Link href={`/${examId}`} className="text-sm text-muted hover:text-foreground">
      <span aria-hidden>&larr;</span>
      <span className="ml-1 hidden sm:inline">Exam setup</span>
      <span className="sr-only">Back to exam setup</span>
    </Link>
  );
}
