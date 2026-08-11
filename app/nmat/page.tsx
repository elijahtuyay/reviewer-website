import Link from "next/link";
import { SECTIONS, POINTS_PER_CORRECT_ANSWER } from "@/lib/exam-config";

export default function NmatSetupPage() {
  const totalQuestions = SECTIONS.reduce((sum, s) => sum + s.questionCount, 0);

  return (
    <div className="flex flex-1 justify-center bg-background">
      <main className="w-full max-w-2xl px-6 py-16 sm:py-24">
        <p className="text-sm font-medium tracking-wide text-muted uppercase">Exam Format</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">NMAT by GMAC</h1>
        <p className="mt-4 text-foreground/90">
          This reviewer mirrors the real exam: {totalQuestions} questions across three
          independently-timed sections. Here&apos;s what to expect before you begin.
        </p>

        <ul className="mt-8 flex flex-col gap-3 text-sm text-foreground/90">
          <li className="flex gap-3">
            <span className="text-muted">•</span>
            <span>
              Each section has its own time limit and question count — time from one section
              does not carry over to another.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-muted">•</span>
            <span>
              You choose which section to start with. Once a section is in progress, you
              can&apos;t switch to another until you submit it — just like the real exam.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-muted">•</span>
            <span>
              Scoring: +{POINTS_PER_CORRECT_ANSWER} points per correct answer, and there is no
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

        <div className="mt-10">
          <p className="text-sm font-medium text-foreground">Choose a section to begin</p>
          <div className="mt-3 flex flex-col divide-y divide-line rounded-lg border border-line">
            {SECTIONS.map((section) => (
              <Link
                key={section.id}
                href={`/quiz/${section.id}`}
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
