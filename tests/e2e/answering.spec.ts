import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { options, startSection } from "./helpers";

/**
 * The first Sentence Equivalence question in the draw.
 *
 * Picking "the first group containing checkboxes" was draw-dependent, and a
 * review lane measured the cost: GRE Verbal also holds seven open
 * "select all that apply" items, which have THREE options and no
 * `selectExactly`, so all three picks legitimately stick. Simulated over 20,000
 * draws, one of those lands first in 1.2% of them, which with `retries: 0`
 * meant a hard failure roughly one run in forty for a reason that is not a bug.
 *
 * Six options is what identifies Sentence Equivalence, and a 27-question GRE
 * Verbal draw from a bank holding 27 of them essentially always contains one.
 * So this asserts rather than skips: a draw with none is itself worth knowing
 * about.
 */
function sentenceEquivalence(page: Page) {
  return page
    .locator('[role="group"]')
    .filter({ has: page.locator('[role="checkbox"]:nth-child(6)') })
    .first();
}


/**
 * Answering behavior, and the two defects that only a real browser found.
 */

test.describe("multi-select", () => {

  /**
   * THE BUG THIS SUITE EXISTS FOR.
   *
   * QuestionCard used to receive the current answer as a PROP and compute the
   * new array itself. Two clicks inside one frame both read the same prop,
   * because React has not re-rendered between them, so the second derived its
   * array from the pre-click answer and overwrote the first. Measured in
   * headless Chrome at the time: clicking two options of a Sentence Equivalence
   * in one tick left exactly ONE selected, on the question type whose entire
   * rule is that you select two.
   *
   * The clicks are dispatched inside a single `evaluate` on purpose. Playwright
   * clicks are sequential and each waits for the app to settle, which is
   * exactly the interleaving that hides this. A test that clicks normally
   * passes against the broken code.
   */
  test("two clicks in one frame both register", async ({ page }) => {
    await startSection(page, "gre", "Verbal Reasoning");

    const group = sentenceEquivalence(page);
    const inGroup = group.locator('[role="checkbox"]');
    await expect(inGroup).toHaveCount(6);

    await group.evaluate((el) => {
      const boxes = el.querySelectorAll('[role="checkbox"]');
      (boxes[0] as HTMLElement).click();
      (boxes[1] as HTMLElement).click();
    });

    await expect(inGroup.nth(0)).toHaveAttribute("aria-checked", "true");
    await expect(inGroup.nth(1)).toHaveAttribute("aria-checked", "true");
  });

  /**
   * Sentence Equivalence takes exactly two. A third pick must push the OLDEST
   * out rather than being ignored, or a candidate who changes their mind has to
   * work out which one to clear first.
   */
  test("a third pick replaces the oldest, never silently fails", async ({ page }) => {
    await startSection(page, "gre", "Verbal Reasoning");

    const boxes = sentenceEquivalence(page).locator('[role="checkbox"]');
    await expect(boxes).toHaveCount(6);

    await boxes.nth(0).click();
    await boxes.nth(1).click();
    await boxes.nth(2).click();

    await expect(boxes.nth(0)).toHaveAttribute("aria-checked", "false");
    await expect(boxes.nth(1)).toHaveAttribute("aria-checked", "true");
    await expect(boxes.nth(2)).toHaveAttribute("aria-checked", "true");
  });
});

test.describe("numeric entry", () => {

  /**
   * A decimal point must survive being typed.
   *
   * This looked broken once and was not: the harness sent the period with
   * `windowsVirtualKeyCode: 46`, which is VK_DELETE, so "12.5" arrived as "125"
   * and looked exactly like input filtering the app does not have. Worth a real
   * test precisely because the false failure was so convincing.
   */
  test("accepts a decimal", async ({ page }) => {
    await startSection(page, "gre", "Quantitative Reasoning");

    const box = page.locator('input[inputmode="decimal"]').first();
    await expect(box).toBeVisible();
    await box.fill("");
    await box.pressSequentially("12.5", { delay: 30 });
    await expect(box).toHaveValue("12.5");
  });
});

test.describe("reading comprehension", () => {

  /**
   * The passage renders in its own block, in full, above the stem.
   *
   * Both halves matter. The split is guarded by a regex that falls back to
   * unsplit rather than showing a mangled card, so a silent regression shows up
   * as a missing "Passage" label. And a truncation scare during the v2.8.0
   * review turned out to be a probe artifact, which is the sort of thing a real
   * assertion settles once instead of every time.
   */
  test("the passage is split out and not truncated", async ({ page }) => {
    // GRE Verbal, not GMAT Verbal. GRE navigation is "free", so the whole
    // 27-question draw is on one page, and 43 of its 96 questions carry a
    // passage. GMAT Verbal is sequential, so whether a passage was visible
    // depended on the draw, and a test that passes on luck is worse than none.
    await startSection(page, "gre", "Verbal Reasoning");

    const label = page.getByText("Passage", { exact: true }).first();
    await expect(label).toBeVisible();

    const passage = label.locator("xpath=following-sibling::p[1]");
    const words = (await passage.innerText()).trim().split(/\s+/).length;
    /*
     * 90, and the number is measured rather than picked. Passage length varies
     * by exam far more than it looks: GRE runs 110 to 145 words, GMAT 246 to
     * 314, NMAT 99 to 177. A floor calibrated on GMAT fails honestly-short GRE
     * passages, which is how this assertion first failed.
     *
     * The floor is set below the shortest passage in the bank this test reads,
     * because the failure it exists to catch is TRUNCATION -- a passage cut off
     * mid-way renders a fraction of its words, not ten percent fewer. Asserting
     * the bank's real range here would duplicate audit:bank and break every
     * time an author writes a slightly shorter passage.
     */
    expect(words).toBeGreaterThan(90);
  });
});

test.describe("answer persistence", () => {

  /** An answer survives a reload, because the attempt is stored per section. */
  test("an answer survives a reload", async ({ page }) => {
    await startSection(page, "nmat", "Language Skills");

    const first = options(page).first();
    await first.click();
    await expect(first).toHaveAttribute("aria-checked", "true");

    await page.reload();
    await expect(options(page).first()).toHaveAttribute("aria-checked", "true");
  });
});

test.describe("explanations", () => {
  /**
   * THE EXPLANATION MUST ARRIVE AFTER SUBMITTING.
   *
   * Explanations are no longer part of a section's bank. They are 20% to 47% of
   * it and none of them can be read before the candidate submits, so they load
   * as their own chunk at that moment.
   *
   * The failure that buys is specific and silent: the review screen renders,
   * the score is right, and every explanation is blank — which reads as an
   * explanation nobody wrote rather than as a chunk that never arrived. So this
   * asserts real prose, and asserts the loading placeholder is gone.
   */
  test("load after submitting and render real prose", async ({ page }) => {
    await startSection(page, "nmat", "Language Skills");

    await page.getByRole("button", { name: /^Submit/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: /submit section/i }).click();
    await expect(page.getByRole("timer")).toHaveCount(0);

    const explanation = page.getByText(/Correct answer|Your answer/).first();
    await expect(explanation).toBeVisible();

    await expect(page.getByText("The explanation is loading.")).toHaveCount(0, {
      timeout: 20_000,
    });

    // Every served question must have one, not just the first.
    const words = await page.evaluate(() => {
      const marks = [...document.querySelectorAll("p")]
        .map((p) => p.textContent?.trim() ?? "")
        .filter((t) => t.length > 40);
      return marks.length;
    });
    expect(words, "review must show explanation prose").toBeGreaterThan(5);
  });
});
