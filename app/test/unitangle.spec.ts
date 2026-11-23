// SPDX-License-Identifier: GPL-3.0-or-later
// R915 (layers study 2026-11-23: F368, F377, F376): the unit view follows the angle and the digits however they change (the
// bar's angle word too, not only a sheet's close, R838); the view's Home row carries the angle tag as a plain row does (R265),
// after the view closes and after a reload; Store ▶ after the view's row was swiped away says the row is gone.
// Expected values: oracle (mpmath) sin(30 rad) = −0.988031624092862, at 12 digits −0.988031624093; derived sin(30°) = 1/2.
import { expect, test, type Page } from "@playwright/test";
import { finger, STILL_MS } from "./core-lib.ts";
import { flick, open, tap } from "./helpers.ts";

const up = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element && document.querySelector('[data-pad="unit"]') !== null);
const unitsKey = async (page: Page): Promise<void> => {
  await flick(page, "tmpl", "up");
  await up(page);
};
const rows = (page: Page) => page.locator("article.item[data-status]");
const plain = (s: string | null): string => (s ?? "").replace(/\s/g, "").replace("−", "-");
/** The view's result: its mark and its value, as one text ("≈-0.988031624093"). */
const shown = async (page: Page): Promise<string> => {
  const r = page.getByTestId("unit-result");
  if ((await r.count()) === 0) return "";
  return plain(await r.getByTestId("unit-mark").textContent()) + plain(await r.locator(".value").textContent());
};
/** The view's Home row (the last row): its result text. */
const homeRow = (page: Page): Promise<string> => page.evaluate(() => window.n62.session.home.at(-1)?.text ?? "").then(plain);
const RAD = "≈-0.988031624093";
const DEG = "=0.5";
const angleWord = (page: Page) => page.getByTestId("chip-angle");

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
  await page.evaluate(() => window.n62.session.setAngle("rad"));
});

/** sin 30 on the line, the unit view on it, Enter: the result shown in RAD. */
async function sin30(page: Page): Promise<void> {
  await tap(page, ["sin", "d3", "d0"]);
  await unitsKey(page);
  await tap(page, ["enter"]);
  await expect.poll(() => shown(page)).toBe(RAD);
}

test("the bar's angle word over a shown result recomputes it, both ways: the view and its Home row (F368)", async ({ page }) => {
  await sin30(page);
  expect(await homeRow(page)).toBe("-0.988031624093");
  const count = await page.evaluate(() => window.n62.session.home.length);
  await angleWord(page).click();
  await expect(angleWord(page)).toHaveAttribute("data-angle", "deg");
  await expect.poll(() => shown(page)).toBe(DEG);
  await expect.poll(() => homeRow(page)).toBe("0.5");
  await angleWord(page).click();
  await expect(angleWord(page)).toHaveAttribute("data-angle", "rad");
  await expect.poll(() => shown(page)).toBe(RAD);
  await expect.poll(() => homeRow(page)).toBe("-0.988031624093");
  expect(await page.evaluate(() => window.n62.session.home.length)).toBe(count); // one row per visit (R63)
  expect(await page.evaluate(() => window.n62.unitView !== undefined)).toBe(true);
});

test("the digits changed with no sheet (session.setDigits) recompute the shown result too", async ({ page }) => {
  await sin30(page);
  await page.evaluate(() => window.n62.session.setDigits(6));
  await expect.poll(() => shown(page)).toBe("≈-0.988032");
  await expect.poll(() => homeRow(page)).toBe("-0.988032");
});

test("the view's row of sin(30) in RAD carries the RAD tag in DEG, as a plain row does; after a reload too (F377)", async ({ page }) => {
  await tap(page, ["sin", "d3", "d0", "enter"]); // the plain row, the control
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await sin30(page);
  await tap(page, ["esc"]);
  await page.waitForFunction(() => window.n62.unitView === undefined);
  await expect(rows(page)).toHaveCount(2);
  await page.evaluate(() => window.n62.session.setAngle("deg"));
  const tag = (i: number) => rows(page).nth(i).getByTestId("row-angle");
  await expect(tag(0)).toHaveText("RAD");
  await expect(tag(1)).toHaveText("RAD");
  await page.waitForTimeout(800); // the store write is debounced (as solve.spec's reload)
  await page.reload();
  await page.waitForFunction(() => window.n62?.session?.engineState === "ready", undefined, { timeout: 20_000 });
  await expect(rows(page)).toHaveCount(2);
  await expect(tag(0)).toHaveText("RAD");
  await expect(tag(1)).toHaveText("RAD");
  await page.evaluate(() => window.n62.session.setAngle("rad"));
  await expect(tag(1)).toHaveCount(0); // its own mode: no tag
});

test("the view's row swiped away, Store ▶ says the row is gone, not Eval first (F376)", async ({ page }) => {
  await sin30(page);
  await expect(rows(page)).toHaveCount(1);
  const width = (await rows(page).last().boundingBox())?.width ?? 0;
  await finger(page, "row:last", { dx: -0.6 * width, steps: 12, still: STILL_MS });
  await expect(rows(page)).toHaveCount(0);
  await expect(page.getByTestId("unit-result")).toHaveCount(1); // the result stays shown
  await tap(page, ["shift", "emark"]);
  const note = page.getByTestId("unit-store-note");
  await expect(note).toBeVisible();
  await expect(note).not.toHaveText("Eval first, then Store ▶");
  await expect(note).toHaveText(/row .*gone/i);
  expect(await page.evaluate(() => window.n62.unitView !== undefined)).toBe(true); // nothing stored, the view stays
});
