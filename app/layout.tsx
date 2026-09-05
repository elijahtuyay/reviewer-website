import type { Metadata } from "next";
import localFont from "next/font/local";
import ThemeInitScript from "@/components/ThemeInitScript";
import SiteHeader from "@/components/SiteHeader";
import PageTransition from "@/components/PageTransition";
import SiteFooter from "@/components/SiteFooter";
import { AVAILABLE_EXAMS } from "@/lib/exams/registry";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import { joinWithAnd } from "@/lib/text";
import { SITE_URL } from "@/lib/site-url";
import "./globals.css";

/*
 * The fonts are committed under `app/fonts/` and loaded from disk.
 *
 * They used to come from `next/font/google`, which downloads them from
 * fonts.gstatic.com at BUILD time. Its docs say it removes external network
 * requests, and that is true of the VISITOR but not of the build. Nothing here
 * held a copy, so the project could not be built without a connection.
 *
 * Dev was the worse half, and not in the way it first looked: `next dev` did
 * NOT fail offline. The Google loader catches a download failure, logs one
 * line, and substitutes `src: local("Arial")`, so the whole site quietly
 * rendered in Arial. Only `next build` threw.
 *
 * `npm run fonts:vendor` refreshes the files and is the only step that needs a
 * network. The rationale, and what else does and does not work offline, is in
 * the "Working offline" section of PROJECT_CONTEXT.md rather than repeated
 * here.
 */
const geistSans = localFont({
  src: "./fonts/Geist-latin.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
  adjustFontFallback: "Arial",
  fallback: ["Arial", "Helvetica", "sans-serif"],
});

const geistMono = localFont({
  src: "./fonts/GeistMono-latin.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
  /*
   * Not "Arial". Next only accepts Arial, Times New Roman or false here, and
   * computing metric overrides for a monospace stack against a proportional
   * face is worse than declining to compute them.
   */
  adjustFontFallback: false,
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
});

/**
 * The display face, used on headings and nowhere else.
 *
 * Every heading, label and paragraph on this site was Geist, separated only by
 * a size class, which is what made the type read as repetitive. A second family
 * gives the eye a way to tell what KIND of thing it is looking at rather than
 * only how big it is.
 *
 * Source Serif 4 rather than the display serifs a font-pairing article will
 * suggest first. Playfair Display and Cormorant Garamond are high-contrast
 * faces built for large sizes: their thin strokes break up below about 24px,
 * and this site sets most of its headings between 18px and 30px. Source Serif
 * is a text face with sturdy stems, so it holds at a section heading and still
 * has presence in the hero. It also reads as institutional rather than
 * editorial, which is the right register for an exam.
 */
const displaySerif = localFont({
  src: "./fonts/SourceSerif4-latin.woff2",
  variable: "--font-display-serif",
  weight: "200 900",
  display: "swap",
  adjustFontFallback: "Times New Roman",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

/**
 * "the NMAT and the GMAT". Read from the registry rather than written out: this
 * description named only NMAT for two releases after the GMAT shipped, which is
 * the same drift the rest of the app avoids by generating its copy.
 */
const EXAM_NAMES = joinWithAnd(AVAILABLE_EXAMS.map((exam) => `the ${exam.shortLabel}`));

/** One sentence per claim, per ASD-STE100. Also the OG and Twitter description. */
const SITE_DESCRIPTION =
  `Free practice exams for ${EXAM_NAMES}. Each section has its own time limit. Each attempt draws a new set of questions. Every answer has a written explanation.`;

/**
 * `metadataBase` is what turns the relative OG/canonical URLs below into
 * absolute ones. Without it Next warns at build time and social cards resolve
 * against nothing. The title template lets each exam page set only its own
 * name — the site used to hard-code "NMAT Reviewer" here, which meant the GMAT
 * page and the multi-exam home page both announced themselves as NMAT.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    // Deliberately no `url` and no `alternates.canonical` here. Next inherits
    // any metadata field a child does not override, so setting them on the root
    // layout made every quiz page declare itself a duplicate of the home page.
    // app/page.tsx sets both for "/" itself.
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${displaySerif.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeInitScript />
        {/* Lets keyboard and screen-reader users jump past the header nav
            straight into the page, which on a 36-question quiz is the
            difference between one Tab and several. */}
        <a
          href="#main-content"
          // Parked off-screen rather than `sr-only`, because Tailwind's
          // `not-sr-only` resets padding to 0 — so the focused skip link was a
          // 100x20 target with its text flush against the edges, on the one
          // control that exists purely for keyboard users. Sliding it in from
          // above keeps the padding and gives it a real 44px box.
          className="absolute -top-20 left-2 z-50 inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground transition-[top] focus:top-2"
        >
          Skip to content
        </a>
        <SiteHeader />
        <PageTransition>{children}</PageTransition>
        <SiteFooter />
      </body>
    </html>
  );
}
