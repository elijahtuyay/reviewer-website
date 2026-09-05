import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Shared steps. Deliberately thin: a helper that hides which control was
 * clicked makes a failure harder to read than the click it replaced.
 *
 * There is no `clearAttempts` here, and its absence is deliberate. An earlier
 * version had one, with a comment claiming a spec that starts a section poisons
 * the next one. That is not true: Playwright gives every test a fresh
 * BrowserContext, so sessionStorage is empty at the start of each one and
 * attempts cannot leak between them. A helper that guards against an impossible
 * failure teaches the next author that state leaks when it does not.
 */

/**
 * Start a section from its setup page and wait until the attempt is live.
 *
 * Waits on the timer rather than on the URL. The quiz route renders a lock
 * screen, a load error and the runner at the same address, so a URL assertion
 * would pass on all three — and the lock screen is exactly the state some of
 * these specs are trying to prove does NOT happen.
 *
 * The longer timeout is for the first visit to a route only: against `next dev`
 * that click triggers a cold Turbopack compile of the quiz page plus a dynamic
 * import of the section's question bank, which can exceed the global 10s expect
 * timeout on a first run without anything being wrong.
 */
export async function startSection(page: Page, examId: string, sectionLabel: string) {
  await page.goto(`/${examId}`);
  await page.getByRole("link", { name: new RegExp(`^Start ${sectionLabel}`, "i") }).click();
  await expect(page.getByRole("timer")).toBeVisible({ timeout: 30_000 });
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

/**
 * The timer's OWN polite live region, not any of the others on the page.
 *
 * Scoping matters more than it looks. `QuestionCard` renders a
 * `role="status" aria-live="polite"` per question, so an unscoped locator finds
 * 36 of them on an NMAT section and passes whether or not the timer has one at
 * all — proved by deleting the timer's region and watching the test stay green.
 */
export function timerAnnouncer(page: Page): Locator {
  return page.locator('div:has(> [role="timer"]) > [role="status"][aria-live="polite"]');
}

/** The stored attempt record for a section, straight out of sessionStorage. */
export async function storedAttempt(page: Page, examId: string, sectionId: string) {
  return page.evaluate(
    ([exam, section]) => {
      const raw = sessionStorage.getItem(`progress:${exam}:${section}`);
      return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    },
    [examId, sectionId]
  );
}

/**
 * Rewrite the running attempt's deadline and reload onto it.
 *
 * The countdown is deadline-based, so moving the deadline is how a test reaches
 * the last few minutes of a 45 minute section without waiting for them.
 */
export async function setDeadlineIn(page: Page, examId: string, sectionId: string, ms: number) {
  await page.evaluate(
    ([exam, section, offset]) => {
      const key = `progress:${exam}:${section}`;
      const raw = sessionStorage.getItem(key);
      if (!raw) throw new Error(`no attempt at ${key}`);
      const record = JSON.parse(raw);
      record.deadline = Date.now() + (offset as number);
      sessionStorage.setItem(key, JSON.stringify(record));
    },
    [examId, sectionId, ms] as const
  );
  await page.reload();
  await expect(page.getByRole("timer")).toBeVisible({ timeout: 30_000 });
}

/**
 * Force the attempt to serve exactly these questions, and reload onto them.
 *
 * The draw is random per attempt, so a test that needs a KNOWN question cannot
 * wait for one to turn up. Rewriting `questionIds` is the same lever
 * `setDeadlineIn` uses on the deadline.
 */
export async function pinQuestions(
  page: Page,
  examId: string,
  sectionId: string,
  ids: string[]
) {
  await page.evaluate(
    ([exam, section, questionIds]) => {
      const key = `progress:${exam}:${section}`;
      const raw = sessionStorage.getItem(key);
      if (!raw) throw new Error(`no attempt at ${key}`);
      const record = JSON.parse(raw);
      record.questionIds = questionIds;
      record.answers = {};
      record.cursor = 0;
      sessionStorage.setItem(key, JSON.stringify(record));
    },
    [examId, sectionId, ids] as const
  );
  await page.reload();
  await expect(page.getByRole("timer")).toBeVisible({ timeout: 30_000 });
}
