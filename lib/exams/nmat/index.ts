import { ExamModule, jsonBank, jsonExplanations } from "@/lib/exams/types";

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
    "This is a fixed paper, and you take one section at a time. You see the whole section at once, and every answer has a written explanation.",
  theme: { accent: "#0f7b4d", accentForeground: "#ffffff" },
  available: true,

  sections: [
    {
      id: "language-skills",
      label: "Language Skills",
      description:
        "This section tests reading comprehension, grammar, vocabulary and sentence correction.",
      questionCount: 36,
      minutes: 28,
      calculator: null,
    },
    {
      id: "quantitative-skills",
      label: "Quantitative Skills",
      description:
        "This section tests arithmetic, algebra, geometry, number properties, data interpretation and data sufficiency.",
      questionCount: 36,
      minutes: 52,
      calculator: null,
    },
    {
      id: "logical-reasoning",
      label: "Logical Reasoning",
      description:
        "This section tests critical reasoning, syllogisms and analytical puzzles.",
      questionCount: 36,
      minutes: 40,
      calculator: null,
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
    "language-skills": () => import("@/data/generated/language-skills.questions.json"),
    "quantitative-skills": () => import("@/data/generated/quantitative-skills.questions.json"),
    "logical-reasoning": () => import("@/data/generated/logical-reasoning.questions.json"),
  }),
  loadExplanations: jsonExplanations({
    "language-skills": () => import("@/data/generated/language-skills.explanations.json"),
    "quantitative-skills": () => import("@/data/generated/quantitative-skills.explanations.json"),
    "logical-reasoning": () => import("@/data/generated/logical-reasoning.explanations.json"),
  }),
};

export default nmat;
