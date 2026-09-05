import { expect, test } from "@playwright/test";
import { clearAttempts, startSection } from "./helpers";

/**
 * Overlays, focus, and the header. Three of these guard fixes that had
 * previously been recorded as done while not working.
 */

test.describe("the pause overlay", () => {
  test.beforeEach(async ({ page }) => clearAttempts(page, "nmat"));

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

  /** The frozen clock is shown, so a paused candidate can see what they have left. */
  test("shows the frozen time", async ({ page }) => {
    await startSection(page, "nmat", "Language Skills");
    await page.getByRole("button", { name: /^Pause$/ }).click();
    await expect(page.getByRole("dialog")).toContainText(/\d+:\d\d/);
  });
});

test.describe("the quiz header", () => {
  test.beforeEach(async ({ page }) => clearAttempts(page, "gre"));

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
  test("does not overflow at a phone width", async ({ page }) => {
    await startSection(page, "gre", "Quantitative Reasoning");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("the mobile navigation sheet", () => {
  test.beforeEach(async ({ page }) => clearAttempts(page, "nmat"));

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
  test.beforeEach(async ({ page }) => clearAttempts(page, "nmat"));

  /**
   * The clock is readable ON DEMAND and announced only at checkpoints.
   *
   * Writing this test found a stale claim in PROJECT_CONTEXT.md, which says the
   * digits are `aria-hidden` so the clock is not re-announced every second.
   * They are not, and Timer.tsx explains why: hiding them did stop the
   * per-second chatter, but it also removed the only way for a screen-reader
   * user to ASK how much time is left, which they need before committing to a
   * long reading passage. `role="timer"` is readable on demand and is not an
   * implicit live region, so it does not announce itself, and a separate polite
   * region does the announcing at 10, 5 and 1 minutes.
   *
   * Before any of this the timer was a plain div with no role, so a
   * screen-reader user got no warning of any kind before the section submitted
   * itself under them.
   */
  test("is readable on demand and announces politely", async ({ page }) => {
    await startSection(page, "nmat", "Language Skills");

    const timer = page.getByRole("timer");
    await expect(timer).toHaveAttribute("aria-label", /remaining/i);

    const status = page.locator('[role="status"][aria-live="polite"]');
    await expect(status.first()).toBeAttached();
  });
});
