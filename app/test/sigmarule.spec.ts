// SPDX-License-Identifier: GPL-3.0-or-later
// R885: a value with σ is drawn by one rule (docs/04 2.6, render/sigmaForm.ts): σ at 2 significant digits, the value
// drawn at least to σ's last digit (never cut above it), value and σ in the same form. The owner-style hunt's inputs of
// 2026-11-23 (h3 #4, #5, #12, #13) in the unit view, ↑Enter, Esc: the Home row it leaves, Copy as shown the same text,
// and the view's second line. The real engine. Expected values: derived from the rule (1234567890.12345 ± 0.0001: σ's
// last digit at 10⁻⁵; (4.7 ± 0.1)·10³ = 4700 ± 100: σ's last digit at 10¹, the value's prefix k).
import { expect, test, type Page } from "@playwright/test";
import { flick, lastResult, open, tap, useClipboardLock } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
test.describe.configure({ mode: "serial" });
useClipboardLock(); // R74f1: first hook, so the lock is held before the page opens

const ts = " "; // PFX's thin space before the prefix
const done = (page: Page) => page.locator('[data-status="done"]');
const sub = (page: Page) => page.getByTestId("unit-sub");
const clipboard = (page: Page): Promise<string> => page.evaluate(() => navigator.clipboard.readText());

/** `latex` on Home's line, the units key, m in its slot, Eval (↑Enter): the unit view's result. */
async function inUnits(page: Page, latex: string): Promise<void> {
  await page.evaluate((l) => window.n62.entry.insert(l), latex);
  await flick(page, "tmpl", "up");
  await page.waitForFunction(() => window.n62.unitView !== undefined && document.querySelector('[data-pad="unit"]') !== null);
  await tap(page, ["d9"]); // m
  await flick(page, "enter", "up");
  await expect(page.getByTestId("unit-result")).toBeVisible();
}

/** Esc leaves the view (Home's `rows`th row is the unit row), a second Esc clears the line. */
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

test.describe("a value with σ is drawn by one rule (R885)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await open(page, "");
    await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
  });

  test("never cut above σ: 1234567890.12345 ± 0.0001, and at 4 and 1 digits; Copy as shown the same", async ({ page }) => {
    await inUnits(page, "1234567890.12345\\pm0.0001");
    await leave(page, 1);
    await expect(lastResult(page)).toHaveAttribute("data-text", "1234567890.12345 ± 0.00010 m");
    await copyShown(page);
    await expect.poll(() => clipboard(page)).toBe("1234567890.12345 ± 0.00010 m");
    await page.evaluate(() => (window.n62.session.settings.digits = 4));
    await inUnits(page, "12345.678\\pm0.001");
    await leave(page, 2);
    await expect(lastResult(page)).toHaveAttribute("data-text", "12345.6780 ± 0.0010 m");
    await page.evaluate(() => (window.n62.session.settings.digits = 1));
    await inUnits(page, "2.5\\pm0.1");
    await leave(page, 3);
    await expect(lastResult(page)).toHaveAttribute("data-text", "2.50 ± 0.10 m");
    await expect(lastResult(page).locator(".unc")).toHaveCount(1); // R883's muting stays: 50 past σ's first digit's place
  });

  test("PFX: σ in the value's prefix, (4.7 ± 0.1)·10³ and (9.81 ± 0.05)·10⁻⁶", async ({ page }) => {
    await page.evaluate(() => (window.n62.session.settings.format = "pfx"));
    await inUnits(page, "(4.7\\pm0.1)\\cdot10^3");
    await leave(page, 1);
    await expect(lastResult(page)).toHaveAttribute("data-text", `4.70${ts}k ± 0.10${ts}k m`);
    await copyShown(page);
    await expect.poll(() => clipboard(page)).toBe(`4.70${ts}k ± 0.10${ts}k m`);
    await inUnits(page, "(9.81\\pm0.05)\\cdot10^{-6}");
    await leave(page, 2);
    await expect(lastResult(page)).toHaveAttribute("data-text", `9.810${ts}µ ± 0.050${ts}µ m`);
  });

  test("SCI pads no zeros past σ; the view's second line has σ at 2 digits", async ({ page }) => {
    await page.evaluate(() => (window.n62.session.settings.format = "sci"));
    await inUnits(page, "9.81\\pm0.05");
    await expect(sub(page)).toHaveText(/· σ 5\.0E-2$/);
    await leave(page, 1);
    await expect(lastResult(page)).toHaveAttribute("data-text", "9.810E0 ± 0.050 m");
    await copyShown(page);
    await expect.poll(() => clipboard(page)).toBe("9.810E0 ± 0.050 m");
  });

  test("STD: the row reads as the view's headline, 9.810 ± 0.050", async ({ page }) => {
    await inUnits(page, "9.81\\pm0.05");
    await expect(page.getByTestId("unit-result").locator(".value")).toHaveText("9.810 ± 0.050");
    await leave(page, 1);
    await expect(lastResult(page)).toHaveAttribute("data-text", "9.810 ± 0.050 m");
  });

  test("controls: a row without σ is drawn by the digits setting; Copy keeps every digit", async ({ page }) => {
    await page.evaluate(() => (window.n62.session.settings.format = "sci"));
    await inUnits(page, "9.81");
    await leave(page, 1);
    await expect(lastResult(page)).toHaveAttribute("data-text", "9.81000000000E0 m");
    await page.evaluate(() => (window.n62.session.settings.format = "std"));
    await inUnits(page, "1234567890.123456789\\pm0.0001");
    await leave(page, 2);
    await tap(page, ["up"]);
    await page.getByTestId("row-actions").getByRole("button", { name: /Copy/ }).tap({ timeout: 5000 });
    await page.getByRole("menuitem", { name: /^\d Full value$/ }).click();
    await expect.poll(() => clipboard(page)).toBe("1234567890.123456789 ± 0.00010 m");
  });
});
