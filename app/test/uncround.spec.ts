// SPDX-License-Identifier: GPL-3.0-or-later
// R884: Settings › Numbers › Uncertainty "Rounded to σ, σ on tap" (owner, 2026-11-23): every value with a σ is drawn
// rounded to σ's last digit, σ at 2 significant digits, no digit muted; a tap still shows the σ line. Copy, a chip and the
// entry line keep every digit; only Copy as shown takes what is drawn. The real engine. Expected values: derived from the
// unit view headline's rule (render/sigmaForm.ts sigmaDrawn, atSigma): the pendulum 4π²(1 ± 0.002)/(2.006 ± 0.005)² =
// 9.81065219207 with σ ≈ 0.0527 → 9.811 ± 0.053 (R883's probe); G·5.972ᴇ24 = 3.98589196ᴇ14 with σ = 8.958ᴇ9 → σ 9.0ᴇ9,
// its last digit at 10⁸ → 3.985892ᴇ14; 9.81 ± 0.02 stored in G → σ 0.020, last digit at 10⁻³ → 9.810.
import { expect, test, type Page } from "@playwright/test";
import { COPY, flick, lastResult, open, tap, useClipboardLock } from "./helpers.ts";
import type * as Finder from "../src/find/finder.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
test.describe.configure({ mode: "serial" });
useClipboardLock(); // R74f1: first hook, so the lock is held before the page opens

const done = (page: Page) => page.locator('[data-status="done"]');
const ready = (page: Page) => page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
const lastMark = (page: Page) => page.getByTestId("mark").last();
const muted = (page: Page) => lastResult(page).locator(".unc");
const clipboard = (page: Page): Promise<string> => page.evaluate(() => navigator.clipboard.readText());
const up = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element && document.querySelector('[data-pad="unit"]') !== null);

/** Settings › Numbers › Uncertainty (row 4) stepped twice by its digit: Rounded to σ, σ on tap; the sheet closed. */
async function setRounded(page: Page): Promise<void> {
  await tap(page, ["help", "d3", "d4", "d4"]);
  await expect(page.getByTestId("menu").locator('[data-id="uncertainty"]').getByTestId("sheet-value")).toHaveText("Rounded to σ, σ on tap");
  await tap(page, ["esc", "esc", "esc"]);
  await expect(page.getByTestId("menu")).toHaveCount(0);
}

/** The Find index's constant `id` on the entry line, as a pick puts it (constdigits.spec.ts). */
async function putConst(page: Page, id: string): Promise<void> {
  await page.evaluate(async (cid) => {
    const url = "/src/find/finder.ts";
    const f = (await import(/* @vite-ignore */ url)) as typeof Finder;
    const it = (await f.loadIndex(true)).byId.get(`const:${cid}`);
    if (!it) throw new Error(`no constant ${cid} in the index`);
    f.putOnLine(window.n62.entry, it);
  }, id);
}

/** Esc leaves the unit view (Home's `rows`th row is the unit row), a second Esc clears the line. */
async function leave(page: Page, rows: number): Promise<void> {
  await tap(page, ["esc"]);
  await expect(page.getByTestId("unit-view")).toHaveCount(0);
  await expect(done(page)).toHaveCount(rows);
  await tap(page, ["esc"]);
  await expect.poll(() => page.evaluate(() => window.n62.entry.value)).toBe("");
}

/** The picked row's bar → Copy › As shown (the last row picked first). */
async function copyShown(page: Page): Promise<void> {
  if ((await page.getByTestId("row-actions").count()) === 0) await tap(page, ["up"]);
  await page.getByTestId("row-actions").getByRole("button", { name: /Copy/ }).tap({ timeout: 5000 });
  await expect(page.getByTestId("menu")).toBeVisible();
  await page.getByRole("menuitem", { name: /^\d As shown$/ }).click();
}

const M_S2 = ["d9", "div", "d3", "sq"]; // m ÷ s²
const NINE81 = ["d9", "dot", "d8", "d1", "shift", "comma", "d0", "dot", "d0", "d2"]; // 9.81 ± 0.02

test.describe("Rounded to σ, σ on tap (R884)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await open(page, "");
    await ready(page);
    await setRounded(page);
  });

  test("the pendulum: ≈ 9.811 ± 0.053 m/s² in the unit view's lines and the Home row; Copy as shown takes it, Copy every digit", async ({ page }) => {
    await page.evaluate(() => window.n62.entry.insert("\\frac{4\\pi^2(1\\pm0.002)}{(2.006\\pm0.005)^2}"));
    await flick(page, "tmpl", "up");
    await up(page);
    await tap(page, M_S2);
    await flick(page, "enter", "up");
    await expect(page.getByTestId("unit-result").locator(".value")).toHaveText("9.811 ± 0.053");
    await expect(page.getByTestId("unit-sub")).toContainText("9.811");
    await expect(page.getByTestId("unit-sub").locator(".unc")).toHaveCount(0);
    await leave(page, 1);
    await expect(lastMark(page)).toHaveAttribute("data-mark", "≈");
    await expect(lastResult(page)).toHaveAttribute("data-text", "9.811 ± 0.053 m/s²");
    await expect(muted(page)).toHaveCount(0);
    await copyShown(page);
    await expect.poll(() => clipboard(page)).toMatch(/^9\.811 ± 0\.053 m/);
    await tap(page, ["esc"]);
    await tap(page, COPY);
    await expect.poll(() => clipboard(page)).toMatch(/^9\.8106521920/);
  });

  test("a constant's row G × 5.972ᴇ24 is rounded the same way, a tap still shows the σ line; the setting survives a reload", async ({ page }) => {
    await putConst(page, "G");
    await tap(page, ["mul", "d5", "dot", "d9", "d7", "d2", "emark", "d2", "d4", "enter"]);
    await expect(done(page)).toHaveCount(1);
    await expect(lastResult(page)).toHaveAttribute("data-text", "3.985892E14");
    await expect(muted(page)).toHaveCount(0);
    const sigma = page.getByTestId("sigma");
    await lastMark(page).tap();
    await expect(sigma).toHaveText("σ = 9.0ᴇ9 · U = 2σ = 1.8ᴇ10 (k = 2)");
    await lastMark(page).tap();
    await expect(sigma).toHaveCount(0);
    // the chip keeps every digit: inserted and read back, the new row is rounded again from the full value
    await tap(page, COPY);
    await expect(page.getByTestId("notice")).toHaveText("Copied: 398 589 196 000 000");
    await page.waitForTimeout(800); // the store write is debounced
    await page.reload();
    await page.waitForFunction(() => window.n62 !== undefined);
    await ready(page);
    expect(await page.evaluate(() => window.n62.session.settings.uncertainty)).toBe("round");
    await expect(lastResult(page)).toHaveAttribute("data-text", "3.985892E14");
  });

  test("a name stored from a unit row reads back rounded; the chip on the line keeps every digit", async ({ page }) => {
    await tap(page, NINE81);
    await flick(page, "tmpl", "up");
    await up(page);
    await tap(page, M_S2);
    await flick(page, "enter", "up");
    await expect(page.getByTestId("unit-result")).toBeVisible();
    await tap(page, ["shift", "emark"]);
    await page.getByTestId("store").locator('[data-id="name:G"]').tap();
    await expect(page.getByTestId("store")).toBeHidden();
    await expect(done(page)).toHaveCount(2); // the unit row, then the store row
    await tap(page, ["alpha", "sin", "enter"]); // G
    await expect(done(page)).toHaveCount(3);
    await expect(lastResult(page)).toHaveAttribute("data-text", "9.810");
    await expect(muted(page)).toHaveCount(0);
    // the row's chip: a tap picks the result, a second inserts it; its value keeps every digit (no muted span, no cut)
    const row = lastResult(page);
    await row.tap();
    await row.tap();
    await expect.poll(() => page.evaluate(() => window.n62.entry.value)).toMatch(/^\\res\{/);
    await expect(page.locator("math-field").locator(".unc")).toHaveCount(0);
  });
});
