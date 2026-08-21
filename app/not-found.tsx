import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

/**
 * Replaces Next's bare built-in 404. Reached by a mistyped URL, and by the
 * `notFound()` guards on unknown exam ids and sections — including a quiz URL
 * for an exam whose question bank doesn't exist yet, which is the likeliest way
 * a real visitor lands here.
 */
export default function NotFound() {
  return (
    <div className="flex flex-1 justify-center bg-background">
      <main className="w-full max-w-lg px-6 py-24 text-center">
        <p className="text-sm font-medium tracking-wide text-muted uppercase">Error 404</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">
          We couldn&apos;t find that page
        </h1>
        <p className="mt-4 text-foreground/90">
          The link may be out of date, or the exam it points to may not have a question bank yet.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="flex min-h-11 items-center justify-center rounded-md bg-accent px-5 text-sm font-medium text-accent-foreground hover:opacity-90"
          >
            Back to home
          </Link>
          <Link
            href="/nmat"
            className="flex min-h-11 items-center justify-center rounded-md border border-line-strong px-5 text-sm font-medium text-foreground hover:bg-panel-hover"
          >
            Go to NMAT practice
          </Link>
        </div>
      </main>
    </div>
  );
}
