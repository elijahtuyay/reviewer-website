import { notFound } from "next/navigation";
import { EXAMS, getExamConfig, isValidExamId } from "@/lib/exam-config";

/**
 * The exam registry is a compile-time constant, so every exam route can be
 * prerendered at build time instead of being server-rendered per request.
 * `dynamicParams = false` makes anything outside that list a 404 without ever
 * invoking a server render — which is also what lets the whole site be served
 * as static files (see README, "Hosting").
 */
export function generateStaticParams() {
  return Object.keys(EXAMS).map((examId) => ({ examId }));
}

export const dynamicParams = false;

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
      // `exam-theme` is not cosmetic: globals.css uses it to re-derive
      // --accent-text from the --accent set inline below. Without the class the
      // text variant stays bound to :root's accent. See globals.css.
      className="exam-theme contents"
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
