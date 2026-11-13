// SPDX-License-Identifier: GPL-3.0-or-later
// R197: the Help key, Shift + Select (r2c4, docs/06 section 1): the syntax and example of the function at the cursor (R196's
// functionAt, G231's examples in the Find index), on a sheet; the example's Insert row puts it on the line. No function
// at the cursor: Find opens, as Math does. Each press is counted under its layer (R127: select:shift, select:up), for
// the removal test (docs/03 rule 11). The fake engine; the full generated index (`npm run index`). Expected values are
// the index's (find/functions.yaml, checked on the engine by examples.test.ts).
import { expect, test, type Page } from "@playwright/test";
import { entryValue, flick, open, tap } from "./helpers.ts";

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
  await expect(row(page, "syntax")).toHaveAttribute("aria-label", "sin(x)");
  await expect(row(page, "syntax")).toContainText("Sine, in the angle unit of the settings.");
  await expect(row(page, "example").locator('[role="math"]')).toHaveAttribute("data-latex", "\\sin\\left(30\\degree\\right)");
  await expect(row(page, "example").getByTestId("sheet-value")).toHaveText("= 0.5");
  await expect(row(page, "insert")).toHaveCount(1);
}

test("\\sin( with the cursor inside: Shift + Select shows sin's syntax and example; the line stays", async ({ page }) => {
  await tap(page, ["sin", "d1"]);
  const before = await entryValue(page);
  const base = await keys(page);
  await tap(page, ["shift", "select"]);
  await sineHelp(page);
  expect(await entryValue(page)).toBe(before);
  expect((await keys(page))["select:shift"]).toBe((base["select:shift"] ?? 0) + 1);
  // Esc closes it, the line and its cursor as they were
  await tap(page, ["esc", "d2"]);
  await expect(help(page)).toBeHidden();
  expect(await entryValue(page)).toBe("\\sin\\left(12\\right)");
});

test("a flick up on Select is the same Help, counted as select:up", async ({ page }) => {
  await tap(page, ["sin"]);
  const base = await keys(page);
  await flick(page, "select", "up");
  await sineHelp(page);
  expect((await keys(page))["select:up"]).toBe((base["select:up"] ?? 0) + 1);
});

test("the innermost function wins: cos inside sin", async ({ page }) => {
  await tap(page, ["sin", "d2", "mul", "cos"]);
  await tap(page, ["shift", "select"]);
  await expect(page.getByTestId("sheet-title")).toHaveText("Help: Cosine");
  await expect(row(page, "example").getByTestId("sheet-value")).toHaveText("= -1");
});

test("the example's Insert row puts it on the line at the cursor and closes the sheet", async ({ page }) => {
  await tap(page, ["sin"]);
  await tap(page, ["shift", "select"]);
  await row(page, "insert").tap();
  await expect(help(page)).toBeHidden();
  expect(await entryValue(page)).toBe("\\sin\\left(\\sin\\left(30\\degree\\right)\\right)");
});

test("an inverse function's example says the angle unit of its result: (radians)", async ({ page }) => {
  await tap(page, ["shift", "sin"]);
  await tap(page, ["shift", "select"]);
  await expect(page.getByTestId("sheet-title")).toHaveText("Help: Arcsine (sin⁻¹)");
  await expect(row(page, "example").getByTestId("sheet-value")).toHaveText("≈ 0.523598775598 (radians)");
});

test("no function at the cursor: Help opens Find, on an empty line and outside a call", async ({ page }) => {
  await tap(page, ["shift", "select"]);
  await expect(page.getByTestId("find")).toBeVisible();
  await expect(page.getByTestId("sheet-title")).toHaveText("Find");
  await tap(page, ["esc", "sin", "d1", "right", "add", "d2"]);
  expect(await entryValue(page)).toBe("\\sin\\left(1\\right)+2");
  await tap(page, ["shift", "select"]);
  await expect(page.getByTestId("find")).toBeVisible();
  expect(await entryValue(page)).toBe("\\sin\\left(1\\right)+2");
});

test("the tap is still Select; Shift + Select is live and undimmed", async ({ page }) => {
  await tap(page, ["d3", "mul", "d4", "select"]);
  expect(await page.evaluate(() => window.n62.entry.field?.getValue(window.n62.entry.field.selection, "latex"))).toBe("4");
  await tap(page, ["shift"]);
  await expect(page.locator('[data-key="select"]')).not.toHaveAttribute("data-dead", "true");
  await expect(page.locator('[data-key="select"] .main')).toHaveText("Help");
});
