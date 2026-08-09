import { SectionId } from "@/data/schema";

export interface SectionConfig {
  id: SectionId;
  label: string;
  description: string;
  questionCount: number;
  minutes: number;
}

/**
 * Single source of truth for the real NMAT by GMAC structure (question counts,
 * per-section time limits). GMAC updates the exam pattern occasionally —
 * update only here if that happens, not per-component.
 */
export const SECTIONS: SectionConfig[] = [
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
];

export const POINTS_PER_CORRECT_ANSWER = 3;

export function getSectionConfig(id: SectionId): SectionConfig {
  const section = SECTIONS.find((s) => s.id === id);
  if (!section) {
    throw new Error(`Unknown section: ${id}`);
  }
  return section;
}
