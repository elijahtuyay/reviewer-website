import Link from "next/link";
import { EXAM_LIST } from "@/lib/exams/registry";
import { AFFILIATION_DISCLAIMER, SITE_NAME } from "@/lib/site";

/**
 * Sits in the root layout, outside PageTransition, so it doesn't re-animate on
 * every navigation. Its real job is the disclaimer: a practice site that names
 * a real exam has to say plainly that it isn't the exam board.
 */
export default function SiteFooter() {
  const exams = EXAM_LIST;

  return (
    <footer className="mt-auto border-t border-line bg-panel">
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          <div className="max-w-xs">
            <p className="text-sm font-semibold text-foreground">{SITE_NAME}</p>
            <p className="mt-2 text-sm text-muted">
              Free practice exams with real section time limits. Every answer has a written
              explanation.
            </p>
          </div>

          {/* No gap: each link already carries min-h-11 for the tap target, and adding gap on top of that spaced one-word links ~52px apart. */}
          <nav aria-label="Footer" className="flex flex-col">
            <p className="label-caps text-muted">Exams</p>
            {exams.map((exam) => (
              <Link
                key={exam.id}
                href={`/${exam.id}`}
                className="inline-flex min-h-11 items-center gap-2 text-sm text-foreground transition-colors hover:text-accent-text hover:underline"
              >
                {exam.shortLabel}
                {!exam.available && (
                  <span className="rounded-full bg-panel-hover px-1.5 py-0.5 text-xs font-medium text-muted">
                    soon
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-8 border-t border-line pt-6">
          <p className="label-caps text-muted">Disclaimer</p>
          <p className="mt-2 text-xs leading-relaxed text-muted">{AFFILIATION_DISCLAIMER}</p>
          {/* Stamped at build time, not per request: every route is
              statically prerendered, so this year advances on deploy rather
              than on New Year's Day. */}
          <p className="mt-4 text-xs text-muted">
            &copy; {new Date().getFullYear()} {SITE_NAME}. Made in the Philippines.
          </p>
        </div>
      </div>
    </footer>
  );
}
