// SPDX-License-Identifier: GPL-3.0-or-later
// R188 (docs/04 5.3): Shift + 4 lists the stored matrices after its fixed rows (the eight functions, then New at row 9,
// disabled until R190); picking one shows it in a grid of rows and columns, its values through the Home formatter, read
// from the engine. ▲ ▼ ◀ ▶ move the highlight, Esc closes the grid. The real engine.
import { expect, test, type Page } from "@playwright/test";
import { open, sheet, sheetKey, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
});

async function store(page: Page, giac: string, name: string): Promise<void> {
  await page.evaluate((g) => window.n62.session.submit(g, g), giac);
  await page.waitForFunction((n) => window.n62.session.userNames.some((u) => u.name === n), name, { timeout: 20_000 });
}

const grid = (page: Page) => page.getByTestId("matrix-grid");
/** The highlighted cell as "row,column" (1-based). */
const active = (page: Page): Promise<string | null> => grid(page).locator('td[data-active="true"]').getAttribute("data-cell");

test("a stored matrix is listed after New, and its grid shows its values; the arrows move, Esc closes", async ({ page }) => {
  await store(page, "M:=[[1,2],[3,4]]", "M");
  await store(page, "k:=5", "k");
  await tap(page, ["shift", "d4"]);
  await expect(page.getByTestId("sheet-title")).toHaveText("Matrix");
  const rows = sheet(page).getByRole("menuitem");
  await expect(rows).toHaveCount(10); // the eight functions, New, M (k holds a number: not listed)
  await expect(rows.nth(8)).toHaveAttribute("aria-label", /^9 New/);
  await expect(rows.nth(8)).toHaveAttribute("aria-disabled", "true");
  await expect(rows.nth(9)).toHaveAttribute("aria-label", /^0 M/);
  await expect(sheet(page).locator('[data-id="matrix:k"]')).toHaveCount(0);

  await sheetKey(page, ["d0"]); // key 0 picks the first stored matrix
  await expect(grid(page)).toBeVisible();
  await expect(grid(page).locator("tbody tr")).toHaveCount(2);
  const cells = grid(page).locator("td[data-cell]");
  await expect(cells).toHaveCount(4);
  expect(await cells.evaluateAll((els) => els.map((e) => e.getAttribute("data-text")))).toEqual(["1", "2", "3", "4"]);

  // the arrows of the on-screen keypad (the phone's path) and of a hardware keyboard move the highlight
  await expect.poll(() => active(page)).toBe("1,1");
  await tap(page, ["down"]);
  await expect.poll(() => active(page)).toBe("2,1");
  await tap(page, ["right"]);
  await expect.poll(() => active(page)).toBe("2,2");
  await sheetKey(page, ["up"]);
  await expect.poll(() => active(page)).toBe("1,2");
  await sheetKey(page, ["left"]);
  await expect.poll(() => active(page)).toBe("1,1");
  await sheetKey(page, ["left"]); // at the edge it stays
  await expect.poll(() => active(page)).toBe("1,1");

  await tap(page, ["esc"]);
  await expect(grid(page)).toBeHidden();
});

test("the grid's numbers go through the Home formatter (the decimal comma)", async ({ page }) => {
  await store(page, "N:=[[1.5,2],[3,4.25]]", "N");
  await page.evaluate(() => window.n62.session.setDecimalMark("comma"));
  await tap(page, ["shift", "d4"]);
  await sheetKey(page, ["d0"]);
  const cells = grid(page).locator("td[data-cell]");
  await expect(cells).toHaveCount(4);
  expect(await cells.evaluateAll((els) => els.map((e) => e.getAttribute("data-text")))).toEqual(["1,5", "2", "3", "4,25"]);
});

test("with no matrix stored there is no matrix row", async ({ page }) => {
  await store(page, "k:=5", "k");
  await tap(page, ["shift", "d4"]);
  const rows = sheet(page).getByRole("menuitem");
  await expect(rows).toHaveCount(9);
  await expect(rows.nth(8)).toHaveAttribute("aria-label", /^9 New/);
  await expect(sheet(page).locator('[data-id^="matrix:"]:not([data-id="matrix:new"])')).toHaveCount(0);
});
