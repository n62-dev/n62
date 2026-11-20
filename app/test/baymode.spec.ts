// SPDX-License-Identifier: GPL-3.0-or-later
// R785 (owner, 2026-11-20): the bar's middle bay. Home and CAS: one chip, the format and the significant digits (`STD|12`),
// a tap opens Mode on Format with Significant digits the next row. An app with views: its view icons after the hairline, no
// chip; Mode is the last row of every app view's ☰. Every bar target at least 28 × 28 and nothing overlaps at 360 with DEG PFX 30.
import { expect, test, type Page } from "@playwright/test";
import { open, sheet, tap } from "./helpers.ts";

const active = (page: Page) => sheet(page).locator('[role="menuitem"][data-active="true"]');
const inApp = (page: Page) => page.waitForFunction(() => window.n62.shell.app === "function" && window.n62.shell.loading === null);

/** Every bar button's box: at least 28 × 28, none over another, none outside the bar. */
async function fits(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const bar = document.querySelector('[data-testid="bar"]') as HTMLElement;
    const bb = bar.getBoundingClientRect();
    const bad: string[] = [];
    const boxes = [...bar.querySelectorAll<HTMLElement>("button")].map((b) => ({ id: b.dataset["testid"] ?? "?", r: b.getBoundingClientRect() }));
    for (const { id, r } of boxes) {
      if (r.width < 27.99 || r.height < 27.99) bad.push(`${id} is ${r.width.toFixed(1)} × ${r.height.toFixed(1)}`);
      if (r.left < bb.left - 0.5 || r.right > bb.right + 0.5) bad.push(`${id} outside the bar`);
    }
    for (const [i, a] of boxes.entries())
      for (const b of boxes.slice(i + 1)) if (a.r.left < b.r.right - 0.5 && b.r.left < a.r.right - 0.5) bad.push(`${a.id} overlaps ${b.id}`);
    if (bar.scrollWidth > bar.clientWidth) bad.push(`bar overflows by ${bar.scrollWidth - bar.clientWidth}`);
    return bad;
  });
}

for (const width of [360, 392, 412] as const)
  test.describe(`at ${width} px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await open(page, "");
      await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
    });

    test("Home: one chip-format `STD|12` and no chip-digits; Mode's SCI and 6 show as SCI|6; a tap opens Mode on Format, Significant digits next", async ({ page }) => {
      await expect(page.getByTestId("chip-format")).toHaveCount(1);
      await expect(page.getByTestId("chip-digits")).toHaveCount(0);
      await expect(page.getByTestId("chip-format")).toHaveText("STD|12");
      await page.getByTestId("chip-format").tap();
      await expect(page.getByTestId("sheet-title")).toHaveText("Mode");
      await expect(active(page)).toHaveAttribute("data-id", "format");
      await expect(active(page).locator("xpath=following-sibling::*[1]")).toHaveAttribute("data-id", "digits");
      await sheet(page).locator('[data-id="format"] [aria-pressed]', { hasText: "SCI" }).tap();
      await page.evaluate(() => window.n62.session.setDigits(6));
      await expect(page.getByTestId("chip-format")).toHaveText("SCI|6");
      expect(await fits(page)).toEqual([]);
    });

    test("CAS has the same chip", async ({ page }) => {
      await tap(page, ["@cas"]);
      await expect(page.getByTestId("chip-format")).toHaveText("STD|12");
      await expect(page.getByTestId("chip-digits")).toHaveCount(0);
    });

    test("Function: the bay holds the three view icons after the hairline and no chip-format; ☰ in Plot ends in Mode, its digit picks it", async ({ page }) => {
      await tap(page, ["@plot"]);
      await inApp(page);
      await expect(page.getByTestId("chip-format")).toHaveCount(0);
      const b = async (id: string) => (await page.getByTestId(id).boundingBox())!;
      const [home, cas, symb, plot, num] = [await b("tab-home"), await b("tab-cas"), await b("tab-symb"), await b("tab-plot"), await b("tab-num")];
      expect(cas.x + cas.width).toBeLessThanOrEqual(symb.x + 0.5); // the places, the hairline, then the views
      expect(home.x).toBeLessThan(cas.x);
      expect(symb.x + symb.width).toBeLessThanOrEqual(plot.x + 0.5);
      expect(plot.x + plot.width).toBeLessThanOrEqual(num.x + 0.5);
      for (const v of [symb, plot, num]) expect(v.width).toBeGreaterThanOrEqual(28);
      await page.getByTestId("menu-button").tap();
      const rows = sheet(page).locator('[role="menuitem"][data-id]');
      await rows.first().waitFor();
      const ids = await rows.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset["id"]));
      expect(ids[ids.length - 1]).toBe("mode");
      await tap(page, [`d${ids.length}`]);
      await expect(page.getByTestId("sheet-title")).toHaveText("Mode");
      expect(await fits(page)).toEqual([]);
    });

    test("Mode set from an app's ☰ changes the next Home result's format", async ({ page }) => {
      await tap(page, ["@plot"]);
      await inApp(page);
      await tap(page, ["@mode"]); // in an app: ☰ and Mode
      await expect(page.getByTestId("sheet-title")).toHaveText("Mode");
      await sheet(page).locator('[data-id="format"] [aria-pressed]', { hasText: "PFX" }).tap();
      await tap(page, ["@home"]);
      await expect(page.getByTestId("chip-format")).toHaveText("PFX|12");
      await tap(page, ["d1", "d2", "d0", "d0", "d0", "enter"]);
      await expect(page.locator('[data-testid="result"] .result').last()).toHaveAttribute("data-text", /^12.k$/); // (a no-break space before the prefix)
    });

    test("DEG PFX 30 fits in Home and in Function: no target under 28 × 28, no overlap", async ({ page }) => {
      await page.evaluate(() => {
        const s = window.n62.session;
        s.settings.angle = "deg";
        s.settings.format = "pfx";
        s.settings.digits = 30;
      });
      await expect(page.getByTestId("chip-format")).toHaveText("PFX|30");
      expect(await fits(page)).toEqual([]);
      await tap(page, ["@plot"]);
      await inApp(page);
      expect(await fits(page)).toEqual([]);
    });
  });
