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
 * exists to catch. Every one of those was found by a person driving a browser
 * by hand, and every harness written to find them was thrown away afterwards.
 *
 * USES THE INSTALLED CHROME, not a downloaded Chromium. `channel: "chrome"`
 * costs no 150 MB browser download, which matters because this project is
 * deliberately buildable and runnable offline. Running the suite needs a Chrome
 * on the machine and nothing from the network.
 *
 * SELECTORS ARE ROLES AND ACCESSIBLE NAMES, never CSS classes and never a test
 * id — the app has zero `data-testid` and should keep it that way. Every query
 * here therefore doubles as an assertion that the accessibility work still
 * holds: if a dialog loses its role or a control loses its name, these fail.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  /*
   * Serial, and this is not a default worth changing. Attempt state lives in
   * sessionStorage per browser context and several specs deliberately drive the
   * section lock, which is global to an exam. Parallel workers racing the same
   * lock would produce exactly the flakiness that teaches people to ignore a
   * suite.
   */
  workers: 1,
  fullyParallel: false,
  /*
   * No retries locally. A test that passes on the second try is a test that
   * found something, and this project has twice been misled by a harness that
   * reported a false result.
   */
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? "github" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
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
    command: "npm run dev",
    url: "http://localhost:3000",
    /*
     * Reuse a dev server that is already up. The alternative silently starts a
     * second one, which on Windows fails with EADDRINUSE while the OLD server
     * keeps answering — the documented trap that makes a suite test a stale
     * build and report green.
     */
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
