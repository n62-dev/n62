// SPDX-License-Identifier: GPL-3.0-or-later
// R883: a σ typed with ± mutes the digits past it as a constant's σ does (R40, docs/05 3.4 Numbers › Uncertainty): the
// unit view's second line and the Home row it files draw the digits from σ's first digit's place on in the muted span,
// and so do a name stored from such a row and the row's chip read back. The real engine. Expected values: derived
// (constUnc.ts uncDigitsOf: the digits before σ's first digit's place hold; R40's cut, render/uncMute.ts uncCut):
// 4π²(1 ± 0.002)/(2.006 ± 0.005)² = 9.81065219207 with σ ≈ 0.0527 (its first digit at 10⁻²), so 9.8 holds;
// 9.81 ± 0.02: 9.8 holds, the 1 at σ's place is muted; 2.5 ± 0.1: 2 holds, the 5 at σ's place is muted; 2.5 ± 0.01:
// every digit is above σ's place, nothing is muted.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { flick, lastResult, open, tap } from "./helpers.ts";

const up = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element && document.querySelector('[data-pad="unit"]') !== null);
const unitsKey = async (page: Page): Promise<void> => {
  await flick(page, "tmpl", "up");
  await up(page);
};
const done = (page: Page) => page.locator('[data-status="done"]');
const view = (page: Page) => page.getByTestId("unit-view");
const sub = (page: Page) => page.getByTestId("unit-sub");
const rowMuted = (page: Page) => lastResult(page).locator(".unc");
const digitsOf = (s: string | null): string => (s ?? "").replace(/[^0-9]/g, "");
/** `l` holds one muted span whose digits are `digits`. */
async function mutedIs(l: Locator, digits: string): Promise<void> {
  await expect(l).toHaveCount(1);
  expect(digitsOf(await l.textContent())).toBe(digits);
}
const store = (page: Page) => page.getByTestId("store");
/** The unit view's second line shows its muted span: its colour differs from the plain digits before it (its parent's). */
async function mutedShows(page: Page): Promise<void> {
  const [plain, muted] = await sub(page).locator(".unc").evaluate((u) => [getComputedStyle(u.parentElement!).color, getComputedStyle(u).color]);
  expect(muted).not.toBe(plain);
}

/** The value on Home's line (typed digits and ± are Shift + ,), the units key, `unit` in its slot, Eval. */
async function inUnits(page: Page, value: string[], unit: string[]): Promise<void> {
  await tap(page, value);
  await unitsKey(page);
  await tap(page, unit);
  await flick(page, "enter", "up");
  await expect(page.getByTestId("unit-result")).toBeVisible();
}

/** Esc leaves the view; the unit row is Home's last row; a second Esc clears the line, which keeps the view's text. */
async function leave(page: Page, rows: number): Promise<void> {
  await tap(page, ["esc"]);
  await expect(view(page)).toHaveCount(0);
  await expect(done(page)).toHaveCount(rows);
  await tap(page, ["esc"]);
  await expect.poll(() => page.evaluate(() => window.n62.entry.value)).toBe("");
}

const M_S2 = ["d9", "div", "d3", "sq"]; // m ÷ s²
const NINE81 = ["d9", "dot", "d8", "d1", "shift", "comma", "d0", "dot", "d0", "d2"]; // 9.81 ± 0.02

test.describe("a typed ± mutes the digits past σ (R883)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await open(page, "");
    await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
  });

  test("4π²(1 ± 0.002)/(2.006 ± 0.005)² in m/s²: 9.8 plain, the rest muted in the view's second line and in the Home row", async ({ page }) => {
    await page.evaluate(() => window.n62.entry.insert("\\frac{4\\pi^2(1\\pm0.002)}{(2.006\\pm0.005)^2}"));
    await unitsKey(page);
    await tap(page, M_S2);
    await flick(page, "enter", "up");
    await expect(page.getByTestId("unit-result").locator(".value")).toHaveText("9.811 ± 0.053");
    await mutedIs(sub(page).locator(".unc"), "1065219207");
    await mutedShows(page);
    expect(digitsOf(await sub(page).textContent())).toMatch(/^981065219207/);
    await leave(page, 1);
    await expect(lastResult(page)).toHaveAttribute("data-text", /^9\.81065219207/);
    await mutedIs(rowMuted(page), "1065219207");
    expect(await page.evaluate(() => window.n62.session.home.at(-1)?.facts?.uncDigits)).toBe(2);
  });

  test("9.81 ± 0.02 m/s²: 9.8 plain, 1 muted; the same with Muted digits (no σ on tap)", async ({ page }) => {
    await inUnits(page, NINE81, M_S2);
    await mutedIs(sub(page).locator(".unc"), "1");
    await mutedShows(page);
    await leave(page, 1);
    await mutedIs(rowMuted(page), "1");
    await page.evaluate(() => (window.n62.session.settings.uncertainty = "muted"));
    await inUnits(page, NINE81, M_S2);
    await mutedIs(sub(page).locator(".unc"), "1");
    await leave(page, 2);
    await mutedIs(rowMuted(page), "1");
  });

  test("2.5 ± 0.1 m mutes the 5 at σ's place; 2.5 ± 0.01 m and 5 m mute nothing", async ({ page }) => {
    await inUnits(page, ["d2", "dot", "d5", "shift", "comma", "d0", "dot", "d1"], ["d9"]);
    await leave(page, 1);
    await mutedIs(rowMuted(page), "5");
    await inUnits(page, ["d2", "dot", "d5", "shift", "comma", "d0", "dot", "d0", "d1"], ["d9"]);
    await expect(sub(page).locator(".unc")).toHaveCount(0);
    await leave(page, 2);
    await expect(lastResult(page)).toHaveAttribute("data-text", "2.5 ± 0.010 m");
    await expect(rowMuted(page)).toHaveCount(0);
    await inUnits(page, ["d5"], ["d9"]);
    await leave(page, 3);
    await expect(rowMuted(page)).toHaveCount(0);
  });

  test("a name stored from the row and the row's chip read back keep the muted 1; the chip on the line keeps every digit", async ({ page }) => {
    await inUnits(page, NINE81, M_S2);
    await leave(page, 1);
    // the row's chip: a tap picks the result, a second inserts it; Enter reads it back
    const row = lastResult(page);
    await row.tap();
    await row.tap();
    await expect.poll(() => page.evaluate(() => window.n62.entry.value)).toMatch(/^\\res\{/);
    await expect(page.locator("math-field").locator(".unc")).toHaveCount(0);
    await tap(page, ["enter"]);
    await expect(done(page)).toHaveCount(2);
    await mutedIs(rowMuted(page), "1");
    // Store ▶ G from the unit row, then G read back
    await inUnits(page, NINE81, M_S2);
    await tap(page, ["shift", "emark"]);
    await store(page).locator('[data-id="name:G"]').tap();
    await expect(store(page)).toBeHidden();
    await expect(done(page)).toHaveCount(4); // the unit row, then the store row
    await tap(page, ["alpha", "sin", "enter"]); // G
    await expect(done(page)).toHaveCount(5);
    await expect(lastResult(page)).toHaveAttribute("data-text", "9.81");
    await mutedIs(rowMuted(page), "1");
  });
});
