// SPDX-License-Identifier: GPL-3.0-or-later
// R160: the inline too-old WebView check (index.html) shows its notice, and no #app, when the WebView lacks a CSS
// feature the app needs: color-mix (Chrome 111, keypad colours) or container units (Chrome 105, the round pad).
// Feature detection only: the init script changes what CSS.supports answers, nothing else.
import { expect, test, type Page } from "@playwright/test";

const NOTICE = "This app needs a newer Android System WebView / Chrome";

async function without(page: Page, feature: string): Promise<void> {
  await page.addInitScript((f) => {
    const real = CSS.supports.bind(CSS);
    CSS.supports = ((...a: string[]) => (a.join(" ").includes(f) ? false : real(...(a as [string, string]))) ) as typeof CSS.supports;
  }, feature);
}

for (const [name, feature] of [["color-mix", "color-mix("], ["container units", "cqi"]] as const) {
  test(`no ${name}: the update notice shows and #app is gone`, async ({ page }) => {
    await without(page, feature);
    await page.goto("/?engine=fake");
    await expect(page.getByText(NOTICE)).toBeVisible();
    await expect(page.locator("#app")).toHaveCount(0);
  });
}

test("a normal start shows no notice", async ({ page }) => {
  await page.goto("/?engine=fake");
  await expect(page.locator("#app")).toHaveCount(1);
  await expect(page.getByText(NOTICE)).toHaveCount(0);
});
