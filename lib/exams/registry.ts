import { ExamId, SectionId } from "@/data/schema";
import { ExamModule, SectionConfig } from "@/lib/exams/types";
import nmat from "@/lib/exams/nmat";
import gmat from "@/lib/exams/gmat";
import gre from "@/lib/exams/gre";

/**
 * THE ONLY FILE THAT LISTS EXAMS.
 *
 * To add one: create `lib/exams/<id>/index.ts` default-exporting an ExamModule,
 * import it here, and add it to the array below. Nothing else in the app needs
 * to change. Routes, the home page, the setup page, the section lock, the
 * sitemap, and the quiz engine all read from this registry, so a new exam
 * appears everywhere at once.
 *
 * Order matters only for display: the first available exam is what the home
 * page features.
 */
const MODULES: ExamModule[] = [nmat, gmat, gre];

export const EXAMS: Record<ExamId, ExamModule> = Object.fromEntries(
  MODULES.map((m) => [m.id, m])
);

/** Registration order, which is the order exams are listed in the UI. */
export const EXAM_LIST: ExamModule[] = MODULES;

/** Exams with a usable question bank. The home page features the first of these. */
export const AVAILABLE_EXAMS: ExamModule[] = MODULES.filter((m) => m.available);

export function isValidExamId(examId: string): boolean {
  return examId in EXAMS;
}

export function getExam(examId: string): ExamModule {
  const exam = EXAMS[examId];
  if (!exam) throw new Error(`Unknown exam: ${examId}`);
  return exam;
}

/** Undefined rather than throwing, for callers that are probing a URL segment. */
export function findExam(examId: string): ExamModule | undefined {
  return EXAMS[examId];
}

export function getSection(examId: string, sectionId: SectionId): SectionConfig {
  const exam = getExam(examId);
  const section = exam.sections.find((s) => s.id === sectionId);
  if (!section) throw new Error(`Unknown section: ${sectionId} for exam ${examId}`);
  return section;
}

export function findSection(examId: string, sectionId: SectionId): SectionConfig | undefined {
  return findExam(examId)?.sections.find((s) => s.id === sectionId);
}

/** Total questions in one full sitting of the exam, across every section. */
export function totalQuestions(exam: ExamModule): number {
  return exam.sections.reduce((sum, s) => sum + s.questionCount, 0);
}

/** Total time for one full sitting, in minutes, excluding any optional break. */
export function totalMinutes(exam: ExamModule): number {
  return exam.sections.reduce((sum, s) => sum + s.minutes, 0);
}
