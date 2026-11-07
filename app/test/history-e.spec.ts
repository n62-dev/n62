// SPDX-License-Identifier: GPL-3.0-or-later
// R152 (F189): a history row draws e and i as the entry line does, never `\exponentialE` or `\imaginaryI` as raw LaTeX in
// red. MathLive's `macros` option replaces its own table; the static renderer merges it with the entry's (render/macros.ts).
// Real engine; the fixture row (i to the i, which cannot be typed yet: F184) comes from the stored history.
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

/** The drawn rows hold no raw macro name, no MathLive error and no red text. */
async function expectDrawn(page: Page): Promise<void> {
  const math = page.locator(".history .math");
  await expect(math.first()).toBeVisible();
  // the drawn markup (data-latex keeps the source on purpose)
  const drawn = (await page.locator(".history .math .ML__latex").evaluateAll((els) => els.map((e) => e.innerHTML + e.textContent))).join("\n");
  expect(drawn).not.toContain("exponentialE");
  expect(drawn).not.toContain("imaginaryI");
  expect(await page.locator(".history .ML__error, .history .math [style*='color: red'], .history .math [style*='color:red']").count()).toBe(0);
}

async function typeEulerAndEnter(page: Page): Promise<void> {
  await tap(page, ["shift", "ln", "shift", "d2", "mul", "shift", "d3", "enter"]); // e^(i·π)
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
}

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
});

test("Home: e^(iπ) in the history row draws e and i, not LaTeX", async ({ page }) => {
  await typeEulerAndEnter(page);
  await expectDrawn(page);
  await expect(page.locator(".history .item .in .math")).toHaveAttribute("data-latex", /exponentialE/);
});

test("CAS: e^(iπ) in the history row draws e and i, not LaTeX", async ({ page }) => {
  await tap(page, ["@cas"]);
  await typeEulerAndEnter(page);
  await expectDrawn(page);
});

test("a stored row i to the i draws as the entry line draws it", async ({ page }) => {
  await page.evaluate(() => window.n62.session.submit("\\imaginaryI^{\\imaginaryI}"));
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await expectDrawn(page);
});
