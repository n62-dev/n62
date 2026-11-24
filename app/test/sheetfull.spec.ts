// SPDX-License-Identifier: GPL-3.0-or-later
// R778 (owner, 2026-11-20; docs/05 3.1): a sheet that has no fixed size (a list that takes letters: Find, Vars, Units, any menu
// over 10 rows; Chars) has a small corner button, at its bottom right, that makes it fill the whole screen, keypad area
// included; the same button, Esc or Back returns it to the viewport. Tmpl, the Shift palettes and the short fixed lists have
// none. The state belongs to the open sheet. Expected values come from the rule: the box covers the viewport (0, 0, 360, 740);
// the button is a 44 px touch target at the sheet's bottom right. The fake engine, at 360 × 740.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

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

// R892 (owner-style hunt 2026-11-23, h1 #2): the corner button sits at the sheet's bottom right, so the list or grid keeps
// room for it: in the first view and scrolled to the end, no row or cell shows under the button, and a tap anywhere on a
// cell does what the cell says. Expected values come from the rule: the shown part of each row (its box clipped to the
// scroller's) and the button's box have no area in common.
const SCROLLER = '[role="menu"] :is(.list, .grid)';
/** The sheet's scroller scrolled to its very end, every row built (Find builds them as it scrolls). */
async function toEnd(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate((sel) => {
          const el = document.querySelector<HTMLElement>(sel);
          if (!el) return -1;
          el.scrollTop = el.scrollHeight;
          el.dispatchEvent(new Event("scroll"));
          if (document.querySelector('[data-testid="sheet-rest"]') !== null) return 1;
          return Math.round(el.scrollHeight - el.scrollTop - el.clientHeight);
        }, SCROLLER),
      { timeout: 5000 },
    )
    .toBe(0);
  await page.waitForTimeout(100);
}
/** The rows and cells shown under the corner button, each with the area in common in px² (none is the rule). */
const under = (page: Page): Promise<string[]> =>
  page.evaluate((sel) => {
    const b = document.querySelector("[data-sheet-full]")?.getBoundingClientRect();
    const s = document.querySelector(sel)?.getBoundingClientRect();
    if (!b || !s) return ["no button or no scroller"];
    const hit: string[] = [];
    for (const r of document.querySelectorAll('[role="menu"] [role="menuitem"]')) {
      const c = r.getBoundingClientRect();
      const w = Math.min(c.right, b.right, s.right) - Math.max(c.left, b.left, s.left);
      const h = Math.min(c.bottom, b.bottom, s.bottom) - Math.max(c.top, b.top, s.top);
      if (w > 0.5 && h > 0.5) hit.push(`${r.getAttribute("aria-label") ?? "?"} ${Math.round(w * h)}`);
    }
    return hit;
  }, SCROLLER);
/** The sheets with the button: Find (Math), Chars (Shift + Vars) and a 40-row list as Vars and Units open one (the fake
 *  engine's Vars key shows the store letters, which have no button). */
const SHEETS: ReadonlyArray<readonly [string, (page: Page) => Promise<void>]> = [
  ["Find", (page) => tap(page, ["math"])],
  ["Chars", (page) => tap(page, ["shift", "vars"])],
  ["a 40-row list", (page) => menu(page, 40)],
];

for (const [w, h] of [
  [360, 740],
  [412, 915],
] as const) {
  for (const [name, show] of SHEETS) {
    test(`R892: at ${w} × ${h}, ${name}: no row under the corner button, in the first view and scrolled to the end`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await show(page);
      await expect(sheet(page)).toBeVisible();
      await expect(full(page)).toHaveCount(1);
      await page.waitForTimeout(100);
      expect(await under(page)).toEqual([]);
      await toEnd(page);
      expect(await under(page)).toEqual([]);
      const button = await boxOf(page, "[data-sheet-full]"); // control: the button's size and corner as today
      const box = await boxOf(page, '[role="menu"]');
      expect(button.width).toBeGreaterThanOrEqual(44);
      expect(button.height).toBeGreaterThanOrEqual(44);
      expect(Math.abs(button.x + button.width - (box.x + box.width))).toBeLessThanOrEqual(1);
      expect(Math.abs(button.y + button.height - (box.y + box.height))).toBeLessThanOrEqual(1);
    });
  }
}

test("R892: at 360 × 740, Chars, a tap at the ‰ cell's centre-bottom types ‰ and leaves the sheet's size alone", async ({ page }) => {
  await tap(page, ["shift", "vars"]);
  await expect(full(page)).toHaveCount(1);
  const b = await sheet(page).locator('[role="menuitem"][aria-label*="‰"]').boundingBox();
  if (!b) throw new Error("the ‰ cell is not visible");
  const s = await boxOf(page, SCROLLER); // the cell's shown part: a cell cut by the grid's edge is tapped where it shows
  await page.touchscreen.tap(b.x + b.width / 2, Math.min(b.y + b.height, s.y + s.height) - 2);
  await expect.poll(() => entryValue(page)).toBe("‰");
  await expect(full(page)).toHaveCount(0); // the pick closed the sheet; a tap on the button would have filled the screen
});
