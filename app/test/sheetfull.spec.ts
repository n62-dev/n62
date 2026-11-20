// SPDX-License-Identifier: GPL-3.0-or-later
// R778 (owner, 2026-11-20; docs/05 3.1): a sheet that has no fixed size (a list that takes letters: Find, Vars, Units, any menu
// over 10 rows; Chars) has a small corner button, at its bottom right, that makes it fill the whole screen, keypad area
// included; the same button, Esc or Back returns it to the viewport. Tmpl, the Shift palettes and the short fixed lists have
// none. The state belongs to the open sheet. Expected values come from the rule: the box covers the viewport (0, 0, 360, 740);
// the button is a 44 px touch target at the sheet's bottom right. The fake engine, at 360 × 740.
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

const W = 360;
const H = 740;
const full = (page: Page) => page.locator("[data-sheet-full]");
const sheet = (page: Page) => page.locator('[role="menu"]').first();

type Box = { x: number; y: number; width: number; height: number };
const boxOf = async (page: Page, selector: string): Promise<Box> => {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`${selector} is not visible`);
  return b;
};
/** A list of `n` plain rows, as a menu opens one. */
const menu = (page: Page, n: number): Promise<void> =>
  page.evaluate((count) => window.n62.shell.showMenu("Units", Array.from({ length: count }, (_, i) => ({ id: `u${i}`, label: `unit ${i}` }))), n);
/** The box is the viewport (the keypad and the status line under it covered too). */
const covers = (b: Box): boolean => b.x <= 0.5 && b.y <= 0.5 && b.x + b.width >= W - 0.5 && b.y + b.height >= H - 0.5;

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: W, height: H });
  await open(page);
});

test("Math's Find sheet has the corner button: a tap fills the screen, the same button restores it", async ({ page }) => {
  await tap(page, ["math"]);
  await expect(page.getByTestId("find")).toBeVisible();
  await expect(full(page)).toHaveCount(1);
  const small = await boxOf(page, '[role="menu"]');
  expect(covers(small)).toBe(false);
  const button = await boxOf(page, "[data-sheet-full]");
  expect(button.width).toBeGreaterThanOrEqual(44);
  expect(button.height).toBeGreaterThanOrEqual(44);
  expect(Math.abs(button.x + button.width - (small.x + small.width))).toBeLessThanOrEqual(small.width / 4); // in the sheet's right half…
  expect(button.y).toBeGreaterThan(small.y + small.height / 2); // …and its lower half: the bottom right corner
  await full(page).tap();
  expect(covers(await boxOf(page, '[role="menu"]'))).toBe(true);
  const keypad = await boxOf(page, ".pad");
  const big = await boxOf(page, '[role="menu"]');
  expect(big.y).toBeLessThanOrEqual(keypad.y);
  expect(big.y + big.height).toBeGreaterThanOrEqual(keypad.y + keypad.height - 0.5); // the keypad's area is the sheet's
  expect(await full(page).getAttribute("aria-pressed")).toBe("true");
  await full(page).tap();
  const back = await boxOf(page, '[role="menu"]');
  expect(covers(back)).toBe(false);
  expect(back.y + back.height).toBeLessThanOrEqual(keypad.y + 1);
  await expect(page.getByTestId("find")).toBeVisible(); // the sheet stays open
});

test("Esc returns a full sheet to the viewport; a second Esc closes it; closing resets the state", async ({ page }) => {
  await tap(page, ["math"]);
  await full(page).tap();
  expect(covers(await boxOf(page, '[role="menu"]'))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("find")).toBeVisible();
  expect(covers(await boxOf(page, '[role="menu"]'))).toBe(false);
  await full(page).tap();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("find")).toHaveCount(0);
  await tap(page, ["math"]); // a new sheet starts in the viewport
  await expect(page.getByTestId("find")).toBeVisible();
  expect(covers(await boxOf(page, '[role="menu"]'))).toBe(false);
});

test("Back (the browser's) returns a full sheet to the viewport, then closes it", async ({ page }) => {
  await tap(page, ["math"]);
  await full(page).tap();
  await page.goBack();
  await expect(page.getByTestId("find")).toBeVisible();
  expect(covers(await boxOf(page, '[role="menu"]'))).toBe(false);
  await page.goBack();
  await expect(page.getByTestId("find")).toHaveCount(0);
});

test("the picked row stays in view across the switch, both ways", async ({ page }) => {
  await menu(page, 40);
  await expect(sheet(page)).toBeVisible();
  for (let i = 0; i < 20; i++) await page.keyboard.press("ArrowDown");
  const active = sheet(page).locator('[data-active="true"]');
  await expect(active).toBeInViewport();
  await full(page).tap();
  await expect(active).toBeInViewport();
  await expect(active).toContainText("unit 20");
  await full(page).tap();
  await expect(active).toBeInViewport();
});

test("a tap on a row of a full sheet picks it, as in the viewport", async ({ page }) => {
  await menu(page, 40);
  await full(page).tap();
  await sheet(page).locator('[data-id="u3"]').tap();
  await expect(sheet(page)).toHaveCount(0);
});

test("a list of 12 rows has the button, one of 5 has none", async ({ page }) => {
  await menu(page, 12);
  await expect(full(page)).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toHaveCount(0);
  await menu(page, 5);
  await expect(sheet(page)).toBeVisible();
  await expect(full(page)).toHaveCount(0);
});

test("Tmpl, Shift + 6, Shift + 9 and Mode have no button", async ({ page }) => {
  await tap(page, ["tmpl"]);
  await expect(page.getByTestId("sheet-hint")).toBeVisible();
  await expect(full(page)).toHaveCount(0);
  await tap(page, ["esc", "shift", "d6"]);
  await expect(sheet(page)).toBeVisible();
  await expect(full(page)).toHaveCount(0);
  await tap(page, ["esc", "shift", "d9"]);
  await expect(sheet(page)).toBeVisible();
  await expect(full(page)).toHaveCount(0);
  await tap(page, ["esc", "@mode"]);
  await expect(sheet(page)).toBeVisible();
  await expect(full(page)).toHaveCount(0);
});

test("Chars (Shift + Vars) has the button", async ({ page }) => {
  await tap(page, ["shift", "vars"]);
  await expect(sheet(page)).toBeVisible();
  await expect(full(page)).toHaveCount(1);
});
