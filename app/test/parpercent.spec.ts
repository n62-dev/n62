// SPDX-License-Identifier: GPL-3.0-or-later
// R323 (the owner, 2026-11-14), on the real engine: Shift + `( )` types ∥, Find's par() with the cursor in its bracket
// (task t01: 4.7k ∥ 10k), and a flick up on `( )` does the same; Shift + 0 types % (5 % is 1/20, Home shows 0.05, as the
// Shift + 9 palette's % cell gives, shiftpal.spec.ts). Controls: the taps of `( )` and 0 are unchanged, Alpha + 0 stays
// dead, and the other blank Shift cells (Vars, a b/c, 7, 1, Fmt) stay reserved: dimmed in the Shift layer, no legend.
// Expected values derived: 4700 × 10000 / 14700 = 470000/147 = 3197.278911…; 5/100 = 1/20.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, flick, lastResult, open, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
});

const key = (page: Page, id: string) => page.locator(`[data-key="${id}"]`);
const shiftLegend = (page: Page, id: string) => key(page, id).evaluate((k) => k.querySelector(".shiftlegend")?.textContent?.trim() ?? "");
/** What MathLive writes for the inserted par() once filled (it wraps an \operatorname's name in \mathrm, as for approx). */
const PAR = "\\operatorname{\\mathrm{par}}\\left(4700,10000\\right)";
const DIGITS = ["d4", "d7", "d0", "d0", "comma", "d1", "d0", "d0", "d0", "d0"];

test("Shift, ( ) inserts par() with the cursor inside: 4700, 10000 gives 3197.27891156", async ({ page }) => {
  await tap(page, ["shift", "paren", ...DIGITS]);
  expect(await entryValue(page)).toBe(PAR);
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "3197.27891156");
});

test("a flick up on ( ) does what Shift, ( ) does", async ({ page }) => {
  await flick(page, "paren", "up");
  await tap(page, DIGITS);
  expect(await entryValue(page)).toBe(PAR);
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "3197.27891156");
});

test("5, Shift, 0 types 5 %, which is 1/20 (Home shows 0.05, as the palette's % cell gives)", async ({ page }) => {
  await tap(page, ["d5", "shift", "d0"]);
  expect(await entryValue(page)).toBe("5\\%");
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "0.05");
});

test("legends ∥ and %; the taps unchanged; Alpha + 0 dead; Vars, a b/c, 7, 1 and Fmt still reserved on Shift", async ({ page }) => {
  expect(await shiftLegend(page, "paren")).toBe("∥");
  expect(await shiftLegend(page, "d0")).toBe("%");
  await tap(page, ["paren", "d1", "right", "d0"]);
  expect(await entryValue(page)).toBe("\\left(1\\right)0");
  await tap(page, ["shift"]);
  for (const id of ["paren", "d0"]) await expect(key(page, id), id).not.toHaveAttribute("data-dead", "true");
  for (const id of ["vars", "frac", "d7", "d1", "fmt"]) {
    await expect(key(page, id), id).toHaveAttribute("data-dead", "true");
    expect(await shiftLegend(page, id), id).toBe("");
  }
  await tap(page, ["shift"]); // Shift off
  await tap(page, ["alpha"]);
  await expect(key(page, "d0")).toHaveAttribute("data-dead", "true");
});
