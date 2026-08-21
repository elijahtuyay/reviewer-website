import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getExamConfig, isValidExamId } from "@/lib/exam-config";
import SessionResetNotice from "@/components/SessionResetNotice";

/**
 * Per-exam title/description. The root layout supplies the `%s | Exam Reviewer`
 * template, so this sets only the exam's own name. An exam with no bank yet is
 * explicitly noindex — a "coming soon" page in search results is a dead end.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ examId: string }>;
}): Promise<Metadata> {
  const { examId } = await params;
  if (!isValidExamId(examId)) return {};
  const exam = getExamConfig(examId);
  const totalQuestions = exam.sections.reduce((sum, s) => sum + s.questionCount, 0);

  return {
    title: exam.available ? `${exam.label} practice exam` : `${exam.label} (coming soon)`,
    description: exam.available
      ? `Free ${exam.shortLabel} practice: ${totalQuestions} questions across ${exam.sections.length} independently-timed sections, with a written explanation for every answer.`
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

export default async function ExamSetupPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  if (!isValidExamId(examId)) {
    notFound();
  }
  const exam = getExamConfig(examId);
  const totalQuestions = exam.sections.reduce((sum, s) => sum + s.questionCount, 0);

  if (!exam.available) {
    return (
      <div className="flex flex-1 justify-center bg-background">
        <main className="w-full max-w-2xl px-6 py-16 sm:py-24 text-center">
          <p className="text-sm font-medium tracking-wide text-muted uppercase">Exam Format</p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">{exam.label}</h1>
          <p className="mx-auto mt-4 max-w-md text-foreground/90">
            {exam.shortLabel} practice is being built. The question bank isn&apos;t ready yet, so
            there&apos;s nothing to start here for now.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex items-center justify-center gap-1.5 rounded-md border border-line-strong px-5 py-2.5 text-sm font-medium text-foreground hover:bg-panel-hover"
          >
            Back home
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-1 justify-center bg-background">
      <main className="w-full max-w-2xl px-6 py-16 sm:py-24">
        <p className="text-sm font-medium tracking-wide text-muted uppercase">Exam Format</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">{exam.label}</h1>
        <p className="mt-4 text-foreground/90">
          This reviewer mirrors the real exam: {totalQuestions} questions across{" "}
          {exam.sections.length} independently-timed sections. Here&apos;s what to expect before
          you begin.
        </p>

        <ul className="mt-8 flex flex-col gap-3 text-sm text-foreground/90">
          <li className="flex gap-3">
            <span className="text-muted">•</span>
            <span>
              Each section has its own time limit and question count. Time from one section does
              not carry over to another.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-muted">•</span>
            <span>
              You choose which section to start with. Once a section is in progress, you
              can&apos;t switch to another until you submit it, just like the real exam.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-muted">•</span>
            <span>
              Scoring: +{exam.pointsPerCorrectAnswer} points per correct answer, and there is no
              negative marking for wrong answers.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-muted">•</span>
            <span>
              After you submit a section, you&apos;ll see your score, a per-topic breakdown, and
              every question reviewed with the correct answer and an explanation.
            </span>
          </li>
        </ul>

        <SessionResetNotice examId={exam.id} />

        <div className="mt-10">
          <p className="text-sm font-medium text-foreground">Choose a section to begin</p>
          <div className="mt-3 flex flex-col divide-y divide-line rounded-lg border border-line">
            {exam.sections.map((section) => (
              <Link
                key={section.id}
                href={`/${exam.id}/quiz/${section.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-panel-hover"
              >
                <div>
                  <h2 className="text-sm font-medium text-foreground">{section.label}</h2>
                  <p className="mt-0.5 text-xs text-muted">{section.description}</p>
                </div>
                <div className="shrink-0 text-right text-xs text-muted">
                  <div>{section.questionCount} questions</div>
                  <div>{section.minutes} min</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
