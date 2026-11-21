// SPDX-License-Identifier: GPL-3.0-or-later
// G23: a result with no confirmed digit shows "⚠ no digit confirmed" and no number; ⚠ n with n > 0 is unchanged.
// sin(10^2000) is out of reach of every evaluation within the budget (oracle: needs about 2000 digits).
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, setClipboard, useClipboardLock } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
useClipboardLock(); // first hook: the system clipboard is one for every worker (R74f1)

const submit = (page: Page, latex: string): Promise<void> =>
  page.evaluate((l) => window.n62.session.submit(l), latex);

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
});

test("no confirmed digit: the mark says so and the row holds no number", async ({ page }) => {
  await submit(page, "\\sin\\left(10^{2000}\\right)");
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  const mark = page.getByTestId("mark");
  await expect(mark).toHaveText("⚠ no digit confirmed");
  await expect(mark).toHaveAttribute("data-mark", "⚠");
  const result = page.locator('[data-testid="result"] .result');
  await expect(result.locator(".math")).toHaveCount(0);
  await expect(result).toHaveText("");
});

test("⚠ n with n > 0 still shows its digits", async ({ page }) => {
  await submit(page, "\\operatorname{romberg}\\left(\\exponentialE^{-x^2},x,0,1\\right)");
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await expect(page.getByTestId("mark")).toHaveAttribute("data-mark", "⚠");
  await expect(page.getByTestId("mark")).not.toHaveText("⚠ no digit confirmed");
  await expect(page.locator('[data-testid="result"] .result .math')).toHaveCount(1);
});

test("tapping a no-digit row puts no digit on the line (oracle: sin(10^2000) = +0.2678…, not the shown double)", async ({ page }) => {
  await submit(page, "\\sin\\left(10^{2000}\\right)");
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  for (let i = 0; i < 2; i++) await page.locator('[data-testid="result"] .result').dispatchEvent("click"); // empty button: no box to hit; R147: the first picks
  const line = await entryValue(page);
  expect(line).toContain("{⚠}");
  expect(line).not.toMatch(/\d\./);
});

// R832f2 (principle 3): the row shows no number, so a hold on the result and Copy › As shown write none; the notice says why.
test("no-digit row: a hold on the result and Copy › As shown leave the clipboard untouched", async ({ page }) => {
  await submit(page, "\\sin\\left(10^{2000}\\right)");
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  const clip = (): Promise<string> => page.evaluate(() => navigator.clipboard.readText());
  const notice = page.getByTestId("notice");
  await setClipboard(page, "before");
  // (the empty result button has no box to touch: the hold is its pointer events, as apps/longpress.ts reads them)
  const result = page.locator('[data-testid="result"] .result');
  await expect(result).toHaveAttribute("data-gestures", "", { timeout: 15_000 });
  await result.dispatchEvent("pointerdown", { button: 0, pointerType: "touch" });
  await page.waitForTimeout(700);
  await result.dispatchEvent("pointerup", { pointerType: "touch" });
  await result.dispatchEvent("click"); // (the click after the lift, which the hold swallows)
  await expect(notice).toHaveText("No digit confirmed");
  expect(await clip()).toBe("before");
  await expect(notice).toBeHidden({ timeout: 5000 });
  await result.dispatchEvent("click"); // the first tap picks the row (R147)
  await page.getByTestId("row-actions").getByRole("button", { name: /Copy/ }).tap({ timeout: 5000 });
  await page.getByRole("menuitem", { name: /^\d As shown$/ }).click();
  await expect(notice).toHaveText("No digit confirmed");
  expect(await clip()).toBe("before");
});
