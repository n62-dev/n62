// SPDX-License-Identifier: GPL-3.0-or-later
// R780 (docs/05 3.1): every row of a fixed menu has a number the keypad reaches. Rows 1…10 take 1…9 and 0; rows 11 and 12 take the
// two keys after 0 on the pad, `.` (row 11) and the space bar (row 12); they are drawn with those faces. A list of more than 12
// rows (a data list that takes letters) numbers 1…10 only and its `.` and space keys stay dead. The longest fixed menu is the
// 12 categories of Find (and Help), measured in the report (R780).
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "engine=fake");
});

const sheet = (page: Page) => page.locator('[role="menu"]');
const title = (page: Page) => page.getByTestId("sheet-title");
const numbers = (page: Page) => sheet(page).locator('[role="menuitem"] .n').allTextContents();
const labels = (page: Page) => sheet(page).locator('[role="menuitem"] .label').allTextContents();

test("Find's 12 categories: every row shows its number, 1…9, 0, then . and the space face", async ({ page }) => {
  await tap(page, ["math"]);
  await expect(sheet(page).getByRole("menuitem")).toHaveCount(12);
  expect(await numbers(page)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", ".", "␣"]);
});

test("the dot key picks row 11, the space bar row 12, 0 row 10, 1 row 1", async ({ page }) => {
  await tap(page, ["math"]);
  const names = await labels(page);
  for (const [key, n] of [["dot", 11], ["space", 12], ["d0", 10], ["d1", 1]] as const) {
    await tap(page, [key]);
    await expect(title(page)).toContainText(names[n - 1] as string);
    await tap(page, ["esc"]);
    await expect(sheet(page).getByRole("menuitem")).toHaveCount(12);
  }
});

test("a list of more than 12 rows numbers 1…10 only, and . and the space bar stay dead there", async ({ page }) => {
  await tap(page, ["math", "d7"]); // Probability and statistics: 17 rows
  await expect(title(page)).toContainText("Probability");
  const n = await numbers(page);
  expect(n.slice(0, 10)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"]);
  expect(n.filter((x) => x === "." || x === "␣")).toEqual([]);
  await expect(page.locator('[data-key="dot"]')).toHaveAttribute("data-dead", "true");
  await expect(page.locator('[data-key="space"]')).toHaveAttribute("data-dead", "true");
  const before = await title(page).textContent();
  await tap(page, ["dot", "space"]);
  await expect(title(page)).toHaveText(before as string);
});

test("a menu of fewer rows keeps . and the space bar dead; its rows keep their digits", async ({ page }) => {
  await tap(page, ["@mode"]);
  await expect(page.locator('[data-key="dot"]')).toHaveAttribute("data-dead", "true");
  await expect(page.locator('[data-key="space"]')).toHaveAttribute("data-dead", "true");
  expect((await numbers(page)).every((x) => /^[0-9]$/.test(x))).toBe(true);
});

test("with the keys live in Find, a row 11 and 12 key is live while the query is empty", async ({ page }) => {
  await tap(page, ["math"]);
  await expect(page.locator('[data-key="dot"]')).not.toHaveAttribute("data-dead", "true");
  await expect(page.locator('[data-key="space"]')).not.toHaveAttribute("data-dead", "true");
});
