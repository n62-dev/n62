// SPDX-License-Identifier: GPL-3.0-or-later
// R881: "rainbow" then Enter turns the rainbow mode on for the session (html[data-rainbow]): no history row, the line emptied,
// a short notice. Typed again, a theme pick or a reload ends it. With a stored letter of the line it stays a calculation.
// The ≈ mark and the result text keep their colours; the keypad turns, and not under reduced motion.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, sheetKey, tap } from "./helpers.ts";

const on = (page: Page): Promise<boolean> => page.evaluate(() => document.documentElement.hasAttribute("data-rainbow"));
const rows = (page: Page) => page.locator('[data-testid="result"]');
const ready = (page: Page) => page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
const NOTICE = "Rainbow on. Type rainbow and Enter again to end it.";
/** The Alpha lock, then R A I N B O W (Home: capitals). */
const ALPHA_RAINBOW = ["alpha", "alpha", "d8", "vars", "tan", "paren", "math", "comma", "d6"];

async function typed(page: Page, word = "rainbow"): Promise<void> {
  await page.keyboard.type(word);
  await expect.poll(() => entryValue(page)).toBe(word);
  await page.keyboard.press("Enter");
}
/** It came on: the mark, no row (nor a note row), the line empty, the notice. */
async function cameOn(page: Page): Promise<void> {
  await expect.poll(() => on(page)).toBe(true);
  expect(await page.evaluate(() => window.n62.session.items.length)).toBe(0);
  expect(await entryValue(page)).toBe("");
  await expect(page.getByTestId("notice")).toHaveText(NOTICE);
}

for (const width of [412, 360])
  test.describe(`at ${width} px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 860 });
      await page.emulateMedia({ reducedMotion: "no-preference" });
    });

    test.describe("fake engine", () => {
      test.beforeEach(async ({ page }) => open(page));

      test("a hardware rainbow, Enter: on, no row, the line empty, the notice; the keys take their hues and the keypad turns", async ({ page }) => {
        expect(await on(page)).toBe(false);
        await typed(page);
        await cameOn(page);
        const faces = await page.locator(".pad .key.num").evaluateAll((els) => new Set(els.map((e) => getComputedStyle(e).backgroundColor)).size);
        expect(faces).toBeGreaterThan(3); // the digits are no longer one colour
        expect(await page.locator(".pad").evaluate((el) => el.getAnimations().map((a) => (a as CSSAnimation).animationName))).toEqual(["rb-turn"]);
      });

      test("Alpha lock, R A I N B O W, Enter in Home: the same", async ({ page }) => {
        await tap(page, ALPHA_RAINBOW);
        expect(await entryValue(page)).toBe("RAINBOW");
        await tap(page, ["enter"]);
        await cameOn(page);
      });

      test("typed again: off", async ({ page }) => {
        await typed(page);
        await expect.poll(() => on(page)).toBe(true);
        await typed(page);
        await expect.poll(() => on(page)).toBe(false);
        expect(await page.evaluate(() => window.n62.session.items.length)).toBe(0);
      });

      test("a theme pick in Appearance: off", async ({ page }) => {
        await typed(page);
        await expect.poll(() => on(page)).toBe(true);
        await tap(page, ["help", "d2"]);
        await sheetKey(page, ["right"]);
        await expect(page.locator("html")).toHaveAttribute("data-family", "bw");
        expect(await on(page)).toBe(false);
      });

      test("a reload: off (never stored)", async ({ page }) => {
        await typed(page);
        await expect.poll(() => on(page)).toBe(true);
        await page.waitForTimeout(300); // the store writes behind a change
        await open(page);
        expect(await on(page)).toBe(false);
      });

      test("under reduced motion it comes on and nothing animates", async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await typed(page);
        await cameOn(page);
        expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
      });
    });

    test.describe("real engine", () => {
      test.beforeEach(async ({ page }) => {
        await open(page, "");
        await ready(page);
      });

      test("with a stored a, rainbow then Enter is a calculation: a row, no rainbow", async ({ page }) => {
        await page.evaluate(() => window.n62.session.setView("cas")); // Alpha types lower case here
        await tap(page, ["d5", "shift", "emark", "alpha", "vars", "enter"]);
        await expect(rows(page)).toHaveCount(1);
        await expect.poll(() => page.evaluate(() => window.n62.session.userNames.map((n) => n.name))).toContain("a"); // the names are read after the row
        await typed(page);
        await expect(rows(page)).toHaveCount(2);
        expect(await on(page)).toBe(false);
      });

      test("while it is on, a ≈ row's mark and result text keep their colours", async ({ page }) => {
        await page.evaluate(() => window.n62.session.submit("\\sqrt{2}+0.5"));
        await expect(page.locator('[data-status="done"]')).toHaveCount(1);
        await expect(page.getByTestId("mark").last()).toHaveAttribute("data-mark", "≈");
        const colours = () =>
          page.evaluate(() => {
            const mark = [...document.querySelectorAll('[data-testid="mark"]')].at(-1) as Element;
            const result = [...document.querySelectorAll('[data-testid="result"] .result')].at(-1) as Element;
            return [getComputedStyle(mark).color, getComputedStyle(result).color];
          });
        const off = await colours();
        await typed(page);
        await expect.poll(() => on(page)).toBe(true);
        expect(await page.evaluate(() => getComputedStyle(document.querySelector(".history") as Element).backgroundImage)).toContain("gradient"); // the wash is there
        expect(await colours()).toEqual(off);
      });
    });
  });
