// SPDX-License-Identifier: GPL-3.0-or-later
// R830 (owner, 2026-11-20): ☰ in Home and CAS holds four rows, 1 Delete, 2 Share session, 3 Clear history, 4 Export ›; 5 to 0 are
// blank (a digit there runs nothing and the sheet stays). Store ▶ and Copy › are the picked row's bar, Paste is Shift + Deselect.
// The fake engine echoes its input, so each row's result is its input.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, lastResult, open, sheet, sheetKey, tap } from "./helpers.ts";

const rows = (page: Page) => page.locator("article.item");
const texts = (page: Page): Promise<(string | null)[]> =>
  page.locator('[data-testid="result"] .result').evaluateAll((els) => els.map((e) => e.getAttribute("data-text")));
const bar = (page: Page) => page.getByTestId("row-actions");
const done = (page: Page, n: number) => expect(page.locator('[data-status="done"]')).toHaveCount(n);
const items = (page: Page) => sheet(page).getByRole("menuitem");

/** Rows 1, 2, 3, each finished before the next Enter. */
async function three(page: Page): Promise<void> {
  for (const [k, d] of ["d1", "d2", "d3"].entries()) {
    await tap(page, [d, "enter"]);
    await done(page, k + 1);
  }
}

for (const size of [{ width: 412, height: 915 }, { width: 360, height: 740 }]) {
  for (const view of ["@home", "@cas"]) {
    test.describe(`${view} at ${size.width} px`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize(size);
        await open(page);
        await tap(page, [view]);
      });

      test("☰ lists Delete, Share session, Clear history, Export › and nothing else", async ({ page }) => {
        await tap(page, ["d1", "enter"]);
        await done(page, 1);
        await tap(page, ["@menu"]);
        await expect(items(page)).toHaveText(["1Delete", "2Share session", "3Clear history", "4Export›"]);
      });

      test("5 picks nothing and the sheet stays; 1 deletes the last row and Undo brings it back", async ({ page }) => {
        await three(page);
        await tap(page, ["@menu", "d5"]);
        await expect(sheet(page)).toBeVisible();
        await expect(items(page)).toHaveCount(4);
        await tap(page, ["d9", "d0"]);
        await expect(sheet(page)).toBeVisible();
        expect(await entryValue(page)).toBe("");
        await done(page, 3);
        await tap(page, ["d1"]);
        await done(page, 2);
        expect(await texts(page)).toEqual(["1", "2"]);
        await tap(page, ["undo"]);
        expect(await texts(page)).toEqual(["1", "2", "3"]);
      });

      test("with a pick, 1 deletes the picked row", async ({ page }) => {
        await three(page);
        await tap(page, ["up", "up", "@menu", "d1"]);
        await done(page, 2);
        expect(await texts(page)).toEqual(["1", "3"]);
      });

      test("the keys folded: the same four rows, 5 blank, 1 deletes the picked row", async ({ page }) => {
        await three(page);
        await page.getByTestId("fold-chevron").tap();
        await expect(page.getByTestId("keys")).toHaveAttribute("data-folded", "true");
        await lastResult(page).tap(); // a first tap picks the row
        await page.getByTestId("menu-button").tap();
        await expect(items(page)).toHaveText(["1Delete", "2Share session", "3Clear history", "4Export›"]);
        await sheetKey(page, ["d5"]);
        await expect(sheet(page)).toBeVisible();
        await done(page, 3);
        await sheetKey(page, ["d1"]);
        await done(page, 2);
        expect(await texts(page)).toEqual(["1", "2"]);
      });

      test("the picked row's bar shows Store ▶ and Copy ›; Copy › opens five rows", async ({ page }) => {
        await tap(page, ["d1", "enter"]);
        await done(page, 1);
        await tap(page, ["up"]);
        await expect(bar(page).getByRole("button")).toHaveText(["Store ▶", "Copy ›"]);
        await bar(page).getByRole("button", { name: /Copy/ }).tap();
        await expect(items(page)).toHaveText(["1Full value", "2As shown", "3Exact", "4LaTeX", "5Python"]);
      });
    });
  }
}
