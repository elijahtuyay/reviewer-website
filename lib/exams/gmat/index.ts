import { ExamModule, jsonBank } from "@/lib/exams/types";

/**
 * GMAT Focus Edition.
 *
 * Structure verified against the exam's published format and cross-checked
 * against a 2024/25 preparation guide: three sections of 45 minutes each,
 * 64 questions in total, scored 205-805.
 *
 * Two things about Focus that are easy to get wrong from older material:
 *  - Sentence Correction was removed from Verbal, which is now Reading
 *    Comprehension and Critical Reasoning only.
 *  - Data Sufficiency moved OUT of Quantitative and into Data Insights, and
 *    Quantitative no longer covers geometry. (NMAT's quant section keeps its
 *    own data sufficiency questions; that is correct for NMAT and unrelated.)
 *
 * The behavioral rules below are what actually make this exam different from
 * NMAT, and they are the reason the quiz engine was made rule-driven rather
 * than being NMAT's flow with switches bolted on.
 */
const gmat: ExamModule = {
  id: "gmat",
  label: "GMAT Focus Edition",
  shortLabel: "GMAT",
  description:
    "Practice for the GMAT Focus Edition. Each of the three sections has a 45-minute time limit. The difficulty changes with your answers, and every answer has a written explanation.",
  /**
   * Measured, not picked by eye. The first choice (#1e3a8a) was only 1.59:1
   * against the dark background, half of NMAT green's 3.11:1, which left the
   * selected-option ring and the progress bar fainter than the neutral borders
   * beside them. This sits at 3.19:1 dark / 4.63:1 light with 5.17:1 for white
   * text on it, which is the profile the rest of the design system was tuned
   * against.
   */
  theme: { accent: "#2563eb", accentForeground: "#ffffff" },
  available: true,

  /**
   * Listed in the order the exam itself presents as the default. The candidate
   * may take them in any order (see `sectionOrder` below), which is why the
   * setup page renders these as a choice rather than a fixed sequence.
   */
  sections: [
    {
      id: "data-insights",
      label: "Data Insights",
      description:
        "This section tests data sufficiency, table analysis, two-part analysis, graphics interpretation and multi-source reasoning.",
      questionCount: 20,
      minutes: 45,
      /**
       * The only section on either exam that gets a calculator, and the real
       * exam is equally strict about it: it is provided on screen here and
       * nowhere else. See `lib/calculator/basic-di.ts` for what it does, which
       * notably includes ignoring order of operations.
       */
      calculator: "basic-di",
    },
    {
      id: "quantitative",
      label: "Quantitative Reasoning",
      description:
        "This section tests problem solving in arithmetic, algebra, statistics and sets. It has no geometry.",
      questionCount: 21,
      minutes: 45,
      /**
       * Deliberately none, and worth stating rather than leaving as an absence.
       * Quantitative Reasoning is designed so that every question yields to
       * reasoning and estimation, and reaching for a calculator is the habit it
       * tests for. Practicing this section with one open in another tab builds
       * pacing that collapses on test day, so the UI says so out loud.
       */
      calculator: null,
    },
    {
      id: "verbal",
      label: "Verbal Reasoning",
      description:
        "This section tests reading comprehension and critical reasoning. It has no sentence correction.",
      questionCount: 23,
      minutes: 45,
      calculator: null,
    },
  ],

  rules: {
    // Every question depends on the answers before it, so the candidate is
    // served one at a time and cannot page back through the section.
    navigation: "sequential",
    // The real exam refuses to advance without an answer. Guessing and moving
    // on is the intended behavior, which is why the unanswered penalty below
    // is deliberately harsh.
    allowSkip: false,
    adaptive: {
      // Real computer-adaptive tests open every section at medium.
      startDifficulty: "medium",
      stepUpAfter: 2,
      stepDownAfter: 2,
    },
    reviewEdit: {
      // The distinctive Focus feature: after the last question, and only with
      // time still on the clock, you may revisit and change at most three
      // answers in the section.
      maxChanges: 3,
      allowFlagging: true,
    },
    sectionOrder: "chooseable",
    lockToOneSection: true,
    optionalBreakMinutes: 10,
  },

  /**
   * Scaled rather than raw marks, because on an adaptive test the difficulty of
   * what you answered correctly is part of the measurement: missing a few of
   * the hardest questions can still leave a high score, while sweeping the easy
   * ones does not.
   *
   * The weights and the penalty are a faithful *model* of that behavior, not
   * GMAC's actual undisclosed IRT scoring. The app says so on the results
   * screen rather than implying the number is an official prediction.
   */
  scoring: {
    kind: "scaled",
    min: 205,
    max: 805,
    difficultyWeight: { easy: 1, medium: 2, hard: 3.2 },
    // Leaving questions unreached costs far more than getting them wrong,
    // which is the single most important pacing lesson the real exam teaches.
    unansweredPenaltyPerQuestion: 0.02,
  },

  loadSection: jsonBank({
    "data-insights": () => import("@/data/questions/gmat/data-insights.json"),
    quantitative: () => import("@/data/questions/gmat/quantitative.json"),
    verbal: () => import("@/data/questions/gmat/verbal.json"),
  }),
};

export default gmat;
