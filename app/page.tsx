import Link from "next/link";
import { SECTIONS } from "@/lib/exam-config";

export default function Home() {
  return (
    <div className="flex flex-1 justify-center bg-background">
      <main className="w-full max-w-4xl px-6 py-16 sm:py-24">
        {/* Hero */}
        <div className="text-center">
          <p className="text-sm font-medium tracking-wide text-muted uppercase">
            Exam Reviewer Platform
          </p>
          <h1 className="mx-auto mt-3 max-w-2xl text-3xl font-semibold text-foreground sm:text-4xl">
            Practice exams the way they&apos;re actually structured.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted">
            Real question counts, real time limits, and every answer explained — not
            AI-generated on the fly, but a hand-verified question bank you can trust.
          </p>
          <div className="mt-8">
            <Link
              href="/nmat"
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-foreground px-6 py-2.5 text-sm font-medium text-background hover:opacity-90"
            >
              Start Practicing for the NMAT
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>

        {/* Practice sections (preview only — start from the exam setup page) */}
        <div className="mt-20">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-foreground">NMAT by GMAC</h2>
            <span className="text-xs font-medium text-green-700 dark:text-green-400">Available now</span>
          </div>
          <p className="mt-1 text-sm text-muted">
            108 questions across three independently-timed sections, matching the real exam.
          </p>

          <div className="mt-6 flex flex-col divide-y divide-line rounded-lg border border-line">
            {SECTIONS.map((section) => (
              <div key={section.id} className="flex items-center justify-between gap-4 px-5 py-5">
                <div>
                  <h3 className="text-base font-medium text-foreground">{section.label}</h3>
                  <p className="mt-1 text-sm text-muted">{section.description}</p>
                </div>
                <div className="shrink-0 text-right text-sm text-muted">
                  <div>{section.questionCount} questions</div>
                  <div>{section.minutes} min</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Platform / future features */}
        <div className="mt-16">
          <h2 className="text-lg font-semibold text-foreground">Platform</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <PlaceholderCard
              title="Other Exams"
              description="College entrance exams and more, coming soon."
            />
            <PlaceholderCard
              title="Account"
              description="Save your progress and attempt history."
            />
            <PlaceholderCard
              title="Upgrade"
              description="Expanded question banks and extra features."
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function PlaceholderCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line p-5 opacity-70">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <span className="rounded-full bg-panel-hover px-2 py-0.5 text-[10px] font-medium text-muted">
          Coming soon
        </span>
      </div>
      <p className="mt-2 text-sm text-muted">{description}</p>
    </div>
  );
}
