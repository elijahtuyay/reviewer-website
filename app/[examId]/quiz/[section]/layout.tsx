import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getExamConfig, isValidExamId } from "@/lib/exam-config";

/**
 * Runs once per `examId` the parent layout generated, so every real quiz URL is
 * prerendered at build time and `dynamicParams = false` turns anything else
 * into a routing-layer 404.
 *
 * Sections are listed for unavailable exams too, even though those URLs are
 * dead: with `dynamicParams = false` Next requires each parent param to produce
 * at least one child param, and returning none for such an exam fails the
 * build outright. The guard below still 404s them — it just does so at build
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
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

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
