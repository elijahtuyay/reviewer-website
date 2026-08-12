import { notFound } from "next/navigation";
import { getExamConfig, isValidExamId } from "@/lib/exam-config";

/**
 * Applies this exam's accent color as CSS custom properties for every page
 * beneath it. `display: contents` keeps the wrapper out of the layout box
 * entirely — custom properties still inherit to descendants regardless of
 * display, so this is purely a theming scope, not a layout element.
 */
export default async function ExamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  if (!isValidExamId(examId)) {
    notFound();
  }
  const exam = getExamConfig(examId);

  return (
    <div
      className="contents"
      style={
        {
          "--accent": exam.theme.accent,
          "--accent-foreground": exam.theme.accentForeground,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
