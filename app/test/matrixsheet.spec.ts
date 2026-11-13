// SPDX-License-Identifier: GPL-3.0-or-later
// R187 (docs/04 5.3): Shift + 4 opens the matrix sheet: the eight functions as rows 1 to 8 (Transpose, Dot, Cross, Norm,
// Reduced row echelon, Eigenvalues, Determinant, Inverse). A pick goes in by Find's route: the function with the cursor
// inside. The fake engine; the full generated index (`npm run index`).
import { expect, test } from "@playwright/test";
import { entryValue, open, sheet, sheetKey, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await open(page);
});

const TITLES = ["Transpose", "Dot", "Cross", "Norm", "Reduced row echelon", "Eigenvalues", "Determinant", "Inverse"];

test("Shift + 4 lists the eight functions as rows 1 to 8", async ({ page }) => {
  await tap(page, ["shift", "d4"]);
  await expect(page.getByTestId("sheet-title")).toHaveText("Matrix");
  const rows = sheet(page).getByRole("menuitem");
  await expect(rows).toHaveCount(8);
  for (const [i, title] of TITLES.entries()) await expect(rows.nth(i)).toHaveAttribute("aria-label", new RegExp(`^${i + 1} ${title}`));
});

test("picking Transpose inserts tran( with the cursor inside", async ({ page }) => {
  await tap(page, ["shift", "d4"]);
  await sheet(page).locator('[data-id="fn:tran"]').tap();
  await expect(sheet(page)).toBeHidden();
  await tap(page, ["d2"]);
  expect(await entryValue(page)).toMatch(/^\\operatorname\{(\\mathrm\{)?tran\}?\}\\left\(2\\right\)$/);
});

test("the digit 8 picks Inverse", async ({ page }) => {
  await tap(page, ["shift", "d4"]);
  await sheetKey(page, ["d8"]);
  await expect(sheet(page)).toBeHidden();
  expect(await entryValue(page)).toMatch(/^\\operatorname\{(\\mathrm\{)?inv\}?\}/);
});
