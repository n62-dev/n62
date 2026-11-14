// SPDX-License-Identifier: GPL-3.0-or-later
// R184: the labelled result sheet of linreg and stats1. A row's first tap picks it and opens nothing; the second tap on
// its result opens a sheet that asks which value to insert (☰ 1 Insert too), a pick puts that value on the line as a
// chip; the second tap on its input recalls it; a hold copies the whole result and a swipe deletes the row, as for
// every row (R276); a row of any other call inserts its result on the second tap. Values are derived: the data of golden
// g223-linreg (x 1..4, y 2.1 3.9 6.2 7.8: slope 97/50, intercept 3/20) and 2+3 = 5.
import { expect, test, type Page } from "@playwright/test";
import { finger, STILL_MS } from "./core-lib.ts";
import { entryValue, open, setClipboard, sheetKey, tap, useClipboardLock } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
test.describe.configure({ mode: "serial" });

useClipboardLock();

const LINREG = "\\operatorname{linreg}\\left(\\left\\{1,2,3,4\\right\\},\\left\\{2.1,3.9,6.2,7.8\\right\\}\\right)";
const clipboard = (page: Page): Promise<string> => page.evaluate(() => navigator.clipboard.readText());
const rows = (page: Page) => page.locator("article.item[data-status]");
const results = (page: Page) => rows(page).locator(".result");
const inputs = (page: Page) => rows(page).locator(".in");
const menu = (page: Page) => page.getByTestId("menu");

async function ready(page: Page): Promise<void> {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
}
/** The regression typed as one line and entered; its row finished. */
async function regress(page: Page): Promise<void> {
  await page.evaluate((l) => window.n62.entry.set(l), LINREG);
  await tap(page, ["enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1, { timeout: 30_000 });
}

test("the first tap picks the row and opens nothing; the second tap on the result opens the sheet; Slope goes in as a chip", async ({ page }) => {
  await ready(page);
  await regress(page);
  await results(page).last().tap();
  await expect(rows(page).last()).toHaveAttribute("data-selected", "true");
  await expect(menu(page)).toHaveCount(0);
  expect(await entryValue(page)).toBe("");
  await results(page).last().tap();
  await expect(menu(page)).toBeVisible();
  await expect(menu(page)).toContainText("Linear regression");
  for (const [id, label, value] of [["stat.slope", "Slope", "1.94"], ["stat.intercept", "Intercept", "0.15"], ["stat.r2", "r²", "0.99"]]) {
    await expect(menu(page).locator(`[data-id="${id}"] .label`)).toHaveText(label as string);
    await expect(menu(page).locator(`[data-id="${id}"] .value`)).toContainText(value as string);
  }
  expect(await entryValue(page)).toBe(""); // nothing is inserted until a pick
  await sheetKey(page, ["d1"]);
  await expect(menu(page)).toHaveCount(0);
  expect(await entryValue(page)).toMatch(/^\\res\{\d+\}\{1\.94\}$/);
});

test("☰ 1 Insert on the picked row opens the same sheet", async ({ page }) => {
  await ready(page);
  await regress(page);
  await inputs(page).last().tap(); // picks
  await tap(page, ["menu", "d1"]);
  await expect(menu(page)).toContainText("Slope");
  await sheetKey(page, ["d2"]);
  expect(await entryValue(page)).toMatch(/^\\res\{\d+\}\{0\.15\}$/);
});

test("a second tap on the input recalls it; a hold copies the whole result; a swipe deletes the row", async ({ page }) => {
  await ready(page);
  await regress(page);
  await inputs(page).last().tap();
  await inputs(page).last().tap();
  expect(await entryValue(page)).toBe(LINREG);
  await expect(menu(page)).toHaveCount(0);
  await page.evaluate(() => window.n62.entry.clear());
  await setClipboard(page, "before");
  await finger(page, "result:last", { ms: 700 });
  await expect(page.getByTestId("notice")).toHaveText("Copied");
  await expect.poll(() => clipboard(page)).toBe("{97/50,3/20,9409/9450}"); // the whole result, exact (Copy, docs/04 2.6)
  await expect(menu(page)).toHaveCount(0);
  const width = (await rows(page).last().boundingBox())?.width ?? 0;
  await finger(page, "row:last", { dx: 0.6 * width, steps: 12, still: STILL_MS });
  await expect(rows(page)).toHaveCount(0);
  await expect(page.getByTestId("undo-note")).toHaveText(/Row deleted/);
});

test("a row of any other call inserts its result on the second tap, with no sheet", async ({ page }) => {
  await ready(page);
  await tap(page, ["d2", "add", "d3", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await results(page).last().tap();
  await results(page).last().tap();
  expect(await entryValue(page)).toMatch(/^\\res\{\d+\}\{5\}$/);
  await expect(menu(page)).toHaveCount(0);
});

test("the sheet's chunk will not load: the second tap inserts the whole result", async ({ page }) => {
  await ready(page);
  await regress(page);
  await page.route(/statSheet/, (r) => r.abort()); // offline after an update, a stale hash
  await results(page).last().tap();
  await results(page).last().tap();
  await expect.poll(() => entryValue(page)).toMatch(/^\\res\{\d+\}\{/);
  expect(await entryValue(page)).not.toMatch(/^\\res\{\d+\}\{1\.94\}$/); // the whole list, not one value
  await expect(menu(page)).toHaveCount(0);
});
