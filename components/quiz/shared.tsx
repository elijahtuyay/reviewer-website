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

/**
 * Phrased in the simple past: these banners re-show on every return visit, not
 * just the first. Simple tenses only, per ASD-STE100, so there is no "has been
 * running" here for a reader to unpack mid-attempt.
 */
const NOTICE_COPY = {
  resumed: {
    /**
     * The second sentence is the whole reason this banner exists, and it is
     * why the simple past alone will not do here. "The timer continued after
     * that" permits the reading "it ran on for a while and then stopped". The
     * time is draining right now, so the copy says so in the present and then
     * tells the reader where to look.
     */
    title: "This section is already in progress.",
    detail:
      "You started it earlier in this browser session. The timer did not stop. Check your remaining time above.",
  },
  completed: {
    title: "You already submitted this section.",
    detail: "You submitted it earlier in this browser session. Your scored review is below.",
  },
  expired: {
    /**
     * Says SUBMITTED, not merely that the time ended. This banner sits above a
     * score the reader did not ask for, often a very low one, and the first
     * question it has to answer is "can I still go in?". The answer is no.
     */
    title: "The time ended, and this section was submitted.",
    detail:
      "The site scored the answers you gave before the time ended. You cannot change them now. Your review is below.",
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
        <p className="label-caps text-muted">Section locked</p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
          Finish {blockedBy.label} first
        </h1>
        <p className="mt-4 leading-relaxed text-foreground/90">
          {blockedBy.label} is still in progress, with {blockedBy.answered} of {blockedBy.total}{" "}
          answered, and its timer continues. This site gives you one section at a time, the same as
          the real exam. {sectionLabel} stays closed until you submit {blockedBy.label}.
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
        {/* Not a question. An earlier draft opened "Do you want to stop that
            section?", which puts a yes/no question on a screen with no yes and
            no no. The condition goes first, per STE, and the action follows. */}
        <p className="mt-6 text-xs text-muted">
          To stop that section, clear it on the exam setup page. This section then opens.
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
  const elsewhere = exam.sections.filter(
    (s) => s.calculator === "basic-di" || s.calculator === "gre-standard"
  );
  if (elsewhere.length === 0) return null;

  return (
    <p className="mb-4 text-xs leading-relaxed text-muted">
      <span className="font-medium text-foreground">No calculator in this section.</span> The{" "}
      {exam.label} gives you one in {elsewhere.map((s) => s.label).join(", ")} only.
    </p>
  );
}

/**
 * Shown in a section where the REAL exam provides a calculator and this app
 * does not.
 *
 * Separate from NoCalculatorNote on purpose, because the two say opposite
 * things. "No calculator in this section" is a rule of the exam, and printing
 * it on GRE Quantitative Reasoning would tell a candidate the real test
 * withholds a tool it actually hands them. Saying nothing is no better: someone
 * who expects the calculator will read its absence as a broken page.
 *
 * It states the gap and stops. It does not apologise, and it does not tell the
 * candidate their practice is worth less, which is a lecture delivered on every
 * question of a timed section with no way to dismiss it.
 */
export function CalculatorNotSimulatedNote() {
  return (
    <p className="mb-4 text-xs leading-relaxed text-muted">
      <span className="font-medium text-foreground">
        The real exam gives you a calculator here.
      </span>{" "}
      This site does not include it yet, so work the arithmetic by hand.
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
