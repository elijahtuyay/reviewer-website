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
import { loadSection } from "@/lib/question-bank";
import { joinWithAnd } from "@/lib/text";

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
      ? `Free ${exam.shortLabel} practice. ${totalQuestions(exam)} questions in ${
          exam.sections.length
        } sections. Each section has its own time limit. Every answer has a written explanation.`
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

  /*
   * The size of the pool each section draws from, read at build time.
   *
   * The home page advertises the whole bank as one number, and a GMAT candidate
   * seeing "390 questions written by hand" would reasonably expect that to be
   * what they get. They get 90 -- 30 per section, against sections of 20 to 23 --
   * so a second attempt re-serves most of the same pool with nothing on the page
   * having said so. Stating the pool per section is the honest version, and it
   * is the number that actually tells you how much repetition to expect.
   *
   * This is a Server Component and the page is prerendered, so the banks are
   * read at build time and never reach the browser.
   */
  const poolSizes = new Map(
    await Promise.all(
      exam.sections.map(
        async (section) =>
          [section.id, (await loadSection(exam.id, section.id)).length] as const
      )
    )
  );

  return (
    <div className="flex flex-1 justify-center bg-background">
      <main className="w-full max-w-2xl px-6 py-16 sm:py-24">
        <p className="text-sm font-medium tracking-wide text-muted uppercase">Exam Format</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">{exam.label}</h1>
        <p className="mt-4 text-foreground/90">
          This exam has {totalQuestions(exam)} questions in {exam.sections.length} sections. Each
          section has its own time limit. The total time is {totalMinutes(exam)} minutes. Read the
          points below before you start.
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
              ? "Take the sections in any order"
              : "Select a section to start"}
          </p>
          {exam.rules.sectionOrder === "chooseable" && (
            <p className="mt-1 text-xs text-muted">
              The real exam also lets you decide the order before you start.
            </p>
          )}
          <div className="mt-4 flex flex-col gap-4">
            {exam.sections.map((section) => (
              <div key={section.id} className="rounded-lg border border-line bg-panel p-5">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="text-sm font-medium text-foreground">{section.label}</h2>
                  <span className="shrink-0 text-xs text-muted">
                    {section.questionCount} questions &middot; {section.minutes} min
                    {poolSizes.get(section.id) ? (
                      <>
                        {" "}
                        &middot; drawn from {poolSizes.get(section.id)}
                      </>
                    ) : null}
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
    "Each section has its own time limit and its own question count. You cannot use time from one section in another section."
  );

  if (exam.rules.lockToOneSection) {
    lines.push(
      "While a section is in progress, the other sections stay locked. You must submit that section first. The real exam does the same."
    );
  }

  if (exam.rules.navigation === "sequential") {
    lines.push(
      "The questions come one at a time. You cannot return to a previous question, because each question depends on your previous answers."
    );
  } else {
    lines.push(
      "The whole section is on one page. You can answer in any order. You can change an answer until you submit."
    );
  }

  if (!exam.rules.allowSkip) {
    lines.push(
      "You cannot skip a question. Each question needs an answer before the next question appears. A considered guess is better than a long delay."
    );
  }

  if (exam.rules.adaptive) {
    // Two in a row, both ways: `stepUpAfter` and `stepDownAfter` are both 2, so
    // "after correct answers" on one side and "after incorrect ones" on the
    // other stated the condition asymmetrically and understated it twice.
    lines.push(
      "The section is adaptive. It starts at medium difficulty. It becomes harder after two correct answers in a row, and easier after two incorrect answers in a row."
    );
  }

  if (exam.rules.reviewEdit) {
    lines.push(
      `If you reach the end and time remains, you enter a review pass. There you can change up to ${exam.rules.reviewEdit.maxChanges} answers${
        // NOT "the flagged questions come first". They do not: ReviewPass keeps
        // the served order on purpose, and what it adds is a list of links at
        // the top. Saying "come first" asserts an ordering the engine does not
        // do, which is the exact defect this repo shipped once before.
        exam.rules.reviewEdit.allowFlagging ? ", and a list of the questions you flagged is at the top" : ""
      }.`
    );
  }

  if (exam.scoring.kind === "points") {
    lines.push(
      `Each correct answer is worth ${exam.scoring.pointsPerCorrectAnswer} points. An incorrect answer costs you nothing.`
    );
  } else {
    lines.push(
      `The score runs from ${exam.scoring.min} to ${exam.scoring.max}. It includes the difficulty of the questions you answered correctly, not only the count.`
    );
    lines.push(
      "A question you never reach costs you more than an incorrect answer. Finish the section, and do not spend all your time on one question."
    );
  }

  /**
   * Where a calculator is and is not provided.
   *
   * Derived from the sections rather than written per exam, for the same reason
   * as everything else in this function: on GMAT Focus the calculator is a
   * Data-Insights-only tool, and a hand-written sentence naming it would be one
   * more claim to keep in sync with `SectionConfig.calculator`. This phrasing
   * survives a section being added, renamed, or having its calculator changed.
   *
   * The "and none in the others" half is the part that earns its place. Someone
   * who assumes a calculator is available throughout will practice Quantitative
   * with one open in another tab, which is precisely the habit that section is
   * built to punish.
   */
  const withCalculator = exam.sections.filter((s) => s.calculator !== null);
  if (withCalculator.length > 0 && withCalculator.length < exam.sections.length) {
    lines.push(
      `This exam gives you an on-screen calculator in ${joinWithAnd(withCalculator.map((s) => s.label))} only, exactly as the real exam does. It is a copy of the exam calculator, with the same limits. The display holds 8 digits, and it calculates strictly left to right with no order of operations.`
    );
  } else if (withCalculator.length === 0) {
    lines.push(
      "No section gives you a calculator, on screen or otherwise. The real exam does not give you one either."
    );
  }

  if (exam.rules.optionalBreakMinutes) {
    // Says what the app ACTUALLY does. It used to claim the Pause button
    // "plays the role" of the exam's timed break, which implied a budget that
    // nothing enforces: pausing here is unlimited in both count and length.
    lines.push(
      `The real exam gives you one optional ${exam.rules.optionalBreakMinutes}-minute break. Here, the Pause button stops the timer at any time. There is no limit on the number of pauses or on their length.`
    );
  }

  // What happens at zero was on the home page and nowhere on this one, which
  // is the page a visitor reads immediately before starting a timed section.
  lines.push(
    "When the timer reaches zero, the section submits your answers and scores them. You do not lose the work you did."
  );

  lines.push(
    "After you submit a section, you see your score and a result for each topic. You also see every question, its correct answer and an explanation."
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
            {exam.shortLabel} practice is not ready yet. The format below is complete. The question
            bank is not complete.
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
            className="btn btn-primary"
          >
            See the exams that are ready
          </Link>
        </div>
      </main>
    </div>
  );
}
