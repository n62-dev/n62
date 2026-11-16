// SPDX-License-Identifier: GPL-3.0-or-later
// G390 (sofia's review of the formula-units plan, finding 11): a store on the unit view's line is refused with a
// message, no row is written, and Home's name stays unassigned (before, x held 3*pasdimL, our dimension symbol).
// `x:=3` and `3 ▶ x` are the same Assign (parse.ts). The real engine.
import { expect, test, type Page } from "@playwright/test";
import { flick, lastResult, open, tap } from "./helpers.ts";

const up = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element && document.querySelector('[data-pad="unit"]') !== null);
const MESSAGE = "The unit view does not store: put the result on Home's line, then ▶";

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
});

/** The line `latex`, the units key, m, Eval: the message, no result, no row; then Home's x is still x. */
async function refused(page: Page, before: string, after: string): Promise<void> {
  // the line up to the 3 is set, the 3 is typed (the caret is then at the end), then what follows it
  await page.evaluate((l) => window.n62.entry.set(l), before);
  await tap(page, ["d3"]);
  if (after) await page.evaluate((l) => window.n62.entry.set(l), after);
  await flick(page, "tmpl", "up");
  await up(page);
  await tap(page, ["d9"]);
  await flick(page, "enter", "up");
  await expect(page.getByTestId("unit-message")).toHaveText(MESSAGE);
  await expect(page.getByTestId("unit-result")).toHaveCount(0);
  await tap(page, ["esc"]);
  await page.waitForFunction(() => window.n62.unitView === undefined);
  await page.evaluate(() => window.n62.entry.clear());
  await tap(page, ["x", "enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "x");
}

test("x:=3, the units key, m, Eval: the store is refused and Home's x shows x", async ({ page }) => {
  await refused(page, "x:=", "");
});

test("3 ▶ x: the same", async ({ page }) => {
  await refused(page, "", "3\\blacktriangleright x");
});

test("control: 3 with m and no store still shows = 3 m", async ({ page }) => {
  await tap(page, ["d3"]);
  await flick(page, "tmpl", "up");
  await up(page);
  await tap(page, ["d9"]);
  await flick(page, "enter", "up");
  await expect(page.getByTestId("unit-result").locator(".value")).toHaveText("3");
  await expect(page.getByTestId("unit-unit")).toHaveText("m");
});
