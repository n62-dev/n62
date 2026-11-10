// SPDX-License-Identifier: GPL-3.0-or-later
// R273 (owner, 2026-11-09): a typed line stays when a picked row without a result is entered or tapped a second time;
// the pick is dropped instead. With an empty line both recall the row's entry as before (R147), and on a row with a
// result Enter still inserts the result. 1ᴇ2.5 fails to parse, so its row is an error row with no result.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
});

const bar = (page: Page): Locator => page.getByTestId("row-actions");
const selected = (page: Page): Locator => page.locator('article.item[data-selected="true"]');
const inputs = (page: Page): Locator => page.locator("article.item .in");

/** One error row (1ᴇ2.5), the line empty again. */
async function errorRow(page: Page): Promise<void> {
  await tap(page, ["d1", "emark", "d2", "dot", "d5", "enter"]);
  await expect(page.locator('[data-status="error"]')).toHaveCount(1);
  await page.evaluate(() => window.n62.entry.clear());
  expect(await entryValue(page)).toBe("");
}

/** `2+3` on the line, then a tap on the error row picks it. */
async function typedThenPicked(page: Page): Promise<void> {
  await errorRow(page);
  await tap(page, ["d2", "add", "d3"]);
  expect(await entryValue(page)).toBe("2+3");
  await inputs(page).first().tap();
  await expect(selected(page)).toHaveCount(1);
  expect(await entryValue(page)).toBe("2+3");
}

test("text on the line: Enter on a picked error row leaves the line and drops the pick", async ({ page }) => {
  await typedThenPicked(page);
  await tap(page, ["enter"]);
  expect(await entryValue(page)).toBe("2+3");
  await expect(selected(page)).toHaveCount(0);
  await expect(bar(page)).toHaveCount(0);
  await expect(page.locator("article.item")).toHaveCount(1); // Enter submitted nothing
});

test("text on the line: a second tap on a picked error row leaves the line and drops the pick", async ({ page }) => {
  await typedThenPicked(page);
  await inputs(page).first().tap();
  expect(await entryValue(page)).toBe("2+3");
  await expect(selected(page)).toHaveCount(0);
  await expect(bar(page)).toHaveCount(0);
});

test("an empty line: Enter on a picked error row recalls its entry", async ({ page }) => {
  await errorRow(page);
  await page.keyboard.press("ArrowUp");
  await expect(selected(page)).toHaveCount(1);
  await tap(page, ["enter"]);
  expect(await entryValue(page)).toContain("1");
  expect(await entryValue(page)).not.toBe("");
  await expect(selected(page)).toHaveCount(0);
});

test("an empty line: a second tap on a picked error row recalls its entry", async ({ page }) => {
  await errorRow(page);
  await inputs(page).first().tap();
  await expect(selected(page)).toHaveCount(1);
  expect(await entryValue(page)).toBe("");
  await inputs(page).first().tap();
  expect(await entryValue(page)).toContain("1");
  expect(await entryValue(page)).not.toBe("");
  await expect(selected(page)).toHaveCount(0);
});

test("a row with a result: Enter inserts the result next to the typed line", async ({ page }) => {
  await tap(page, ["d7", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await tap(page, ["d2", "add", "d3"]);
  await inputs(page).first().tap();
  await expect(selected(page)).toHaveCount(1);
  await tap(page, ["enter"]);
  const v = await entryValue(page);
  expect(v).toContain("2+3");
  expect(v).toMatch(/\\res\{\d+\}\{7\}/);
  await expect(selected(page)).toHaveCount(0);
});
