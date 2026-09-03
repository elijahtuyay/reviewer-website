import { Difficulty, ExamId, Question, SectionId } from "@/data/schema";

/**
 * THE CONTRACT EVERY EXAM IMPLEMENTS.
 *
 * Adding an exam should mean writing one folder and adding one line to
 * `registry.ts` — never editing the quiz page, the scoring code, or the router.
 * Everything the rest of the app needs to know about an exam is declared here
 * as data, so the shared engine can read it instead of branching on `examId`.
 *
 * The rule of thumb when extending this: if you find yourself about to write
 * `if (examId === "gmat")` anywhere outside `lib/exams/`, add a field here
 * instead and let the exam declare it.
 */

/**
 * The on-screen calculator a section grants, or null for none.
 *
 * "basic-di" is the GMAT Focus Data Insights calculator: four functions, a
 * square root, a percent key, three memory keys, and strictly left-to-right
 * evaluation with no order of operations. Modeled in `lib/calculator/basic-di.ts`.
 *
 * "gre-standard" is the calculator ETS provides in GRE Quantitative Reasoning.
 * It is a genuinely different device: it honors order of operations, so
 * 2 + 3 x 4 is 14 where the TI-108 gives 20, and it has parentheses and no
 * percent key. Modeled in `lib/calculator/gre-standard.ts`.
 *
 * "not-simulated" means THE REAL EXAM PROVIDES ONE HERE AND THIS APP DOES NOT
 * MODEL IT YET. It exists because `null` already means something different and
 * load-bearing: null is "the real exam gives you none either", which the setup
 * page states out loud as a rule. The GRE grants a calculator in Quantitative
 * Reasoning, so calling that null would have printed a flat lie on the page a
 * candidate reads before starting.
 *
 * Why the GRE's is not simply `basic-di`: it is a different device. It honors
 * order of operations (2 + 3 x 4 is 14, where the TI-108 gives 20), it has
 * parentheses, it has a Transfer Display key that types the result into a
 * Numeric Entry box, and it accepts keyboard input. This repo has already
 * shipped a calculator that borrowed three details from the wrong device once.
 * A calculator that is subtly wrong is worse than an absent one, because the
 * candidate practices habits that break on test day.
 */
export type CalculatorKind = "basic-di" | "gre-standard" | "not-simulated" | null;

export interface SectionConfig {
  id: SectionId;
  label: string;
  /** Shown on cards and setup pages. One sentence, no trailing period needed. */
  description: string;
  /** Questions presented in one attempt at this section. */
  questionCount: number;
  minutes: number;
  /**
   * Which calculator, if any, this section provides.
   *
   * On `SectionConfig` rather than `ExamRules` because it varies BETWEEN
   * SECTIONS OF ONE EXAM, which nothing in `ExamRules` does: GMAT Focus grants
   * a calculator in Data Insights and withholds it in Quantitative Reasoning,
   * on purpose, because that section is built so every question yields to
   * reasoning and estimation.
   *
   * Required rather than optional, so that every section has to say `null` out
   * loud. "No calculator" is a rule this app should be stating, not a field
   * somebody forgot; the UI prints it, and an optional field would let a new
   * section silently default into having nothing said about it. This repo has
   * already shipped UI that implied a constraint the engine did not have.
   */
  calculator: CalculatorKind;
}

/** Per-exam accent color. One hex; the app derives its text-safe variant via `--accent-text`. */
export interface ExamTheme {
  accent: string;
  accentForeground: string;
}

/**
 * How the section behaves while you are inside it. This is the part that
 * differs most between exams, and the part that used to be hard-coded into the
 * quiz page as NMAT's behavior.
 */
export interface ExamRules {
  /**
   * "free": every question on one scrolling page, jump around at will (NMAT).
   * "sequential": one question at a time, no going back (GMAT and any other
   * computer-adaptive test, where later questions depend on earlier answers).
   */
  navigation: "free" | "sequential";
  /** False means an answer is required before the next question is served. */
  allowSkip: boolean;
  /**
   * Null for a fixed random draw. When set, the next question is chosen from
   * the bank based on how the attempt is going so far.
   */
  adaptive: AdaptiveRules | null;
  /**
   * Null means answers stay editable until submit (NMAT). When set, the attempt
   * gets a distinct review phase after the last question, capped at
   * `maxChanges` edits and only reachable with time left on the clock.
   */
  reviewEdit: ReviewEditRules | null;
  /**
   * Who picks the order the sections are taken in.
   *
   * Three values, not two, because "you choose here" and "you choose on the
   * real exam" are different facts and the setup page states both.
   *
   *  - "fixed": a set order here (NMAT).
   *  - "chooseable": you choose here AND on the real exam (GMAT Focus).
   *  - "chooseable-here-only": you choose here, but the real exam chooses for
   *    you (the GRE, which fixes the writing task first and then orders the
   *    remaining sections itself).
   *
   * Collapsing the last two printed "the real exam also lets you decide the
   * order before you start" on a GRE page, which is simply untrue, and it is
   * the exact failure this generated-copy design exists to prevent.
   */
  sectionOrder: "fixed" | "chooseable" | "chooseable-here-only";
  /**
   * True if starting a section locks the others until it is submitted. Both
   * current exams do this; it is declared rather than assumed so an untimed
   * practice mode could opt out.
   */
  lockToOneSection: boolean;
  /** Minutes of optional break the exam grants between sections, or null. */
  optionalBreakMinutes: number | null;
}

export interface AdaptiveRules {
  /** Difficulty of the first question. Real CATs open at medium. */
  startDifficulty: Difficulty;
  /**
   * Consecutive correct answers needed to step the difficulty up, and
   * consecutive wrong answers needed to step it down.
   */
  stepUpAfter: number;
  stepDownAfter: number;
}

export interface ReviewEditRules {
  /** Hard cap on answers that may be changed in the review phase. */
  maxChanges: number;
  /** Whether the candidate can flag questions during the section to find them again later. */
  allowFlagging: boolean;
}

/**
 * How a finished section turns into a number the candidate is shown.
 *
 * "points": raw marks, `pointsPerCorrectAnswer` per correct answer, out of a
 * maximum the app computes. What NMAT does.
 *
 * "scaled": a band (e.g. GMAT's 205-805) derived from how many were right AND
 * how hard they were, with a penalty for questions never reached. What an
 * adaptive exam does, because on a CAT the difficulty of what you answered is
 * part of the measurement.
 */
export type ScoringModel =
  | { kind: "points"; pointsPerCorrectAnswer: number }
  | {
      kind: "scaled";
      min: number;
      max: number;
      /** Relative worth of a correct answer at each difficulty. */
      difficultyWeight: Record<Difficulty, number>;
      /**
       * Fraction of the earned scaled range removed per unanswered question.
       * Real adaptive exams penalize an incomplete section heavily, which is
       * why finishing with guesses beats running out of time.
       */
      unansweredPenaltyPerQuestion: number;
      /**
       * The increment the reported score moves in.
       *
       * Declared rather than fixed, because the two scaled exams here are not
       * close: GMAT Focus is 205-805 in tens, and the GRE is 130-170 in ones.
       * Rounding the GRE to the nearest ten would give a candidate five
       * reachable scores across the whole measure.
       */
      scoreStep: number;
      /**
       * What the earned weight is measured AGAINST, and the reason this is
       * declared rather than assumed.
       *
       * "fixed-reference": a full section of the hardest available material.
       * Correct for an ADAPTIVE exam, because there the candidate climbs to the
       * hard questions by answering well, so reaching them IS the achievement
       * and the top of the band should require it.
       *
       * "served": the weight of the questions actually drawn. Correct for a
       * NON-ADAPTIVE exam, where the mix is random and the candidate has no
       * influence over it. Under a fixed reference such an exam cannot reach
       * its own maximum: a 27-question GRE draw averages about 2.28 weight per
       * question against a 3.2 ceiling, so a FLAWLESS attempt scored ~159 of
       * 170, and two flawless attempts differed by up to 11 points purely from
       * draw luck. Meanwhile the setup page stated "the score runs from 130 to
       * 170" as fact.
       *
       * Difficulty still counts under "served": getting the hard questions
       * right earns more than getting the easy ones right on any partial run.
       * What it stops doing is punishing a candidate for a draw they did not
       * choose.
       */
      denominator: "fixed-reference" | "served";
    };

/**
 * One exam, self-contained. `lib/exams/<id>/index.ts` default-exports this.
 */
export interface ExamModule {
  id: ExamId;
  label: string;
  shortLabel: string;
  description: string;
  theme: ExamTheme;
  /** False for an exam that is scaffolded but has no usable question bank yet. */
  available: boolean;
  sections: SectionConfig[];
  rules: ExamRules;
  scoring: ScoringModel;
  /**
   * True things about the REAL exam that this app does not model as a rule.
   *
   * The setup page's "what to expect" list is generated from `rules` on
   * purpose, so the copy cannot claim behavior the engine does not have. That
   * design has one gap: a fact that is true of the real exam and deliberately
   * NOT implemented here has no rule to be generated from, so it silently goes
   * unsaid. The GRE opens with a 30-minute essay this site does not simulate,
   * and a candidate who meets that for the first time on test day was failed by
   * this page, not by the engine.
   *
   * Each entry is appended to the generated list verbatim. Use it only for
   * differences between the real exam and this app. Anything the engine
   * actually does belongs in `rules`, where it cannot drift: this field is an
   * escape hatch, and an escape hatch used for ordinary copy becomes the
   * hand-written blurb the generated list was built to replace.
   */
  notes?: string[];
  /**
   * Loads one section's questions. Deliberately async and per-section: it is a
   * dynamic import, so a section's questions are a separate chunk that is only
   * fetched when someone actually opens that section. The previous design
   * static-imported every bank, which put the entire question set of every
   * exam on the critical path of every page, including pages with no quiz on
   * them at all.
   */
  loadSection: (sectionId: SectionId) => Promise<Question[]>;
}

/** Convenience for the common case of a section whose bank is one JSON file. */
export function jsonBank(
  loaders: Record<string, () => Promise<{ default: unknown }>>
): (sectionId: SectionId) => Promise<Question[]> {
  return async (sectionId) => {
    const loader = loaders[sectionId];
    if (!loader) return [];
    const mod = await loader();
    return mod.default as Question[];
  };
}
