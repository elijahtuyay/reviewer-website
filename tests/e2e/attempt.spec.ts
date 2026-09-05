import { expect, test } from "@playwright/test";
import { secondsLeft, startSection, storedAttempt } from "./helpers";

/**
 * The attempt lifecycle: the timer, the section lock, and submitting.
 * Every test here names a defect that shipped.
 */

test.describe("the timer", () => {
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
    await expect(page.getByRole("timer")).toBeVisible({ timeout: 30_000 });
    const after = await secondsLeft(page);

    // Time must have moved forward, and must not have been handed back.
    expect(after).toBeLessThan(before);
    expect(before - after).toBeGreaterThanOrEqual(2);
    expect(before - after).toBeLessThan(30);
  });

  /**
   * THE CLOCK IS ARITHMETIC ON A DEADLINE, NOT A COUNTER THAT TICKS.
   *
   * Browsers throttle timers in a backgrounded tab, so a decrementing
   * `setInterval` silently granted free exam time — a real bug this project
   * shipped and fixed.
   *
   * The first version of this test faked `document.visibilityState` and
   * dispatched `visibilitychange`, which proves nothing: the tab is still
   * foregrounded, timers still fire, and a naive counter loses the same three
   * seconds and passes. A review lane demonstrated that by deleting the
   * `visibilitychange` listener outright and watching the test stay green.
   *
   * Playwright's clock is the only way to tell the two implementations apart in
   * process. `setSystemTime` moves wall-clock time WITHOUT running any pending
   * timer, which is exactly what a throttled tab looks like; `runFor(1000)`
   * then lets a single tick happen. A deadline-based clock recomputes from
   * `Date.now()` and drops two minutes. A counter drops one second.
   */
  test("a throttled tab does not win back time", async ({ page }) => {
    await page.clock.install();
    await startSection(page, "nmat", "Language Skills");

    const before = await secondsLeft(page);

    const now = await page.evaluate(() => Date.now());
    await page.clock.setSystemTime(now + 120_000);
    await page.clock.runFor(1000);

    const after = await secondsLeft(page);
    // Two minutes of wall clock passed. Anything close to one second means the
    // countdown is counting ticks rather than reading the deadline.
    expect(before - after).toBeGreaterThan(100);
  });
});

test.describe("the section lock", () => {
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

  /**
   * The blocked attempt must not have started a second clock.
   *
   * The first version of this test only checked that the original section still
   * rendered a timer, which a review lane showed passes with the lock removed
   * entirely — it proved a page renders, not that a rule held. The deadline is
   * the thing that matters: if the blocked section had been allowed to begin,
   * it would have written its own attempt record.
   */
  test("the blocked section never starts a clock of its own", async ({ page }) => {
    await startSection(page, "nmat", "Language Skills");
    const before = await storedAttempt(page, "nmat", "language-skills");

    await page.goto("/nmat/quiz/logical-reasoning");
    await expect(page.getByText(/section locked/i)).toBeVisible();

    expect(
      await storedAttempt(page, "nmat", "logical-reasoning"),
      "a locked-out section must not write an attempt"
    ).toBeNull();

    await page.goto("/nmat/quiz/language-skills");
    await expect(page.getByRole("timer")).toBeVisible({ timeout: 30_000 });
    const after = await storedAttempt(page, "nmat", "language-skills");
    expect(after?.deadline, "the running section's deadline must not move").toBe(before?.deadline);
  });
});

test.describe("submitting", () => {
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
   * made every screen outside the quiz report a real result as 0 correct.
   */
  test("submitting scores the attempt and stops the clock", async ({ page }) => {
    await startSection(page, "nmat", "Language Skills");

    await page.getByRole("button", { name: /^Submit/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: /submit section/i }).click();

    await expect(page.getByRole("timer")).toHaveCount(0);

    const record = await storedAttempt(page, "nmat", "language-skills");
    expect(record?.submitted).toBe(true);
    const summary = record?.summary as { correct?: unknown } | null | undefined;
    expect(summary, "a submitted attempt must carry a summary").toBeTruthy();
    expect(typeof summary?.correct).toBe("number");
  });
});
