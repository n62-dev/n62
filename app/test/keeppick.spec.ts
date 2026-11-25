// SPDX-License-Identifier: GPL-3.0-or-later
// R901: a look at Settings (the ⚙ key) or at Mode (the format chip) keeps the picked history row, so Fmt and Copy still act
// on it after Esc; the Home ↔ CAS switch (another history) drops it. The fake engine, 412 × 839.
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

test.use({ viewport: { width: 412, height: 839 } });

const rows = (p: Page) => p.locator("article.item");
const picked = (p: Page) => p.locator('article.item[data-selected="true"]');
const title = (p: Page) => p.getByTestId("sheet-title");

/** Two rows, then ▲▲: the first (older) row picked. */
async function pickFirst(page: Page): Promise<void> {
  await open(page);
  await tap(page, ["d2", "enter"]);
  await tap(page, ["d3", "enter"]);
  await expect(rows(page)).toHaveCount(2);
  await tap(page, ["up", "up"]);
  await expect(picked(page)).toHaveCount(1);
  await expect(rows(page).nth(0)).toHaveAttribute("data-selected", "true");
}

test("R901: ▲▲, ⚙, Esc: the first row is still picked, its buttons up", async ({ page }) => {
  await pickFirst(page);
  await tap(page, ["help"]); // the ⚙ key: the Settings root (R927)
  await expect(title(page)).toHaveText("Settings");
  await tap(page, ["esc"]);
  await expect(title(page)).toHaveCount(0);
  await expect(picked(page)).toHaveCount(1);
  await expect(rows(page).nth(0)).toHaveAttribute("data-selected", "true");
  await expect(page.getByTestId("row-actions")).toBeVisible();
});

test("R901: ▲▲, the Mode chip, Esc Esc: the first row is still picked", async ({ page }) => {
  await pickFirst(page);
  await tap(page, ["@mode"]);
  await expect(title(page)).toHaveText("Settings › Mode");
  await tap(page, ["esc", "esc"]); // (R927: up to Settings, then closed)
  await expect(title(page)).toHaveCount(0);
  await expect(picked(page)).toHaveCount(1);
  await expect(rows(page).nth(0)).toHaveAttribute("data-selected", "true");
  await tap(page, ["esc"]); // a second Esc drops the pick as before
  await expect(picked(page)).toHaveCount(0);
});

test("R901 control: the Home ↔ CAS switch drops the pick (another history)", async ({ page }) => {
  await pickFirst(page);
  await tap(page, ["@cas"]);
  await expect(picked(page)).toHaveCount(0);
  await tap(page, ["@home"]);
  await expect(rows(page)).toHaveCount(2);
  await expect(picked(page)).toHaveCount(0);
});
