// SPDX-License-Identifier: GPL-3.0-or-later
// R149: N62, then Enter, opens the credits sheet over the keypad (a sheet like any other); the line is cleared and nothing
// is submitted. With a stored N (N62 reads as N times 62) it is a calculation. The text rolls, and not under reduced motion.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, lastResult, open, tap } from "./helpers.ts";

const credits = (page: Page) => page.getByTestId("credits");
const rows = (page: Page) => page.locator('[data-testid="result"]');
const typeN62 = (page: Page) => tap(page, ["alpha", "paren", "d6", "d2"]);

async function asked(page: Page, view: "home" | "cas"): Promise<void> {
  await page.evaluate((v) => window.n62.session.setView(v), view);
  await typeN62(page);
  expect((await entryValue(page)).toLowerCase()).toBe("n62");
  await tap(page, ["enter"]);
  await expect(credits(page)).toBeVisible();
  await expect(credits(page)).toContainText("N for number, 6 first perfect number, 2 first prime number");
  await expect(credits(page)).toContainText("Giac");
  await expect(credits(page)).toContainText("MathLive");
  await expect(page.getByTestId("sheet-title")).toHaveText("N62");
  expect(await entryValue(page)).toBe("");
  expect(await page.evaluate(() => window.n62.session.items.length)).toBe(0);
}

test.describe("fake engine", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await open(page);
  });

  test("Home: Alpha, ( ), 6, 2, Enter shows the credits, no history row; Esc closes it", async ({ page }) => {
    await asked(page, "home");
    await page.keyboard.press("Escape");
    await expect(credits(page)).toHaveCount(0);
  });

  test("a tap on the history closes it", async ({ page }) => {
    await asked(page, "home");
    await page.getByTestId("sheet-catch").tap({ position: { x: 20, y: 20 } });
    await expect(credits(page)).toHaveCount(0);
  });

  test("CAS: the same, with n62", async ({ page }) => {
    await asked(page, "cas");
  });

  test("N62+1 is a calculation: no sheet", async ({ page }) => {
    await tap(page, ["alpha", "paren", "d6", "d2", "add", "d1", "enter"]);
    await expect(rows(page)).toHaveCount(1);
    await expect(credits(page)).toHaveCount(0);
  });

  test("the text rolls up, and a touch stops it where it is", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await asked(page, "home");
    await expect(credits(page)).toHaveAttribute("data-rolling", "true");
    expect(await credits(page).evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(1);
    await credits(page).dispatchEvent("pointerdown");
    await expect(credits(page)).toHaveAttribute("data-rolling", "false");
    expect(await credits(page).evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  });

  test("under reduced motion nothing animates", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await asked(page, "home");
    await expect(credits(page)).toHaveAttribute("data-rolling", "false");
    expect(await credits(page).evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });
});

test.describe("real engine", () => {
  // A name with a digit cannot be stored (Sto ▶ takes letters), so the guard is the stored letter: with 5 in N the line N62 is
  // N × 62 and Enter submits it (Opus pass 115).
  test("with 5 stored in N, N62 then Enter gives 310 and no sheet opens", async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await open(page, "");
    await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
    await tap(page, ["d5", "shift", "emark", "alpha", "paren", "enter"]);
    await expect(rows(page)).toHaveCount(1);
    await expect(lastResult(page)).toHaveAttribute("data-text", "5"); // the row that stored it
    await typeN62(page);
    await tap(page, ["enter"]);
    await expect(rows(page)).toHaveCount(2);
    await expect(lastResult(page)).toHaveAttribute("data-text", "310"); // derived: 5 × 62
    await expect(credits(page)).toHaveCount(0);
  });
});
