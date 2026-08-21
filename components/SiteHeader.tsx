import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { EXAM_LIST } from "@/lib/exams/registry";
import { SITE_NAME } from "@/lib/site";

/**
 * Deliberately not sticky: the quiz page runs its own sticky header at
 * `top-0`, and two stacked sticky bars would either overlap or force the
 * sidebar's `top-24` alignment to be recomputed on every page.
 *
 * The nav used to be three inert "soon" chips (Exams, Pricing, Account), which
 * is a lot of dead pixels for a header. Exams are real links now; Account is
 * the only genuinely unbuilt thing left, and it says so.
 */
export default function SiteHeader() {
  const exams = EXAM_LIST;

  return (
    <header className="border-b border-line bg-panel">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground"
        >
          <span
            aria-hidden
            className="flex h-6 w-6 items-center justify-center rounded bg-accent text-[10px] font-bold text-accent-foreground"
          >
            ER
          </span>
          {SITE_NAME}
        </Link>

        <nav aria-label="Main" className="flex items-center gap-1 text-sm sm:gap-2">
          {exams.map((exam) => (
            <Link
              key={exam.id}
              href={`/${exam.id}`}
              className="flex min-h-11 items-center gap-1.5 rounded-md px-2 text-muted hover:bg-panel-hover hover:text-foreground sm:px-3"
            >
              {exam.shortLabel}
              {!exam.available && (
                <span className="hidden rounded-full bg-panel-hover px-1.5 py-0.5 text-[10px] font-medium sm:inline">
                  soon
                </span>
              )}
            </Link>
          ))}
          <span className="ml-1 hidden items-center gap-1.5 px-2 text-muted md:flex">
            Account
            <span className="rounded-full bg-panel-hover px-1.5 py-0.5 text-[10px] font-medium">
              soon
            </span>
          </span>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
