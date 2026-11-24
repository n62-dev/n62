// SPDX-License-Identifier: GPL-3.0-or-later
// R894 (owner-style hunt 2026-11-23, h2 #3): the unit view's result is one Home row (docs/04 4.3 "The way back"), so the
// units key in CAS goes to Home first and opens the view there: the row is in sight under the view and after Esc. Expected
// values derived: 72 typed with k m in the slot is 72 km.
import { expect, test, type Page } from "@playwright/test";
import { flick, open, tap } from "./helpers.ts";

const unitsKey = async (page: Page): Promise<void> => {
  await flick(page, "tmpl", "up");
  await page.waitForFunction(() => window.n62.unitView !== undefined && document.querySelector('[data-pad="unit"]') !== null);
};
const result = (page: Page) => page.getByTestId("unit-result");
const view = (page: Page): Promise<string> => page.evaluate(() => window.n62.session.view);
/** The place the bar shows as current is Home, and the history drawn holds the view's 72 km row. */
async function inHome(page: Page): Promise<void> {
  await expect(page.getByTestId("tab-home")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("tab-slot")).toHaveAttribute("aria-selected", "false");
  expect(await view(page)).toBe("home");
  const row = page.locator('.history [data-status="done"]').last();
  await expect(row).toBeVisible();
  await expect(row).toContainText("km");
}

test.describe("the units key in CAS (R894)", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "");
    await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
    await page.evaluate(() => window.n62.session.setView("cas"));
    await expect(page.getByTestId("tab-slot")).toHaveAttribute("aria-selected", "true");
  });

  test("CAS, 72, the units key, k m, Enter: = 72 km, the bar on Home with the row in sight; Esc stays in Home", async ({ page }) => {
    await tap(page, ["d7", "d2"]);
    await unitsKey(page);
    await tap(page, ["d4", "d9", "enter"]);
    await expect(result(page)).toHaveAttribute("data-text", "72");
    await expect(result(page)).toHaveAttribute("data-unit", "km");
    await inHome(page);
    expect(await page.evaluate(() => window.n62.session.cas.length), "CAS gets no row").toBe(0);
    await tap(page, ["esc"]);
    await page.waitForFunction(() => window.n62.unitView === undefined);
    await inHome(page);
  });

  test("a picked CAS row, the units key (route.ts's picked-row path), k m, Enter: the same, in Home", async ({ page }) => {
    await tap(page, ["d7", "d2", "enter"]);
    await expect.poll(() => page.evaluate(() => window.n62.session.cas.filter((i) => i.status === "done").length)).toBe(1);
    await page.evaluate(() => window.n62.entry.clear());
    await tap(page, ["up"]);
    await expect(page.locator('[data-selected="true"]')).toHaveCount(1);
    await unitsKey(page);
    expect(await page.evaluate(() => window.n62.entry.value)).toBe("72");
    await tap(page, ["d4", "d9", "enter"]);
    await expect(result(page)).toHaveAttribute("data-unit", "km");
    await inHome(page);
    expect(await page.evaluate(() => window.n62.session.cas.length), "CAS keeps its one row").toBe(1);
    await tap(page, ["esc"]);
    await page.waitForFunction(() => window.n62.unitView === undefined);
    await inHome(page);
  });
});

// Control: from Home the units key works as before (no place change, the row in Home).
test("control: Home, 72, the units key, k m, Enter, Esc: Home all along", async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
  await tap(page, ["d7", "d2"]);
  await unitsKey(page);
  await tap(page, ["d4", "d9", "enter"]);
  await expect(result(page)).toHaveAttribute("data-unit", "km");
  await inHome(page);
  await tap(page, ["esc"]);
  await page.waitForFunction(() => window.n62.unitView === undefined);
  await inHome(page);
});
