import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests. `npm run test:e2e`.
 *
 * WHY THIS EXISTS, since the repo already has three verification scripts.
 *
 * `verify:engine`, `audit:bank` and `audit:copy` cover pure logic and data
 * well: the adaptive ladder, both scoring models, both calculators, and every
 * statistical guarantee about 762 questions. What had nothing was component and
 * browser behavior, and that is where this project's bugs actually appear. The
 * suite is written from the list of them, so each spec names the defect it
 * exists to catch.
 *
 * USES THE INSTALLED CHROME, not a downloaded Chromium. `channel: "chrome"`
 * costs no browser download, which matters because this project is deliberately
 * buildable and runnable offline. `npx playwright install` is not needed.
 *
 * SELECTORS ARE ROLES AND ACCESSIBLE NAMES, never CSS classes and never a test
 * id — the app has zero `data-testid` and should keep it that way. Every query
 * here therefore doubles as an assertion that the accessibility work still
 * holds: if a dialog loses its role or a control loses its name, these fail.
 */

/*
 * ITS OWN PORT, and this is a correctness fix rather than tidiness.
 *
 * The first version of this config ran on 3000 with `reuseExistingServer` and a
 * comment claiming that avoided the stale-build trap this project documents. It
 * is the opposite: Playwright only probes that the URL answers 2xx, never WHAT
 * is answering. A `next start` of an older build sitting on 3000 — the exact
 * Windows situation PROJECT_CONTEXT records, where a second server dies with
 * EADDRINUSE while the old one keeps serving — would be silently tested and
 * reported green.
 *
 * A port the suite owns removes the ambiguity instead of documenting it. Reuse
 * is then safe, because the only thing that can be on 3100 is this suite's own
 * server, and a dev server you left running is still reused between runs.
 */
const PORT = 3100;

/*
 * AGAINST A PRODUCTION BUILD BY DEFAULT, which settled two problems at once.
 *
 * The first attempt ran `next dev` on a port of its own. Next 16 refuses to
 * start a second dev server for the same project directory AT ALL, whatever
 * port you give it, so the suite could not run while the app was running — and
 * falling back to sharing port 3000 reintroduces exactly the ambiguity the
 * dedicated port existed to remove.
 *
 * `next start` has no such lock, so the suite owns 3100 and coexists with a dev
 * server on 3000. It also removes a real gap a review lane raised: dev and
 * production do not emit CSS identically, and one spec asserts a computed style
 * to guard an `@layer` cascade-ordering bug. Testing the artifact that ships is
 * the honest thing to assert against.
 *
 * The build is cheap here — a few seconds compiled plus static generation of 17
 * pages — because every route is prerendered. Set `E2E_DEV=1` to run against
 * the dev server instead, which is faster to iterate on but requires that no
 * other dev server is running.
 */
const useDev = process.env.E2E_DEV === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  /*
   * Serial. NOT for state isolation — Playwright gives every test its own
   * BrowserContext, so sessionStorage starts empty and attempts cannot leak
   * between tests. The reason is the shared dev server: parallel workers make
   * Turbopack compile several routes at once, which pushes first-paint past the
   * expect timeout and produces failures that have nothing to do with the app.
   */
  workers: 1,
  fullyParallel: false,
  /*
   * No retries. A test that passes on the second try is a test that found
   * something, and this project has twice been misled by a harness that
   * reported a false result.
   */
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? "github" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    /*
     * A real phone viewport, not a narrowed desktop. The audience is largely
     * mobile, the desktop sidebar is hidden below `lg`, and the mobile nav
     * sheet is a separate component with its own focus trap — so a
     * desktop-only suite would never execute it.
     */
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
  webServer: {
    // `npx next` directly rather than `npm run dev -- --port`: on Windows npm
    // did not forward the flag, so Next fell back to 3000 and found the dev
    // server already there.
    command: useDev
      ? `npx next dev --port ${PORT}`
      : `npm run build && npx next start --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    // A cold production build is the slow path, not the dev server.
    timeout: useDev ? 120_000 : 300_000,
  },
});
