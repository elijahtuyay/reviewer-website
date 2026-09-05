import { expect, test } from "@playwright/test";
import { clearAttempts, secondsLeft, startSection } from "./helpers";

/**
 * The attempt lifecycle: the timer, the section lock, and submitting.
 * Every test here names a defect that shipped.
 */

test.describe("the timer", () => {
  test.beforeEach(async ({ page }) => clearAttempts(page, "nmat"));

  /**
   * A reload must not grant a fresh section.
   *
   * The timer used to restart at full length on every mount, so reloading
   * paired an old question set and old answers with a new clock. It is now
   * deadline-based and the deadline is persisted, which is the whole reason
   * `endAt` is a prop instead of `minutes`.
   */
  test("a reload resumes the same clock", async ({ page }) => {
    await startSection(page, "nmat", "Language Skills");

    const before = await secondsLeft(page);
    await page.waitForTimeout(3000);
    await page.reload();
    await expect(page.getByRole("timer")).toBeVisible();
    const after = await secondsLeft(page);

    // Time must have moved forward, and must not have been handed back.
    expect(after).toBeLessThan(before);
    expect(before - after).toBeGreaterThanOrEqual(2);
    expect(before - after).toBeLessThan(30);
  });

  /**
   * The clock is computed from a stored deadline, not by decrementing a
   * counter, because browsers throttle timers in backgrounded tabs and the
   * counter version silently granted free exam time.
   */
  test("the clock keeps falling while the tab is hidden", async ({ page }) => {
    await startSection(page, "nmat", "Language Skills");
    const before = await secondsLeft(page);

    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(3000);
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(before - (await secondsLeft(page))).toBeGreaterThanOrEqual(2);
  });
});

test.describe("the section lock", () => {
  test.beforeEach(async ({ page }) => clearAttempts(page, "nmat"));

  /**
   * Starting a second section while one is live must be refused.
   *
   * The app has always TOLD users a section locks you in, and SectionNav has
   * always greyed the others out, but for months the greying was cosmetic and
   * every page linked straight to every quiz URL. Starting a second section
   * left two clocks burning, with the first silently bleeding out.
   *
   * Navigating directly is the point: the UI affordance being disabled is not
   * the same as the rule being enforced, and it was the gap between those two
   * that was the bug.
   */
  test("a second section cannot be started by going straight to its URL", async ({ page }) => {
    await startSection(page, "nmat", "Language Skills");

    await page.goto("/nmat/quiz/logical-reasoning");
    // The lock screen renders at the same address as the runner, so assert on
    // what is shown rather than on where we are.
    await expect(page.getByText(/section locked/i)).toBeVisible();
    await expect(page.getByRole("timer")).toHaveCount(0);
  });

  /** The first section is still there, and still running, afterwards. */
  test("the running section is untouched by the attempt", async ({ page }) => {
    await startSection(page, "nmat", "Language Skills");
    await page.goto("/nmat/quiz/logical-reasoning");
    await page.goto("/nmat/quiz/language-skills");
    await expect(page.getByRole("timer")).toBeVisible();
  });
});

test.describe("submitting", () => {
  test.beforeEach(async ({ page }) => clearAttempts(page, "nmat"));

  /**
   * Submitting is irreversible, so it asks first — and the dialog is an
   * `alertdialog`, which is what makes a screen reader interrupt for it.
   */
  test("asks before submitting, and can be cancelled", async ({ page }) => {
    await startSection(page, "nmat", "Language Skills");

    await page.getByRole("button", { name: /^Submit/ }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: /return to the section/i }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("timer")).toBeVisible();
  });

  /**
   * After submitting, the attempt is scored and the timer is gone.
   *
   * The score is written into sessionStorage at submit time, which is what
   * keeps the question bank off the critical path of every other screen. A
   * submitted attempt that reports no score is the specific failure that once
   * made every screen outside the quiz show a real result as 0 correct.
   */
  test("submitting scores the attempt and stops the clock", async ({ page }) => {
    await startSection(page, "nmat", "Language Skills");

    await page.getByRole("button", { name: /^Submit/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: /submit section/i }).click();

    await expect(page.getByRole("timer")).toHaveCount(0);

    const summary = await page.evaluate(() => {
      const raw = sessionStorage.getItem("progress:nmat:language-skills");
      return raw ? JSON.parse(raw).summary : null;
    });
    expect(summary, "a submitted attempt must carry a summary").not.toBeNull();
    expect(typeof summary.correct).toBe("number");
  });
});
