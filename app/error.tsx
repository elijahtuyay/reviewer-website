"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Route-level error boundary. Without one, an unexpected throw anywhere under
 * the root layout replaces the whole page with Next's built-in error screen —
 * and mid-quiz that reads as "the app ate my attempt". Reset re-renders the
 * segment, and the attempt itself is recoverable regardless: answers and the
 * deadline live in sessionStorage, so a reload picks up where it left off.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 justify-center bg-background">
      <main className="w-full max-w-lg px-6 py-24 text-center">
        <p className="text-sm font-medium tracking-wide text-muted uppercase">Something broke</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">This page hit an error</h1>
        <p className="mt-4 text-foreground/90">
          Your answers for any section you started are still saved for this browser tab, so trying
          again should pick up where you left off.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="btn btn-primary"
          >
            Try again
          </button>
          <Link
            href="/"
            className="btn btn-secondary"
          >
            Back to home
          </Link>
        </div>
        {error.digest && (
          <p className="mt-6 font-mono text-xs text-muted">Reference: {error.digest}</p>
        )}
      </main>
    </div>
  );
}
