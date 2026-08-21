import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getExamConfig, isValidExamId } from "@/lib/exam-config";

/**
 * Runs once per `examId` the parent layout generated, so every real quiz URL is
 * prerendered at build time and `dynamicParams = false` turns anything else
 * into a routing-layer 404.
 *
 * Sections are listed for unavailable exams too, even though those URLs are
 * dead. Returning an empty array for such an exam fails the build on 16.3.0
 * with "exports dynamicParams: false but the param section is missing from the
 * generated route params" — verified by hitting it. The guard below still 404s
 * them — it just does so at build
 * time now, which is the same answer prerendered instead of computed per
 * request.
 */
export function generateStaticParams({ params }: { params: { examId: string } }) {
  if (!isValidExamId(params.examId)) return [];
  return getExamConfig(params.examId).sections.map((s) => ({ section: s.id }));
}

export const dynamicParams = false;

/**
 * Quiz pages render nothing until the client has hydrated and drawn a question
 * set, so there is no content here worth indexing — and a search result landing
 * a stranger mid-attempt is worse than no result at all.
 */
/**
 * Each section gets its own browser-tab title: all three used to inherit the
 * home page's, so a user with Language Skills, Quantitative Skills, and
 * Logical Reasoning open in three tabs could not tell them apart.
 *
 * `noindex` without a robots.txt Disallow is deliberate. Blocking the crawl
 * would stop a crawler from ever reading this tag, which leaves the URL
 * eligible for URL-only indexing from an inbound link; letting it fetch the
 * page and read `noindex` is what actually keeps it out of the index.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ examId: string; section: string }>;
}): Promise<Metadata> {
  const { examId, section } = await params;
  if (!isValidExamId(examId)) return { robots: { index: false, follow: true } };
  const exam = getExamConfig(examId);
  const sectionConfig = exam.sections.find((s) => s.id === section);

  return {
    title: sectionConfig ? `${sectionConfig.label} — ${exam.shortLabel}` : exam.label,
    robots: { index: false, follow: true },
  };
}

/**
 * Server-side guard for the quiz route: 404s for an invalid examId/section
 * or an exam that isn't available yet (e.g. GMAT, which is scaffolded but
 * has no question bank). Keeps this validation in a Server Component since
 * `notFound()` isn't a supported call from Client Components.
 */
export default async function QuizSectionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ examId: string; section: string }>;
}) {
  const { examId, section } = await params;
  if (!isValidExamId(examId)) {
    notFound();
  }
  const exam = getExamConfig(examId);
  if (!exam.available || !exam.sections.some((s) => s.id === section)) {
    notFound();
  }

  return children;
}
