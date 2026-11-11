// SPDX-License-Identifier: GPL-3.0-or-later
// R285 (arch review 2026-11-10, M2): only Chromium is tested. A browser whose engine has not passed (state/browser.ts
// TESTED) says so once at the first start, in one line under the status line, with OK; Settings › Help and about ›
// About names the engine and whether it is tested. The tests set the user agent string and navigator.userAgentData
// both, so the result never rests on what the Chromium under test reports.
import { expect, test, type Page } from "@playwright/test";
import { open, sheet, tap } from "./helpers.ts";

const FIREFOX = "Mozilla/5.0 (Android 14; Mobile; rv:128.0) Gecko/128.0 Firefox/128.0";
const SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const LINE = "Tested on Chrome and Android. This browser may misbehave: tell us what you see.";

/** What navigator.userAgentData says: Firefox and Safari have none; a Chromium browser lists the Chromium brand. */
async function brands(page: Page, chromium: boolean): Promise<void> {
  await page.addInitScript((c) => {
    Object.defineProperty(navigator, "userAgentData", {
      configurable: true,
      get: () => (c ? { brands: [{ brand: "Chromium", version: "126" }, { brand: "Google Chrome", version: "126" }], mobile: true, platform: "Android" } : undefined),
    });
  }, chromium);
}

const note = (page: Page) => page.getByTestId("browser-note");
const ok = (page: Page) => page.getByTestId("browser-note-ok");
/** The first start has shown its notes by now (the tips' idle wait is 2 s at most). */
const settle = (page: Page) => page.waitForTimeout(2600);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.emulateMedia({ reducedMotion: "reduce" });
});

for (const [name, ua] of [["Firefox", FIREFOX], ["Safari", SAFARI]] as const) {
  test.describe(name, () => {
    test.use({ userAgent: ua });
    test.beforeEach(async ({ page }) => brands(page, false));

    test("the first start shows one line under the status line; OK closes it for good", async ({ page }) => {
      await open(page);
      await expect(note(page)).toBeVisible();
      await expect(note(page)).toHaveCount(1);
      await expect(note(page)).toContainText(LINE);
      await expect(ok(page)).toHaveText("OK");
      const status = await page.getByTestId("status").boundingBox();
      const line = await note(page).boundingBox();
      expect(line && status && line.y >= status.y + status.height - 1).toBe(true);
      await ok(page).click();
      await expect(note(page)).toHaveCount(0);
      await open(page);
      await settle(page);
      await expect(note(page)).toHaveCount(0);
    });

    test("it is shown once even if OK is not pressed before a reload", async ({ page }) => {
      await open(page);
      await expect(note(page)).toBeVisible();
      await open(page);
      await settle(page);
      await expect(note(page)).toHaveCount(0);
    });

    test("About names the engine and says not tested", async ({ page }) => {
      await open(page);
      await tap(page, ["@mode", "d6", "d7", "d3"]);
      const row = sheet(page).locator('[role="menuitem"][data-id="browser"]');
      await expect(row).toContainText(name === "Firefox" ? "Gecko" : "WebKit");
      await expect(row).toContainText("not tested");
    });
  });
}

test.describe("Chromium", () => {
  test.use({ userAgent: CHROME });
  test.beforeEach(async ({ page }) => brands(page, true));

  test("never shows the line", async ({ page }) => {
    await open(page);
    await settle(page);
    await expect(note(page)).toHaveCount(0);
  });

  test("About names Blink and says tested", async ({ page }) => {
    await open(page);
    await tap(page, ["@mode", "d6", "d7", "d3"]);
    const row = sheet(page).locator('[role="menuitem"][data-id="browser"]');
    await expect(row).toContainText("Blink");
    await expect(row).toContainText("tested");
    await expect(row).not.toContainText("not tested");
  });
});

test.describe("a Chromium user agent string without userAgentData still counts as Blink", () => {
  test.use({ userAgent: CHROME });
  test.beforeEach(async ({ page }) => brands(page, false));
  test("no line", async ({ page }) => {
    await open(page);
    await settle(page);
    await expect(note(page)).toHaveCount(0);
  });
});
