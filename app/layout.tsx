import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ThemeInitScript from "@/components/ThemeInitScript";
import SiteHeader from "@/components/SiteHeader";
import PageTransition from "@/components/PageTransition";
import SiteFooter from "@/components/SiteFooter";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import { SITE_URL } from "@/lib/site-url";
import "katex/dist/katex.min.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
  description:
    "Free timed practice exams for NMAT by GMAC. Three independently-timed sections, a fresh question set every attempt, and a written explanation for every answer.",
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    // Deliberately no `url` and no `alternates.canonical` here. Next inherits
    // any metadata field a child does not override, so setting them on the root
    // layout made every quiz page declare itself a duplicate of the home page.
    // app/page.tsx sets both for "/" itself.
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description:
      "Free timed practice exams for NMAT by GMAC, with a written explanation for every answer.",
  },
  twitter: {
    card: "summary",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description:
      "Free timed practice exams for NMAT by GMAC, with a written explanation for every answer.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeInitScript />
        {/* Lets keyboard and screen-reader users jump past the header nav
            straight into the page, which on a 36-question quiz is the
            difference between one Tab and several. */}
        <a
          href="#main-content"
          className="sr-only rounded-md bg-accent px-4 py-3 text-sm font-medium text-accent-foreground focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
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
