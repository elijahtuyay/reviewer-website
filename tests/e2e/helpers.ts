import { expect, type Page } from "@playwright/test";

/**
 * Shared steps. Deliberately thin: a helper that hides which control was
 * clicked makes a failure harder to read than the click it replaced.
 */

/** Sections, keyed by exam, in the order the setup page lists them. */
export const SECTIONS = {
  nmat: ["language-skills", "quantitative-skills", "logical-reasoning"],
  gmat: ["data-insights", "quantitative", "verbal"],
  gre: ["verbal", "quantitative"],
} as const;

/**
 * Clear every attempt for an exam.
 *
 * Attempts live in sessionStorage and the section lock is global to an exam, so
 * a spec that starts a section poisons the next one unless this runs first.
 * Navigating to the origin before touching storage matters: sessionStorage is
 * per-origin and `about:blank` has none.
 */
export async function clearAttempts(page: Page, examId: keyof typeof SECTIONS) {
  await page.goto(`/${examId}`);
  await page.evaluate((exam) => {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(`progress:${exam}:`)) sessionStorage.removeItem(key);
    }
  }, examId);
}

/**
 * Start a section from its setup page and wait until the attempt is live.
 *
 * Waits on the timer rather than on the URL. The quiz route renders a lock
 * screen, a load error and the runner at the same address, so a URL assertion
 * would pass on all three — and the lock screen is exactly the state some of
 * these specs are trying to prove does NOT happen.
 */
export async function startSection(page: Page, examId: string, sectionLabel: string) {
  await page.goto(`/${examId}`);
  await page.getByRole("link", { name: new RegExp(`^Start ${sectionLabel}`, "i") }).click();
  await expect(page.getByRole("timer")).toBeVisible();
}

/** The remaining time as whole seconds, read from the timer's own text. */
export async function secondsLeft(page: Page): Promise<number> {
  const text = (await page.getByRole("timer").innerText()).trim();
  const parts = text.split(":").map((p) => Number(p.trim()));
  if (parts.some(Number.isNaN)) throw new Error(`unreadable timer: ${JSON.stringify(text)}`);
  return parts.length === 3
    ? parts[0] * 3600 + parts[1] * 60 + parts[2]
    : parts[0] * 60 + parts[1];
}

/** Every answer control in the attempt, single-select and multi-select alike. */
export function options(page: Page) {
  return page.locator('[role="radio"], [role="checkbox"]');
}
