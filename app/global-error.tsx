"use client";

/**
 * Last-resort boundary. `app/error.tsx` renders *inside* the root layout, so a
 * throw originating in the root layout itself, or in SiteHeader/SiteFooter,
 * escapes it and would otherwise fall through to Next's built-in error screen.
 * This one replaces the whole document, which is why it has to render its own
 * <html> and <body>.
 *
 * Deliberately styled inline rather than with Tailwind classes: if the failure
 * was in the root layout, the stylesheet it imports may be exactly what did not
 * load. Inline styles are the only ones guaranteed to apply here, and the
 * palette is hard-coded for the same reason (the theme tokens live in that
 * stylesheet). It also cannot rely on ThemeInitScript having run, so it picks a
 * neutral light surface rather than guessing at the user's theme.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          background: "#f6f2ea",
          color: "#2b2a27",
          fontFamily: "Arial, Helvetica, sans-serif",
          textAlign: "center",
        }}
      >
        <main style={{ maxWidth: "28rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>
            The app failed to load
          </h1>
          <p style={{ marginTop: "1rem", lineHeight: 1.6 }}>
            Something went wrong outside the page itself. Reloading usually fixes it, and any
            section you had started is still saved in this browser tab.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "2rem",
              minHeight: "2.75rem",
              padding: "0 1.5rem",
              borderRadius: "0.375rem",
              border: "none",
              background: "#0f7b4d",
              color: "#ffffff",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
