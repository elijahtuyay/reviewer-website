import { expect, test, type Locator, type Page } from "@playwright/test";
import { startSection } from "./helpers";

/**
 * THE TWO CALCULATORS MUST DISAGREE, AND MUST SAY SO ON SCREEN.
 *
 * `verify:engine` already asserts both reducers, including this exact sum. This
 * suite asserts something the reducers cannot: what the panel actually RENDERS.
 *
 * That distinction is not theoretical here. `CalculatorPanel` shipped with
 * `model.banner`, `model.details`, `model.label`, `KeySpec.span` and
 * `KeySpec.primary` all declared, all supplied correctly per device, and none
 * of them read. The GRE panel therefore explained itself with the TI-108's
 * copy — "it calculates left to right, so 2 + 3 x 4 is 20" — directly
 * contradicting its own reducer, which returns 14 and is asserted doing so two
 * files away. `tsc`, `lint`, 30 calculator assertions and a browser run that
 * exercised the arithmetic all passed. An unread object field is not a type
 * error, not a lint error, and invisible to a test that only presses keys.
 *
 * So each test here presses the keys AND reads the banner.
 */

/** Open the calculator and return its panel. */
async function openCalculator(page: Page) {
  await page.getByRole("button", { name: /calculator/i }).first().click();
  const panel = page.getByRole("group", { name: "On-screen calculator" });
  await expect(panel).toBeVisible();
  return panel;
}

/**
 * Press a sequence of keys, BY ACCESSIBLE NAME.
 *
 * Each key renders its label twice — once `aria-hidden` for the eye and once
 * `sr-only` for a screen reader — so the button's textContent is "22" for the
 * digit 2, and matching on visible text finds nothing. The accessible name is
 * the sr-only string, which is the `srLabel` where one is given and the printed
 * label otherwise.
 *
 * Naming the keys the way assistive technology sees them is the right level
 * anyway: these presses now also assert that every key a candidate needs is
 * reachable and correctly announced.
 */
const KEY_NAMES: Record<string, string> = {
  "+": "Plus",
  "×": "Multiply",
  "=": "Equals",
  "M+": "Memory add",
  MR: "Memory recall",
  C: "Clear the calculation",
};

async function press(panel: Locator, keys: string[]) {
  for (const key of keys) {
    const name = KEY_NAMES[key] ?? key;
    await panel.getByRole("button", { name, exact: true }).click();
  }
}

test.describe("the GMAT Data Insights calculator", () => {
  /**
   * A TI-108: strictly left to right, so 2 + 3 x 4 is 20, not 14. This looks
   * like a bug and is not, which is why the panel says so out loud.
   */
  test("calculates left to right, and says it does", async ({ page }) => {
    await startSection(page, "gmat", "Data Insights");
    const panel = await openCalculator(page);

    await expect(panel).toContainText(/left to right/i);
    await expect(panel).toContainText(/is 20/);

    await press(panel, ["2", "+", "3", "×", "4", "="]);
    await expect(panel).toContainText("20");
  });
});

test.describe("the GRE Quantitative calculator", () => {
  /**
   * A different machine. It honors order of operations, so the same keys give
   * 14. Merging the two would teach the wrong arithmetic for whichever exam the
   * candidate is not taking.
   */
  test("honors order of operations, and says it does", async ({ page }) => {
    await startSection(page, "gre", "Quantitative Reasoning");
    const panel = await openCalculator(page);

    await expect(panel).toContainText(/order of operations/i);
    await expect(panel).toContainText(/is 14, not 20/);

    await press(panel, ["2", "+", "3", "×", "4", "="]);
    await expect(panel).toContainText("14");
  });

  /**
   * Memory survives `C`, which is what makes it useful on a device whose only
   * escape from precedence is banking a subtotal. A bug caught while the GRE
   * reducer was being written returned the initial state wholesale and wiped it.
   */
  test("clearing the calculation keeps memory", async ({ page }) => {
    await startSection(page, "gre", "Quantitative Reasoning");
    const panel = await openCalculator(page);

    await press(panel, ["7", "M+"]);
    await press(panel, ["C"]);
    await press(panel, ["MR"]);
    await expect(panel).toContainText("7");
  });
});

test.describe("the sections that grant no calculator", () => {
  /**
   * NMAT provides none anywhere, so no section of it may offer one. The note
   * explaining that a section has no calculator renders only where the same
   * exam grants one elsewhere — unconditional, it told NMAT readers that a
   * preposition question was "meant to come out through reasoning and
   * estimation" and implied some other NMAT section had one.
   */
  test("NMAT has no calculator at all", async ({ page }) => {
    await startSection(page, "nmat", "Quantitative Skills");
    await expect(page.getByRole("button", { name: /calculator/i })).toHaveCount(0);
  });
});
