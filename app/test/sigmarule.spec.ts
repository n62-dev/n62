// SPDX-License-Identifier: GPL-3.0-or-later
// R885: a value with σ is drawn by one rule (docs/04 2.6, render/sigmaForm.ts): σ at 2 significant digits, the value
// drawn at least to σ's last digit (never cut above it), value and σ in the same form. The owner-style hunt's inputs of
// 2026-11-23 (h3 #4, #5, #12, #13) in the unit view, ↑Enter, Esc: the Home row it leaves, Copy as shown the same text,
// and the view's second line. The real engine. Expected values: derived from the rule (1234567890.12345 ± 0.0001: σ's
// last digit at 10⁻⁵; (4.7 ± 0.1)·10³ = 4700 ± 100: σ's last digit at 10¹, the value's prefix k).
import { expect, test, type Locator, type Page } from "@playwright/test";
import { flick, lastResult, open, tap, useClipboardLock } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
test.describe.configure({ mode: "serial" });
useClipboardLock(); // R74f1: first hook, so the lock is held before the page opens

const ts = " "; // PFX's thin space before the prefix
const done = (page: Page) => page.locator('[data-status="done"]');
const sub = (page: Page) => page.getByTestId("unit-sub");
/** A locator's text without R55's digit groups (the thin spaces between groups). */
const ungrouped = async (l: Locator): Promise<string | undefined> => (await l.textContent())?.replace(/[\u2009\u202f]/g, "");
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

  // R885 FIX round 2: the view's headline and second line draw through the row's function (units/result.ts)
  test("bug list 4, G·5.972ᴇ24: the view's headline and the row put σ in the value's exponent; its second line σ 9.0E9", async ({ page }) => {
    await inUnits(page, "(6.6743\\pm0.00015)\\cdot10^{-11}\\cdot5.972\\cdot10^{24}");
    // the headline is cut at σ's last digit (10⁸), the row keeps the digits setting's (muted past σ); groups dropped
    await expect.poll(() => ungrouped(page.getByTestId("unit-result").locator(".value"))).toBe("3.985892E14 ± 0.000090E14");
    await expect.poll(() => ungrouped(sub(page))).toBe("3.98589196E14 · σ 9.0E9");
    await leave(page, 1);
    await expect(lastResult(page)).toHaveAttribute("data-text", "3.98589196E14 ± 0.000090E14 m");
  });

  test("PFX: the view's headline is the row's, 4.70 k ± 0.10 k", async ({ page }) => {
    await page.evaluate(() => (window.n62.session.settings.format = "pfx"));
    await inUnits(page, "(4.7\\pm0.1)\\cdot10^3");
    await expect(page.getByTestId("unit-result").locator(".value")).toHaveText(`4.70${ts}k ± 0.10${ts}k`);
    await leave(page, 1);
    await expect(lastResult(page)).toHaveAttribute("data-text", `4.70${ts}k ± 0.10${ts}k m`);
  });

  test("never below the value's confirmed digits: 10²⁰·π at 12 digits ± 3 pads no zeros above σ's place (R885 FIX 1)", async ({ page }) => {
    // ± goes only after a number (parse.pmNeedsNumber), and the unit view works 10²⁰·π out to 22 digits: the row it files
    // is drawn to σ's place with digits it has
    await inUnits(page, "314159265358979323846.264\\pm3");
    await leave(page, 1);
    await expect(lastResult(page)).toHaveAttribute("data-text", "314159265358979323846.3 ± 3.0 m");
    // the same row holding Giac's 12-digit value (12 reliable digits): drawn to those digits, never padded with zeros
    // for digits it does not have (it read 314159265359000000000.0 ± 3.0 m)
    await page.evaluate(() => {
      const it = window.n62.session.home.at(-1) as unknown as { value: { re: object }; facts: { reliableDigits: number | null } };
      it.value.re = { neg: false, digits: "314159265359", exp: 20, sticky: false };
      it.facts.reliableDigits = 12;
    });
    await expect(lastResult(page)).toHaveAttribute("data-text", "3.14159265359E20 ± 3.0 m");
    await copyShown(page);
    await expect.poll(() => clipboard(page)).toBe("3.14159265359E20 ± 3.0 m");
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
