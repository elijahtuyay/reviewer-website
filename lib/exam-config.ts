import { ExamId, SectionId } from "@/data/schema";

export interface SectionConfig {
  id: SectionId;
  label: string;
  description: string;
  questionCount: number;
  minutes: number;
}

/** Per-exam accent color. Kept to a single hex (not separate light/dark shades) and applied via Tailwind opacity modifiers (e.g. bg-accent/10), which reads fine in both themes. */
export interface ExamTheme {
  accent: string;
  accentForeground: string;
}

export interface ExamConfig {
  id: ExamId;
  label: string;
  shortLabel: string;
  description: string;
  theme: ExamTheme;
  sections: SectionConfig[];
  pointsPerCorrectAnswer: number;
  /** False for exams that are scaffolded (routes/config exist) but don't have a real question bank yet. */
  available: boolean;
}

/**
 * Single source of truth for each exam's structure (sections, question counts,
 * per-section time limits, theme). Real-world exam boards update their pattern
 * occasionally — update only here if that happens, not per-component.
 *
 * NMAT by GMAC's accent is approximated from the exam's brand green — the live
 * mba.com/exams/nmat page sits behind bot-protection that blocked scraping the
 * exact brand hex during development, so this is a close professional-green
 * approximation, not a pixel-verified value. Swap it here if you have the
 * exact one.
 */
export const EXAMS: Record<ExamId, ExamConfig> = {
  nmat: {
    id: "nmat",
    label: "NMAT by GMAC",
    shortLabel: "NMAT",
    description: "Practice quizzes for NMAT by GMAC: timed sections, instant review, and explained answers.",
    theme: { accent: "#0f7b4d", accentForeground: "#ffffff" },
    pointsPerCorrectAnswer: 3,
    available: true,
    sections: [
      {
        id: "language-skills",
        label: "Language Skills",
        description: "Reading comprehension, grammar, vocabulary, and sentence correction.",
        questionCount: 36,
        minutes: 28,
      },
      {
        id: "quantitative-skills",
        label: "Quantitative Skills",
        description: "Arithmetic, algebra, geometry, number properties, data interpretation, and data sufficiency.",
        questionCount: 36,
        minutes: 52,
      },
      {
        id: "logical-reasoning",
        label: "Logical Reasoning",
        description: "Verbal reasoning (critical reasoning, syllogisms) and analytical/puzzle-based reasoning.",
        questionCount: 36,
        minutes: 40,
      },
    ],
  },
  gmat: {
    id: "gmat",
    label: "GMAT",
    shortLabel: "GMAT",
    description: "Practice quizzes for the GMAT: scaffolded and coming soon, question bank not yet available.",
    theme: { accent: "#1e3a8a", accentForeground: "#ffffff" },
    pointsPerCorrectAnswer: 3,
    available: false,
    sections: [
      {
        id: "quant",
        label: "Quantitative Reasoning",
        description: "Problem solving and data sufficiency.",
        questionCount: 0,
        minutes: 45,
      },
      {
        id: "verbal",
        label: "Verbal Reasoning",
        description: "Reading comprehension, critical reasoning, and sentence correction.",
        questionCount: 0,
        minutes: 45,
      },
      {
        id: "data-insights",
        label: "Data Insights",
        description: "Data sufficiency, table analysis, graphics interpretation, and multi-source reasoning.",
        questionCount: 0,
        minutes: 45,
      },
    ],
  },
};

export function getExamConfig(examId: string): ExamConfig {
  const exam = EXAMS[examId as ExamId];
  if (!exam) {
    throw new Error(`Unknown exam: ${examId}`);
  }
  return exam;
}

export function isValidExamId(examId: string): examId is ExamId {
  return examId in EXAMS;
}

export function getSectionConfig(examId: string, sectionId: SectionId): SectionConfig {
  const exam = getExamConfig(examId);
  const section = exam.sections.find((s) => s.id === sectionId);
  if (!section) {
    throw new Error(`Unknown section: ${sectionId} for exam ${examId}`);
  }
  return section;
}
