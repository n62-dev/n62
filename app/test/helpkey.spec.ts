// SPDX-License-Identifier: GPL-3.0-or-later
// R197: the Help key (row 0, col 4 since R723; docs/06 section 1): the syntax and example of the function at the cursor (R196's
// functionAt, G231's examples in the Find index), on a sheet; the example's Insert row replaces the call (R324). No function
// at the cursor: Find opens, as Math does. Each press is counted under its layer (R127: help:primary), for
// the removal test (docs/03 rule 11). The fake engine; the full generated index (`npm run index`). Expected values are
// the index's (find/functions.yaml, checked on the engine by examples.test.ts).
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

const help = (page: Page) => page.getByTestId("menu");
const row = (page: Page, id: string) => help(page).locator(`[role="menuitem"][data-id="${id}"]`);
const keys = (page: Page): Promise<Record<string, number>> => page.evaluate(() => ({ ...window.n62.session.taps.counts.keys }));

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await open(page);
});

/** The help sheet of sin: its syntax, its example drawn as LaTeX, the mark and the result. */
async function sineHelp(page: Page): Promise<void> {
  await expect(page.getByTestId("sheet-title")).toHaveText("Help: Sine");
  await expect(row(page, "syntax")).toHaveAttribute("aria-label", "1 sin(x)");
  await expect(row(page, "syntax")).toContainText("Sine, in the angle unit of the settings.");
  await expect(row(page, "example").locator('[role="math"]')).toHaveAttribute("data-latex", "\\sin\\left(30\\degree\\right)");
  await expect(row(page, "example").getByTestId("row-hint")).toHaveText("= 0.5");
  await expect(row(page, "insert")).toHaveAttribute("aria-label", "3 Insert the example");
}

test("\\sin( with the cursor inside: Help shows sin's syntax and example; the line stays", async ({ page }) => {
  await tap(page, ["sin", "d1"]);
  const before = await entryValue(page);
  const base = await keys(page);
  await tap(page, ["help"]);
  await sineHelp(page);
  expect(await entryValue(page)).toBe(before);
  expect((await keys(page))["help:primary"]).toBe((base["help:primary"] ?? 0) + 1);
  // Esc closes it, the line and its cursor as they were
  await tap(page, ["esc", "d2"]);
  await expect(help(page)).toBeHidden();
  expect(await entryValue(page)).toBe("\\sin\\left(12\\right)");
});

test("the innermost function wins: cos inside sin", async ({ page }) => {
  await tap(page, ["sin", "d2", "mul", "cos"]);
  await tap(page, ["help"]);
  await expect(page.getByTestId("sheet-title")).toHaveText("Help: Cosine");
  await expect(row(page, "example").getByTestId("row-hint")).toHaveText("= -1");
});

/** The cursor stands at the end of the line. */
const atEnd = (page: Page): Promise<boolean> => page.evaluate(() => {
  const mf = window.n62.entry.field;
  return !!mf && mf.selectionIsCollapsed && mf.position === mf.lastOffset;
});

// R324 (owner, 2026-11-15): Insert replaces the call Help named (the innermost one that holds the cursor), with its
// name, its bracket and what was typed in it; the line's own Undo brings the call back
test("the example's Insert row replaces the call at the cursor and closes the sheet", async ({ page }) => {
  await tap(page, ["sin"]);
  await tap(page, ["help"]);
  await row(page, "insert").tap();
  await expect(help(page)).toBeHidden();
  expect(await entryValue(page)).toBe("\\sin\\left(30\\degree\\right)");
  expect(await atEnd(page)).toBe(true);
});

test("by keys: 3 picks the Insert row; 1 and 2 only inform, the sheet stays", async ({ page }) => {
  await tap(page, ["sin"]);
  await tap(page, ["help"]);
  await sineHelp(page);
  await tap(page, ["d1", "d2"]);
  await sineHelp(page);
  await tap(page, ["d3"]);
  await expect(help(page)).toBeHidden();
  expect(await entryValue(page)).toBe("\\sin\\left(30\\degree\\right)");
  expect(await atEnd(page)).toBe(true);
});

test("Insert in a call inside another replaces only the inner one", async ({ page }) => {
  await tap(page, ["cos", "sin"]);
  await tap(page, ["help"]);
  await sineHelp(page);
  await row(page, "insert").tap();
  await expect(help(page)).toBeHidden();
  expect(await entryValue(page)).toBe("\\cos\\left(\\sin\\left(30\\degree\\right)\\right)");
});

test("Insert replaces what was typed in the call too; one Undo brings the call back", async ({ page }) => {
  await tap(page, ["d2", "add", "sin", "d4", "d5", "left"]);
  expect(await entryValue(page)).toBe("2+\\sin\\left(45\\right)");
  await tap(page, ["help"]);
  await sineHelp(page);
  await row(page, "insert").tap();
  await expect(help(page)).toBeHidden();
  expect(await entryValue(page)).toBe("2+\\sin\\left(30\\degree\\right)");
  await tap(page, ["undo"]);
  expect(await entryValue(page)).toBe("2+\\sin\\left(45\\right)");
});

test("an inverse function's example says the angle unit of its result: (radians)", async ({ page }) => {
  await tap(page, ["shift", "sin"]);
  await tap(page, ["help"]);
  await expect(page.getByTestId("sheet-title")).toHaveText("Help: Arcsine (sin⁻¹)");
  await expect(row(page, "example").getByTestId("row-hint")).toHaveText("≈ 0.523598775598 (radians)");
});

// R197 fix: a line with \sin^{-1} (a paste, a recalled row, ^ typed after \sin) computes asin (parse.ts func, INVERSE),
// so Help names Arcsine, not Sine
test("\\sin^{-1}( with the cursor inside: Help shows Arcsine, as the parser reads it", async ({ page }) => {
  const line = "\\sin^{-1}\\left(0.5\\right)";
  await page.evaluate((l) => window.n62.entry.set(l), line);
  await tap(page, ["left"]);
  await tap(page, ["help"]);
  await expect(page.getByTestId("sheet-title")).toHaveText("Help: Arcsine (sin⁻¹)");
  expect(await entryValue(page)).toBe(line);
});

test("no function at the cursor: Help opens Find, on an empty line and outside a call", async ({ page }) => {
  await tap(page, ["help"]);
  await expect(page.getByTestId("find")).toBeVisible();
  await expect(page.getByTestId("sheet-title")).toHaveText("Find");
  await tap(page, ["esc", "sin", "d1", "right", "add", "d2"]);
  expect(await entryValue(page)).toBe("\\sin\\left(1\\right)+2");
  await tap(page, ["help"]);
  await expect(page.getByTestId("find")).toBeVisible();
  expect(await entryValue(page)).toBe("\\sin\\left(1\\right)+2");
});

test("Select's tap is still Select; Shift + Select is Copy now (R723), live and undimmed; Help is its own key", async ({ page }) => {
  await tap(page, ["d3", "mul", "d4", "select"]);
  expect(await page.evaluate(() => window.n62.entry.field?.getValue(window.n62.entry.field.selection, "latex"))).toBe("4");
  await tap(page, ["shift"]);
  await expect(page.locator('[data-key="select"]')).not.toHaveAttribute("data-dead", "true");
  await expect(page.locator('[data-key="select"] .main')).toHaveText("Copy");
  await expect(page.locator('[data-key="help"] .main')).toHaveText("Settings");
});
