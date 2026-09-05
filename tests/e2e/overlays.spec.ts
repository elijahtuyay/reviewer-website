import { expect, test } from "@playwright/test";
import { setDeadlineIn, startSection, timerAnnouncer } from "./helpers";

/**
 * Overlays, focus, and the header. Three of these guard fixes that had
 * previously been recorded as done while not working.
 */

test.describe("the pause overlay", () => {

  /**
   * FOCUS MUST RETURN TO THE CONTROL THAT OPENED THE OVERLAY.
   *
   * Both PauseOverlay and ConfirmDialog contained a comment saying they did
   * this, for months, while doing the opposite. They captured
   * `document.activeElement` inside their open effect — but React applies every
   * DOM mutation for a commit BEFORE running passive effects, and the commit
   * that opens either overlay is the same one that marks the runner `inert`. A
   * focused element becoming inert resets focus to `<body>`, so both were
   * faithfully restoring focus to the body.
   *
   * It looked correct, and it genuinely IS correct on the exam setup page,
   * which marks nothing inert. That is how it survived review, and it is why
   * this assertion is made inside the quiz.
   *
   * WHAT THIS TEST DOES AND DOES NOT GUARD. A review lane reverted
   * `getLastFocused()` to `document.activeElement` — the precise pre-v2.3.0
   * bug — and this test still passed, because Chrome had not yet run its inert
   * focus fix-up when the effect read it. So this guards "focus is restored",
   * which failed when the restore call was removed, and NOT "restored via
   * focusin tracking". The mechanism is asserted in lib/last-focused.ts's own
   * note, not here.
   */
  test("returns focus to the Pause button on resume", async ({ page }) => {
    await startSection(page, "nmat", "Language Skills");

    const pause = page.getByRole("button", { name: /^Pause$/ });
    await pause.click();

    const overlay = page.getByRole("dialog");
    await expect(overlay).toBeVisible();
    await overlay.getByRole("button", { name: /resume/i }).click();
    await expect(overlay).toHaveCount(0);

    await expect(pause).toBeFocused();
  });

  /**
   * While paused, the quiz behind the overlay is inert — not merely covered.
   * `inert` removes it from pointer interaction AND from the tab order, which
   * pointer-events alone does not.
   */
  test("the quiz behind it is inert, not just covered", async ({ page }) => {
    await startSection(page, "nmat", "Language Skills");
    await page.getByRole("button", { name: /^Pause$/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const inertCount = await page.locator("[inert]").count();
    expect(inertCount).toBeGreaterThan(0);
  });

  /**
   * The clock shown while paused must be FROZEN, not merely clock-shaped.
   *
   * Matching /\d+:\d\d/ once proves a time exists, which is what the first
   * version of this test did. Pausing that does not stop is the failure worth
   * catching, because the whole point of the overlay is that stepping away
   * costs nothing.
   */
  test("freezes the clock while paused", async ({ page }) => {
    await startSection(page, "nmat", "Language Skills");
    await page.getByRole("button", { name: /^Pause$/ }).click();

    const dialog = page.getByRole("dialog");
    const first = await dialog.innerText();
    const shown = first.match(/\d+:\d\d/)?.[0];
    expect(shown, "the paused overlay must show the remaining time").toBeTruthy();

    await page.waitForTimeout(3000);
    expect(await dialog.innerText()).toContain(shown!);
  });
});

test.describe("the quiz header", () => {

  /**
   * THE HEADING MUST STILL TRUNCATE.
   *
   * A typography pass added `text-wrap: balance` to every heading from a rule
   * written OUTSIDE any `@layer`. An unlayered declaration beats everything
   * inside a layer regardless of specificity, so it reset `text-wrap-mode` and
   * overrode `.truncate`'s `white-space: nowrap` on a sticky `h-20` header —
   * turning its only overflow guard into decoration.
   *
   * Nothing looked broken, because the longest section name still fitted. It
   * would have broken on the first longer one, which is exactly the kind of
   * latent regression a suite is for.
   */
  test("the section heading is still set to truncate", async ({ page }) => {
    await startSection(page, "gre", "Quantitative Reasoning");

    const whiteSpace = await page
      .getByRole("heading", { level: 1 })
      .first()
      .evaluate((el) => getComputedStyle(el).whiteSpace);

    expect(whiteSpace).toBe("nowrap");
  });

  /** No page may scroll sideways on a phone. */
  test("does not overflow at a phone width", async ({ page, isMobile }) => {
    // Named for a phone, so only asserted on one. It ran on the desktop project
    // too, at 1280px, where the name was simply false.
    test.skip(!isMobile, "this asserts a phone width");
    await startSection(page, "gre", "Quantitative Reasoning");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("the mobile navigation sheet", () => {

  /**
   * Recorded as fixed once when only the Escape handler and the scroll lock had
   * landed. The sheet is an `aria-modal` dialog whose trigger sits inside the
   * inert wrapper, so opening it dropped focus to `<body>` and Tab then walked
   * the site header — the page BEHIND the modal — before ever reaching the
   * sheet.
   */
  test("opens as a dialog and closes on Escape", async ({ page, isMobile }) => {
    test.skip(!isMobile, "the sheet only exists below the lg breakpoint");
    await startSection(page, "nmat", "Language Skills");

    await page.getByRole("button", { name: /sections/i }).first().click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
  });
});

test.describe("the timer's live region", () => {

  /**
   * The clock is readable ON DEMAND and announced only at checkpoints.
   *
   * Two things had to be fixed here. The scope: an unscoped
   * `[role="status"][aria-live="polite"]` finds one per QuestionCard, so on a
   * 36-question section it matched 36 regions and passed with the timer's own
   * deleted — a review lane proved that by deleting it. And the strength:
   * asserting a region merely EXISTS says nothing about whether it ever speaks,
   * so this drives the deadline just past the ten minute mark and reads what it
   * said.
   *
   * The announcement fires on CROSSING a threshold, never on mounting below
   * one, which is why the deadline is set to 10:02 rather than to 9:00. That
   * seeding rule exists because resuming an attempt with three minutes left
   * used to say "10 minutes remaining" and then "5 minutes remaining" one
   * second later, to someone three minutes from an auto-submit.
   *
   * Writing this test also found that PROJECT_CONTEXT.md had claimed since
   * v2.3.0 that the digits are `aria-hidden`. They are not, deliberately:
   * hiding them removed the only way for a screen-reader user to ASK how much
   * time is left. `role="timer"` is readable on demand and is not an implicit
   * live region, so it does not announce itself.
   */
  test("announces at a checkpoint, from the timer's own region", async ({ page }) => {
    await startSection(page, "nmat", "Language Skills");

    const timer = page.getByRole("timer");
    await expect(timer).toHaveAttribute("aria-label", /remaining/i);

    const announcer = timerAnnouncer(page);
    await expect(announcer).toHaveCount(1);
    await expect(announcer).toBeEmpty();

    await setDeadlineIn(page, "nmat", "language-skills", 602_000);
    await expect(timerAnnouncer(page)).toContainText(/10 minutes remaining/i, {
      timeout: 20_000,
    });
  });
});
