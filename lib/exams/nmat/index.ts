import { ExamModule, jsonBank } from "@/lib/exams/types";

/**
 * NMAT by GMAC — a Philippine business-school admission test.
 *
 * The accent is approximated from the exam's brand green: mba.com/exams/nmat
 * sits behind bot-protection that blocked reading the exact hex, so this is a
 * close professional-green approximation rather than a pixel-verified value.
 *
 * The question JSON deliberately stays at the flat `data/questions/*.json`
 * path rather than moving under this folder. An attempted move was caught and
 * reverted once while background agents were editing those exact files, and
 * the paths are referenced by tooling and docs; the loader below is what ties
 * them to this module, so their location is an implementation detail.
 */
const nmat: ExamModule = {
  id: "nmat",
  label: "NMAT by GMAC",
  shortLabel: "NMAT",
  description:
    "Practice quizzes for NMAT by GMAC: timed sections, instant review, and explained answers.",
  theme: { accent: "#0f7b4d", accentForeground: "#ffffff" },
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
      description:
        "Arithmetic, algebra, geometry, number properties, data interpretation, and data sufficiency.",
      questionCount: 36,
      minutes: 52,
    },
    {
      id: "logical-reasoning",
      label: "Logical Reasoning",
      description:
        "Verbal reasoning (critical reasoning, syllogisms) and analytical/puzzle-based reasoning.",
      questionCount: 36,
      minutes: 40,
    },
  ],

  /**
   * A conventional paper-style sitting: the whole section is in front of you,
   * you may skip and come back, and nothing adapts. The only constraint is the
   * clock and the one-section-at-a-time lock.
   */
  rules: {
    navigation: "free",
    allowSkip: true,
    adaptive: null,
    reviewEdit: null,
    sectionOrder: "fixed",
    lockToOneSection: true,
    optionalBreakMinutes: null,
  },

  scoring: { kind: "points", pointsPerCorrectAnswer: 3 },

  loadSection: jsonBank({
    "language-skills": () => import("@/data/questions/language-skills.json"),
    "quantitative-skills": () => import("@/data/questions/quantitative-skills.json"),
    "logical-reasoning": () => import("@/data/questions/logical-reasoning.json"),
  }),
};

export default nmat;
