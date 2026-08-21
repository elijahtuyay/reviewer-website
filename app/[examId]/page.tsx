import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  findExam,
  isValidExamId,
  totalMinutes,
  totalQuestions,
} from "@/lib/exams/registry";
import { ExamModule } from "@/lib/exams/types";
import SessionResetNotice from "@/components/SessionResetNotice";
import SectionStartButton from "@/components/SectionStartButton";

/**
 * Per-exam title/description. The root layout supplies the `%s | Exam Reviewer`
 * template, so this sets only the exam's own name. An exam with no bank yet is
 * explicitly noindex: a "coming soon" page in search results is a dead end.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ examId: string }>;
}): Promise<Metadata> {
  const { examId } = await params;
  const exam = findExam(examId);
  if (!exam) return {};

  return {
    title: exam.available ? `${exam.label} practice exam` : `${exam.label} (coming soon)`,
    description: exam.available
      ? `Free ${exam.shortLabel} practice: ${totalQuestions(exam)} questions across ${
          exam.sections.length
        } independently-timed sections, with a written explanation for every answer.`
      : exam.description,
    alternates: { canonical: `/${exam.id}` },
    robots: exam.available ? undefined : { index: false, follow: true },
    openGraph: {
      type: "website",
      url: `/${exam.id}`,
      title: exam.available ? `${exam.label} practice exam` : `${exam.label} (coming soon)`,
      description: exam.description,
    },
  };
}

/**
 * One page, every exam. Everything it says is read off the exam module: the
 * section list, the scoring line, and the "what to expect" bullets are all
 * derived from `rules` and `scoring` rather than written per exam, so an exam
 * cannot describe itself incorrectly and a new one needs no page of its own.
 */
export default async function ExamSetupPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  if (!isValidExamId(examId)) {
    notFound();
  }
  const exam = findExam(examId)!;

  if (!exam.available) {
    return <ComingSoon exam={exam} />;
  }

  return (
    <div className="flex flex-1 justify-center bg-background">
      <main className="w-full max-w-2xl px-6 py-16 sm:py-24">
        <p className="text-sm font-medium tracking-wide text-muted uppercase">Exam Format</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">{exam.label}</h1>
        <p className="mt-4 text-foreground/90">
          This reviewer mirrors the real exam: {totalQuestions(exam)} questions across{" "}
          {exam.sections.length} independently-timed sections, {totalMinutes(exam)} minutes in
          total. Here&apos;s what to expect before you begin.
        </p>

        <ul className="mt-8 flex flex-col gap-3 text-sm text-foreground/90">
          {expectations(exam).map((line) => (
            <li key={line} className="flex gap-3">
              <span className="text-muted">&bull;</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>

        <SessionResetNotice examId={exam.id} />

        <div className="mt-10">
          <p className="text-sm font-medium text-foreground">
            {exam.rules.sectionOrder === "chooseable"
              ? "Take the sections in any order you like"
              : "Choose a section to begin"}
          </p>
          {exam.rules.sectionOrder === "chooseable" && (
            <p className="mt-1 text-xs text-muted">
              The real exam lets you decide the order before you start, so nothing here is
              sequenced for you.
            </p>
          )}
          <div className="mt-4 flex flex-col gap-4">
            {exam.sections.map((section) => (
              <div key={section.id} className="rounded-lg border border-line bg-panel p-5">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="text-sm font-medium text-foreground">{section.label}</h2>
                  <span className="shrink-0 text-xs text-muted">
                    {section.questionCount} questions &middot; {section.minutes} min
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted">{section.description}</p>
                <SectionStartButton
                  examId={exam.id}
                  sectionId={section.id}
                  sectionLabel={section.label}
                  minutes={section.minutes}
                  questionCount={section.questionCount}
                />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * The "what to expect" list, assembled from the exam's declared rules. Reading
 * these off `rules` rather than writing them per exam is what stops the copy
 * drifting away from what the engine actually does, which is exactly how the
 * old "you can't switch sections" claim ended up being false for months.
 */
function expectations(exam: ExamModule): string[] {
  const lines: string[] = [];

  lines.push(
    "Each section has its own time limit and question count. Time from one section does not carry over to another."
  );

  if (exam.rules.lockToOneSection) {
    lines.push(
      "Once a section is in progress, the others stay locked until you submit it, just like the real exam."
    );
  }

  if (exam.rules.navigation === "sequential") {
    lines.push(
      "Questions come one at a time and you cannot page back through them, because each one is chosen based on how you answered the last."
    );
  } else {
    lines.push(
      "The whole section is on one page. You can answer in any order and change your mind until you submit."
    );
  }

  if (!exam.rules.allowSkip) {
    lines.push(
      "You cannot skip. Every question needs an answer before the next appears, so a considered guess beats stalling."
    );
  }

  if (exam.rules.adaptive) {
    lines.push(
      "The section is adaptive: it opens at medium difficulty, hardens when you string correct answers together, and eases off when you do not."
    );
  }

  if (exam.rules.reviewEdit) {
    lines.push(
      `If you reach the end with time to spare, you get a review pass where you can change up to ${exam.rules.reviewEdit.maxChanges} answers${
        exam.rules.reviewEdit.allowFlagging ? ", starting with any you flagged along the way" : ""
      }.`
    );
  }

  if (exam.scoring.kind === "points") {
    lines.push(
      `Scoring: +${exam.scoring.pointsPerCorrectAnswer} points per correct answer, and there is no negative marking for wrong answers.`
    );
  } else {
    lines.push(
      `Scoring runs from ${exam.scoring.min} to ${exam.scoring.max} and weighs how hard the questions you answered correctly were, so difficulty counts and not just the tally.`
    );
    lines.push(
      "Questions you never reach cost you more than questions you get wrong, which is why finishing matters more than perfecting any one item."
    );
  }

  if (exam.rules.optionalBreakMinutes) {
    // Says what the app ACTUALLY does. It used to claim the Pause button
    // "plays the role" of the exam's timed break, which implied a budget that
    // nothing enforces: pausing here is unlimited in both count and length.
    lines.push(
      `The real exam grants one optional ${exam.rules.optionalBreakMinutes}-minute break. Practising here, the Pause button freezes the clock whenever you need it, with no limit on how often or how long.`
    );
  }

  lines.push(
    "After you submit a section, you'll see your score, a per-topic breakdown, and every question reviewed with the correct answer and an explanation."
  );

  return lines;
}

function ComingSoon({ exam }: { exam: ExamModule }) {
  return (
    <div className="flex flex-1 justify-center bg-background">
      <main className="w-full max-w-2xl px-6 py-16 sm:py-24">
        <div className="text-center">
          <p className="text-sm font-medium tracking-wide text-muted uppercase">Exam Format</p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">{exam.label}</h1>
          <p className="mx-auto mt-4 max-w-md text-foreground/90">
            {exam.shortLabel} practice is being built. The structure below is already mapped out;
            what is missing is the question bank.
          </p>
        </div>

        {/* The format is shown rather than merely promised: the home page tells
            visitors these exams have their format mapped out, and answering
            that with one sentence made the claim look empty. */}
        <div className="mt-8 flex flex-col divide-y divide-line rounded-lg border border-line">
          {exam.sections.map((section) => (
            <div key={section.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <h2 className="text-sm font-medium text-foreground">{section.label}</h2>
                <p className="mt-0.5 text-xs text-muted">{section.description}</p>
              </div>
              <div className="shrink-0 text-right text-xs text-muted">{section.minutes} min</div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="flex min-h-11 items-center justify-center rounded-md bg-accent px-5 text-sm font-medium text-accent-foreground hover:opacity-90"
          >
            See the exams that are ready
          </Link>
        </div>
      </main>
    </div>
  );
}
