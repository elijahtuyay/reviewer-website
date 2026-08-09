import Link from "next/link";
import { SECTIONS } from "@/lib/exam-config";

export default function Home() {
  return (
    <div className="flex flex-1 justify-center bg-white">
      <main className="w-full max-w-2xl px-6 py-16 sm:py-24">
        <p className="text-sm font-medium tracking-wide text-neutral-500 uppercase">
          NMAT by GMAC Reviewer
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-neutral-900 sm:text-4xl">
          Practice the exam the way it&apos;s actually structured.
        </h1>
        <p className="mt-4 max-w-xl text-neutral-600">
          108 questions across three independently-timed sections, matching the real NMAT
          question counts and time limits. After you submit, every question is reviewed with
          the correct answer and a written explanation — no guessing why you missed one.
        </p>

        <div className="mt-10 flex flex-col divide-y divide-neutral-200 border-t border-b border-neutral-200">
          {SECTIONS.map((section) => (
            <Link
              key={section.id}
              href={`/quiz/${section.id}`}
              className="flex items-center justify-between gap-4 py-5 transition-colors hover:bg-neutral-50"
            >
              <div>
                <h2 className="text-lg font-medium text-neutral-900">{section.label}</h2>
                <p className="mt-1 text-sm text-neutral-500">{section.description}</p>
              </div>
              <div className="shrink-0 text-right text-sm text-neutral-500">
                <div>{section.questionCount} questions</div>
                <div>{section.minutes} min</div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
