import { ExamModule, jsonBank } from "@/lib/exams/types";

/**
 * GRE General Test.
 *
 * Structure taken from ETS's published test structure for the shortened test
 * that began on 22 September 2023: one Analytical Writing task, then two Verbal
 * Reasoning sections and two Quantitative Reasoning sections in either order,
 * about 1 hour 58 minutes in total.
 *
 * Three things about the current GRE are easy to get wrong from older material,
 * because the 2023 revision changed all of them:
 *  - There is only ONE essay now, not two, and no unscored experimental
 *    section.
 *  - Verbal is 12 questions in 18 minutes plus 15 in 23, and Quantitative is 12
 *    in 21 plus 15 in 26. The old test was much longer.
 *  - Geometry IS on the GRE. That is the opposite of GMAT Focus, whose
 *    Quantitative section dropped it, and the two are easy to confuse when
 *    writing a bank.
 */

/**
 * The scaled band, declared once so the description and the scoring rule cannot
 * drift apart. A hard-coded "130 to 170" in the description would flow into the
 * home page card, the OpenGraph description and the JSON-LD Course description,
 * and nothing would catch it going stale.
 */
const SCORE_MIN = 130;
const SCORE_MAX = 170;

const gre: ExamModule = {
  id: "gre",
  label: "GRE General Test",
  shortLabel: "GRE",
  description:
    `This exam has two measures, Verbal Reasoning and Quantitative Reasoning. Each is scored from ${SCORE_MIN} to ${SCORE_MAX}. The real exam also has a writing task, which this site does not include.`,
  /**
   * Measured against the surfaces it sits on, not picked by eye, and chosen to
   * match the profile the other two accents were tuned to.
   *
   * #9333ea is 4.82:1 on the light background, 3.06:1 on the dark one, and
   * 5.38:1 for white text on the fill. NMAT green is 4.75 / 3.11 / 5.30 and
   * GMAT blue is 4.63 / 3.19 / 5.17, so all three behave the same way in the
   * selected-option ring and the progress bar.
   *
   * The darker violets read better on paper and fail where it matters: #6d28d9
   * is only 2.32:1 on the dark background, which is the mistake GMAT's first
   * blue made at 1.59:1, and it leaves the chosen option outlined more faintly
   * than the neutral options beside it.
   */
  theme: { accent: "#9333ea", accentForeground: "#ffffff" },
  available: true,

  /**
   * TWO sections, where the real exam has four.
   *
   * The real test splits each measure into two separately timed sections, and
   * the difficulty of the second depends on how the first went. This app models
   * each measure as ONE section carrying the measure's full question count and
   * full time: Verbal is 27 questions in 41 minutes, Quantitative 27 in 47.
   * Both totals are exactly the real ones.
   *
   * That is a deliberate trade, not an oversight. Splitting the bank four ways
   * would give each section a pool barely larger than a single sitting, and a
   * retake would then re-serve most of the same questions. The GMAT's seed bank
   * already demonstrates that failure mode. Section-level adaptivity is
   * recorded as a known gap rather than faked.
   */
  sections: [
    {
      id: "verbal",
      label: "Verbal Reasoning",
      description:
        "This section tests reading comprehension, text completion and sentence equivalence.",
      questionCount: 27,
      minutes: 41,
      calculator: null,
    },
    {
      id: "quantitative",
      label: "Quantitative Reasoning",
      description:
        "This section tests arithmetic, algebra, geometry and data analysis. It includes quantitative comparison.",
      questionCount: 27,
      minutes: 47,
      /**
       * "not-simulated", NOT null, and the distinction is the whole reason that
       * value exists. The real GRE gives you an on-screen calculator here, so
       * null would make the setup page state, as a rule, that no calculator is
       * provided. That would be a flat lie on the page a candidate reads
       * immediately before starting.
       *
       * It is not "basic-di" either, because that models a different device.
       * The GMAT's is a TI-108: strictly left to right, so 2 + 3 x 4 is 20. The
       * GRE's honors order of operations and gives the same expression 14, has
       * parentheses, has a Transfer Display key that types the result straight
       * into a Numeric Entry box, and takes keyboard input. Handing a candidate
       * the wrong calculator is worse than handing them none, because they
       * practice habits that break on test day, and this repo has already
       * shipped a calculator that borrowed three details from the wrong device.
       */
      calculator: "not-simulated",
    },
  ],

  /**
   * The GRE is far closer to a paper exam than the GMAT is, and this is the
   * part people assume wrongly because both are computer-delivered.
   *
   * Inside a section you may move freely, skip, mark a question, and change any
   * answer as often as you like until the section ends. So `navigation` is
   * "free" and `reviewEdit` is null: a capped review phase would be a
   * restriction the real exam does not impose. The adaptivity happens BETWEEN
   * sections, not between questions, which is why `adaptive` is null here even
   * though the GRE is an adaptive test.
   */
  rules: {
    navigation: "free",
    allowSkip: true,
    adaptive: null,
    reviewEdit: null,
    // You choose here. The real exam does not let you: it fixes the writing
    // task first and then orders the remaining sections itself.
    sectionOrder: "chooseable-here-only",
    lockToOneSection: true,
    // The shortened test has no scheduled break.
    optionalBreakMinutes: null,
  },

  /**
   * 130 to 170 per measure, in steps of ONE.
   *
   * `scoreStep: 1` is not decoration. The shared scaled model used to round to
   * the nearest ten, which is right for the GMAT's 600-point band and would
   * leave a GRE candidate exactly five reachable scores across a 40-point one.
   *
   * As with the GMAT, this is a faithful MODEL of how the real scoring behaves,
   * not ETS's undisclosed procedure, and the results screen says so rather than
   * implying the number predicts anything.
   */
  scoring: {
    kind: "scaled",
    min: SCORE_MIN,
    max: SCORE_MAX,
    difficultyWeight: { easy: 1, medium: 2, hard: 3.2 },
    /*
     * ZERO, because the real GRE has no penalty of any kind: an omitted
     * question and a wrong one are both simply worth nothing.
     *
     * The GMAT's 0.02 models a real behavior of that exam. Copying it here
     * produced a generated bullet reading "a question you never reach costs you
     * more than an incorrect answer", in a list whose other entries describe the
     * real exam, which was false. An unanswered question already costs its own
     * points, so the pacing lesson survives without inventing a penalty.
     */
    unansweredPenaltyPerQuestion: 0,
    scoreStep: 1,
    /*
     * "served", because this exam is NOT adaptive: the 27 questions are a plain
     * random draw and the candidate has no way to climb. Under a fixed
     * reference a flawless attempt scored about 159 of 170 and varied by up to
     * 11 points on draw luck alone, while the setup page stated the full band
     * as fact.
     */
    denominator: "served",
  },

  /**
   * Where this app and the real GRE differ. Stated on the setup page rather
   * than discovered on test day.
   *
   * Both are deliberate. The essay cannot be scored automatically, and a
   * writing box that awards a number nobody stands behind is worse than an
   * honest absence. The third difference, the calculator, is stated by the
   * section that would have provided one, so it is not repeated here.
   */
  notes: [
    "The real exam starts with one 30-minute writing task. This site does not include it, so practice that task somewhere else.",
    "The real exam splits each measure into two shorter timed sections. The difficulty of the second section depends on your result in the first. Here each measure is one section, with the same total questions and the same total time.",
  ],

  loadSection: jsonBank({
    verbal: () => import("@/data/questions/gre/verbal.json"),
    quantitative: () => import("@/data/questions/gre/quantitative.json"),
  }),
};

export default gre;
