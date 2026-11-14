// SPDX-License-Identifier: GPL-3.0-or-later
// R194 (docs/04 5.4): Settings › Numbers › Word size (8, 16, 32, 64) and Signed (two's complement). They re-draw a base
// form on screen (R192) and change the short forms of the word ops (G229: shl(3,7)), and both survive a relaunch.
// Expected values are derived: 300 = 0x12C needs 9 bits, so it fits no byte but a 16-bit word; shl(3,7) = 384 in 64
// bits, 384 mod 256 = 128 in an unsigned byte, and bit 7 set is −128 in a signed one. The real engine (GIAC_OUT).
import { expect, test, type Page } from "@playwright/test";
import { lastResult, open, sheet, tap } from "./helpers.ts";

const ready = (page: Page) => page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
const done = (page: Page, n: number) => expect(page.locator('[data-status="done"]')).toHaveCount(n);
const row = (page: Page, id: string) => sheet(page).locator(`[data-id="${id}"]`);
/** Settings › Numbers › Word (Mode's row 6, section 2, row 7), as a user opens it: Numbers holds seven rows, so the two
 *  settings are the two rows of its Word level. */
async function numbers(page: Page): Promise<void> {
  await tap(page, ["@mode", "d6", "d2"]);
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode › Settings › Numbers");
  await tap(page, ["d7"]);
  await expect(page.getByTestId("sheet-title")).toContainText("Word");
}
async function reload(page: Page): Promise<void> {
  await page.waitForTimeout(300); // the store writes behind the change
  await page.reload();
  await page.waitForFunction(() => customElements.get("math-field") !== undefined && window.n62 !== undefined);
  await page.evaluate(() => window.n62.entry.ready);
  await ready(page);
}
const SHL = "\\operatorname{shl}\\left(3,7\\right)";

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await ready(page);
});

test("Settings › Numbers › Word shows Word size (8 16 32 64, 64 picked) and Signed (off)", async ({ page }) => {
  await tap(page, ["@mode", "d6", "d2"]);
  await expect(row(page, "word")).toContainText("64 · unsigned"); // the Numbers row says it
  await tap(page, ["d7"]);
  await expect(row(page, "bits")).toContainText(/Word size/i);
  await expect(row(page, "bits").locator(".opt")).toHaveText(["8", "16", "32", "64"]);
  await expect(row(page, "bits").locator('[data-option="64"]')).toHaveAttribute("aria-pressed", "true");
  await expect(row(page, "signed")).toContainText(/Signed/i);
  await expect(row(page, "signed")).toHaveAttribute("data-selected", "false");
});

test("a change re-draws a base form: 300 in HEX is 0x12C, and stays 300 in a byte", async ({ page }) => {
  await tap(page, ["d3", "d0", "d0", "enter"]);
  await done(page, 1);
  await tap(page, ["shift", "sub"]);
  await row(page, "hex").tap();
  await expect(lastResult(page)).toHaveAttribute("data-text", "0x12C");
  await numbers(page);
  await row(page, "bits").locator('[data-option="8"]').tap();
  await expect(sheet(page)).toBeHidden();
  await expect(lastResult(page)).toHaveAttribute("data-text", "300"); // outside an unsigned byte: the number in its notation
  await numbers(page);
  await row(page, "bits").locator('[data-option="16"]').tap();
  await expect(lastResult(page)).toHaveAttribute("data-text", "0x12C");
});

test("a change moves shl(3,7): 384, then 128 in a byte, then −128 in a signed byte; a relaunch keeps it", async ({ page }) => {
  await page.evaluate((s) => window.n62.session.submit(s), SHL);
  await done(page, 1);
  await expect(lastResult(page)).toHaveAttribute("data-text", "384");
  await numbers(page);
  await row(page, "bits").locator('[data-option="8"]').tap();
  await page.evaluate((s) => window.n62.session.submit(s), SHL);
  await done(page, 2);
  await expect(lastResult(page)).toHaveAttribute("data-text", "128");
  await numbers(page);
  await row(page, "signed").tap();
  await expect(row(page, "signed")).toHaveAttribute("data-selected", "true"); // a switch: the sheet stays
  await tap(page, ["esc", "esc", "esc"]);
  await page.evaluate((s) => window.n62.session.submit(s), SHL);
  await done(page, 3);
  await expect(lastResult(page)).toHaveAttribute("data-text", "-128");
  await reload(page);
  const kept = await page.locator('[data-status="done"]').count(); // the rows the relaunch brought back (the store writes behind)
  await page.evaluate((s) => window.n62.session.submit(s), SHL);
  await done(page, kept + 1); // wait for the new row: a restored one must not satisfy the check below
  await expect(page.locator('[data-testid="result"]').nth(kept).locator(".result")).toHaveAttribute("data-text", "-128");
  await numbers(page);
  await expect(row(page, "bits").locator('[data-option="8"]')).toHaveAttribute("aria-pressed", "true");
  await expect(row(page, "signed")).toHaveAttribute("data-selected", "true");
});

test("a base form follows the word after a relaunch: 300 stays 300 in a byte, where the default word draws 0x12C", async ({ page }) => {
  await tap(page, ["d3", "d0", "d0", "enter"]);
  await done(page, 1);
  await tap(page, ["shift", "sub"]);
  await row(page, "hex").tap();
  await expect(lastResult(page)).toHaveAttribute("data-text", "0x12C"); // the default word: 64 bits
  await numbers(page);
  await row(page, "bits").locator('[data-option="8"]').tap();
  await expect(sheet(page)).toBeHidden();
  await expect(lastResult(page)).toHaveAttribute("data-text", "300"); // 0x12C fits no unsigned byte: the number in its notation
  await reload(page);
  await expect(lastResult(page)).toHaveAttribute("data-text", "300"); // a word never read after the reload would draw 0x12C again
});
