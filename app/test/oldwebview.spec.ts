// SPDX-License-Identifier: GPL-3.0-or-later
// R160: the inline too-old WebView check (index.html) shows its notice, and no #app, when the WebView lacks a CSS
// feature the app needs: color-mix (Chrome 111, keypad colours) or container units (Chrome 105, the round pad).
// Feature detection only: the init script changes what CSS.supports answers, nothing else.
import { expect, test, type Page } from "@playwright/test";

const NOTICE = "This app needs a newer Android System WebView / Chrome";
// R285: the notice names the Android WebView only where the browser is one; every other browser is told to update itself.
const BROWSER_NOTICE = "This app needs a newer browser. Update it and reload.";
const WEBVIEW_UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/90.0.0.0 Mobile Safari/537.36";
const FIREFOX_UA = "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/109.0";
const SAFARI_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Safari/605.1.15";

async function without(page: Page, feature: string): Promise<void> {
  await page.addInitScript((f) => {
    const real = CSS.supports.bind(CSS);
    CSS.supports = ((...a: string[]) => (a.join(" ").includes(f) ? false : real(...(a as [string, string]))) ) as typeof CSS.supports;
  }, feature);
}

for (const [name, feature] of [["color-mix", "color-mix("], ["container units", "cqi"]] as const) {
  test.describe(`no ${name}`, () => {
    test.use({ userAgent: WEBVIEW_UA });
    test("on an Android WebView: the update notice names the WebView and #app is gone", async ({ page }) => {
      await without(page, feature);
      await page.goto("/?engine=fake");
      await expect(page.getByText(NOTICE)).toBeVisible();
      await expect(page.locator("#app")).toHaveCount(0);
    });
  });
  for (const [browser, ua] of [["Firefox", FIREFOX_UA], ["Safari", SAFARI_UA]] as const) {
    test.describe(`no ${name} in ${browser}`, () => {
      test.use({ userAgent: ua });
      test("the notice asks for a newer browser and does not name the WebView", async ({ page }) => {
        await without(page, feature);
        await page.goto("/?engine=fake");
        await expect(page.getByText(BROWSER_NOTICE, { exact: true })).toBeVisible();
        await expect(page.getByText("Android System WebView")).toHaveCount(0);
        await expect(page.locator("#app")).toHaveCount(0);
      });
    });
  }
}

test("a normal start shows no notice", async ({ page }) => {
  await page.goto("/?engine=fake");
  await expect(page.locator("#app")).toHaveCount(1);
  await expect(page.getByText(NOTICE)).toHaveCount(0);
});
