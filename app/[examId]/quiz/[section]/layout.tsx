import { notFound } from "next/navigation";
import { getExamConfig, isValidExamId } from "@/lib/exam-config";

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
