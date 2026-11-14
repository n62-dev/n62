// SPDX-License-Identifier: GPL-3.0-or-later
// R190 (docs/04 5.3): the matrix editor's sizes. Shift + 4's row 9, New, makes a 2 × 2 of zeros under the first letter
// no name of the user's holds and opens its grid; the grid's ☰ adds a row or a column at the end (zeros) and deletes the
// row or the column under the highlight (a 1 × 1 keeps its cell); each writes the matrix back as a cell does (R189: one
// history row, the line `M:=\begin{pmatrix}…\end{pmatrix}`). The sheet's order holds with New live: the functions at
// rows 1 to 8, New at 9, the stored matrices from row 10. The real engine; expected values by hand.
import { expect, test, type Page } from "@playwright/test";
import { open, sheet, sheetKey, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
});

/** Runs `giac` in the current view as the line would and waits for its row; the row's text. */
async function run(page: Page, giac: string): Promise<string> {
  const n = await page.evaluate(() => window.n62.session.items.length);
  await page.evaluate((g) => window.n62.session.submit(g, g), giac);
  await page.waitForFunction((n) => window.n62.session.items.length > n && window.n62.session.items.at(-1)?.status !== "pending", n, { timeout: 20_000 });
  return page.evaluate(() => window.n62.session.items.at(-1)?.text ?? "");
}

async function store(page: Page, giac: string, name: string): Promise<void> {
  await run(page, giac);
  await page.waitForFunction((n) => window.n62.session.userNames.some((u) => u.name === n), name, { timeout: 20_000 });
}

const grid = (page: Page) => page.getByTestId("matrix-grid");
const menu = (page: Page) => page.getByTestId("matrix-menu");
const texts = (page: Page): Promise<(string | null)[]> => grid(page).locator("td[data-cell]").evaluateAll((els) => els.map((e) => e.getAttribute("data-text")));
const lastLatex = (page: Page): Promise<string | undefined> => page.evaluate(() => window.n62.session.home.at(-1)?.latex);
const rowCount = (page: Page): Promise<number> => page.evaluate(() => window.n62.session.home.length);

/** M:=[[1,2],[3,4]] stored and its grid open with the highlight on (1,1). */
async function openM(page: Page): Promise<void> {
  await store(page, "M:=[[1,2],[3,4]]", "M");
  await tap(page, ["shift", "d4"]);
  await sheetKey(page, ["d0"]);
  await expect(grid(page).locator("td[data-cell]")).toHaveCount(4);
}

test("the sheet's order holds with New live: functions 1 to 8, New at 9, the stored matrices from row 10", async ({ page }) => {
  await store(page, "M:=[[1,2],[3,4]]", "M");
  await store(page, "Q:=[[1,2,3]]", "Q");
  await tap(page, ["shift", "d4"]);
  const rows = sheet(page).getByRole("menuitem");
  await expect(rows).toHaveCount(11);
  const ids = await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-id")));
  expect(ids.slice(0, 9)).toEqual(["fn:tran", "fn:dot", "fn:cross", "fn:norm", "fn:rref", "fn:eigenvals", "fn:det", "fn:inv", "matrix:new"]);
  expect(ids.slice(9).sort()).toEqual(["matrix:M", "matrix:Q"]);
  await expect(rows.nth(8)).toHaveAttribute("aria-label", /^9 New/);
  await expect(rows.nth(8)).not.toHaveAttribute("aria-disabled", "true");
  await expect(rows.nth(9)).toHaveAttribute("aria-label", /^0 /);
  await expect(rows.nth(7)).toHaveAttribute("aria-label", /^8 Inverse/); // no digit of a fixed row has moved
});

test("Shift + 4 › New (key 9): a 2 × 2 of zeros named A, its grid open; the next one is B", async ({ page }) => {
  await tap(page, ["shift", "d4"]);
  await expect(sheet(page).getByRole("menuitem")).toHaveCount(9);
  const before = await rowCount(page);
  await sheetKey(page, ["d9"]);
  await expect(grid(page)).toBeVisible();
  await expect(grid(page)).toHaveAttribute("aria-label", "A");
  await expect.poll(() => texts(page)).toEqual(["0", "0", "0", "0"]);
  await expect(grid(page).locator("tbody tr")).toHaveCount(2);
  expect(await rowCount(page)).toBe(before + 1); // one history row, through the normal path
  expect(await lastLatex(page)).toBe("A:=\\begin{pmatrix}0&0\\\\0&0\\end{pmatrix}");
  await tap(page, ["esc"]); // back to the list: A is the first stored matrix
  await expect(sheet(page).getByRole("menuitem").nth(9)).toHaveAttribute("aria-label", /^0 A/);
  await sheetKey(page, ["d9"]);
  await expect(grid(page)).toHaveAttribute("aria-label", "B");
  expect(await run(page, "B")).toBe("[[0,0],[0,0]]");
});

test("New takes the first letter free among the user's names, whatever they hold", async ({ page }) => {
  await store(page, "A:=5", "A");
  await store(page, "C:=[[1]]", "C");
  await tap(page, ["shift", "d4"]);
  await sheetKey(page, ["d9"]);
  await expect(grid(page)).toHaveAttribute("aria-label", "B");
  await expect.poll(() => texts(page)).toEqual(["0", "0", "0", "0"]);
});

test("☰ in the grid opens its menu: 1 Add a row, 2 Add a column, 3 Delete row, 4 Delete column; Esc and ☰ close it", async ({ page }) => {
  await openM(page);
  await tap(page, ["menu"]);
  await expect(menu(page)).toBeVisible();
  await expect(grid(page)).toBeVisible(); // the sheet did not close
  const items = menu(page).getByRole("menuitem");
  await expect(items).toHaveCount(4);
  await expect(items.nth(0)).toHaveAttribute("aria-label", /^1 Add a row/);
  await expect(items.nth(1)).toHaveAttribute("aria-label", /^2 Add a column/);
  await expect(items.nth(2)).toHaveAttribute("aria-label", /^3 Delete row 1/);
  await expect(items.nth(3)).toHaveAttribute("aria-label", /^4 Delete column 1/);
  await tap(page, ["down"]); // the arrows move the menu's highlight, not the grid's
  await expect(items.nth(1)).toHaveAttribute("data-active", "true");
  await expect(grid(page).locator('td[data-active="true"]')).toHaveAttribute("data-cell", "1,1");
  await tap(page, ["esc"]);
  await expect(menu(page)).toBeHidden();
  await expect(grid(page)).toBeVisible(); // Esc closed the menu only
  await tap(page, ["menu"]);
  await expect(menu(page)).toBeVisible();
  await tap(page, ["menu"]);
  await expect(menu(page)).toBeHidden();
  await expect(grid(page)).toBeVisible();
});

test("1 adds a row of zeros at the end and writes the matrix back (one history row)", async ({ page }) => {
  await openM(page);
  const before = await rowCount(page);
  await tap(page, ["menu"]);
  await sheetKey(page, ["d1"]);
  await expect.poll(() => texts(page)).toEqual(["1", "2", "3", "4", "0", "0"]);
  await expect(grid(page).locator("tbody tr")).toHaveCount(3);
  await expect(menu(page)).toBeHidden();
  expect(await rowCount(page)).toBe(before + 1);
  expect(await lastLatex(page)).toBe("M:=\\begin{pmatrix}1&2\\\\3&4\\\\0&0\\end{pmatrix}");
  await tap(page, ["esc"]);
  expect(await run(page, "M")).toBe("[[1,2],[3,4],[0,0]]");
});

test("2 adds a column of zeros at the end (Enter on the highlighted menu row)", async ({ page }) => {
  await openM(page);
  await tap(page, ["menu", "down", "enter"]);
  await expect.poll(() => texts(page)).toEqual(["1", "2", "0", "3", "4", "0"]);
  expect(await lastLatex(page)).toBe("M:=\\begin{pmatrix}1&2&0\\\\3&4&0\\end{pmatrix}");
  await tap(page, ["esc"]);
  expect(await run(page, "M")).toBe("[[1,2,0],[3,4,0]]");
});

test("3 and 4 delete the row and the column under the highlight (a tap on the menu row picks it)", async ({ page }) => {
  await store(page, "M:=[[1,2,3],[4,5,6],[7,8,9]]", "M");
  await tap(page, ["shift", "d4"]);
  await sheetKey(page, ["d0"]);
  await expect(grid(page).locator("td[data-cell]")).toHaveCount(9);
  await tap(page, ["down", "right", "menu"]); // the highlight on (2,2)
  await expect(menu(page).getByRole("menuitem").nth(2)).toHaveAttribute("aria-label", /^3 Delete row 2/);
  await menu(page).locator('[data-id="delRow"]').tap();
  await expect.poll(() => texts(page)).toEqual(["1", "2", "3", "7", "8", "9"]);
  expect(await lastLatex(page)).toBe("M:=\\begin{pmatrix}1&2&3\\\\7&8&9\\end{pmatrix}");
  await tap(page, ["right", "menu"]); // (2,3)... the highlight stays in the matrix: column 3, row 2
  await sheetKey(page, ["d4"]);
  await expect.poll(() => texts(page)).toEqual(["1", "2", "7", "8"]);
  await expect(grid(page).locator('td[data-active="true"]')).toHaveAttribute("data-cell", "2,2"); // (a deleted last column: the highlight steps back)
  await tap(page, ["esc"]);
  expect(await run(page, "M")).toBe("[[1,2],[7,8]]");
});

test("a 1 × 1 matrix keeps its cell: Delete row and Delete column say so and change nothing", async ({ page }) => {
  await store(page, "O:=[[5]]", "O");
  await tap(page, ["shift", "d4"]);
  await sheetKey(page, ["d0"]);
  await expect.poll(() => texts(page)).toEqual(["5"]);
  const before = await rowCount(page);
  await tap(page, ["menu"]);
  await expect(menu(page).locator('[data-id="delRow"]')).toHaveAttribute("aria-disabled", "true");
  await expect(menu(page).locator('[data-id="delCol"]')).toHaveAttribute("aria-disabled", "true");
  await sheetKey(page, ["d3"]);
  await expect(page.getByTestId("matrix-refusal")).toHaveText("A matrix keeps at least one cell");
  await tap(page, ["menu"]);
  await sheetKey(page, ["d4"]);
  await expect(page.getByTestId("matrix-refusal")).toBeVisible();
  expect(await texts(page)).toEqual(["5"]);
  expect(await rowCount(page)).toBe(before); // nothing was written
  await tap(page, ["menu", "d1"]); // it can still grow
  await expect.poll(() => texts(page)).toEqual(["5", "0"]);
  expect(await lastLatex(page)).toBe("O:=\\begin{pmatrix}5\\\\0\\end{pmatrix}");
});
