// SPDX-License-Identifier: GPL-3.0-or-later
// R778 (owner, 2026-11-20; docs/05 3.1): a sheet that has no fixed size (a list that takes letters: Find, Vars, Units, any menu
// over 10 rows) has a small button that makes it fill the whole screen, keypad area included; the same button, Esc or Back
// returns it to the viewport. Tmpl, the Shift palettes, Chars and the short fixed lists have none. The state belongs to the open
// sheet. R931 (owner, 2026-11-24): the button sits in the sheet's title row, left of ×, full or not; Chars has none. Expected
// values come from the rule: the box covers the viewport (0, 0, 360, 740); the button is a 44 px touch target whose centre and
// drawn mark lie in the title row, left of ×. The fake engine, at 360 × 740.
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
/** R931: the button is a ≥ 44 × 44 target in the list's title row, between the count and ×: its centre and its drawn mark lie
 *  inside the row's box, its right edge left of ×'s left edge. Returns what does not hold (none is the rule). */
const inHead = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const menu = document.querySelector('[role="menu"]');
    const head = menu?.querySelector(":scope > .head")?.getBoundingClientRect();
    const button = document.querySelector("[data-sheet-full]");
    const b = button?.getBoundingClientRect();
    const mark = button?.querySelector("svg")?.getBoundingClientRect();
    const close = menu?.querySelector(":scope > .head > button:last-child")?.getBoundingClientRect();
    if (!head || !b || !mark || !close) return ["no title row, button, mark or ×"];
    const bad: string[] = [];
    const inside = (x: number, y: number) => x >= head.left - 0.5 && x <= head.right + 0.5 && y >= head.top - 0.5 && y <= head.bottom + 0.5;
    if (b.width < 44 || b.height < 44) bad.push(`target ${Math.round(b.width)} × ${Math.round(b.height)}`);
    if (!inside(b.left + b.width / 2, b.top + b.height / 2)) bad.push("centre outside the title row");
    if (!inside(mark.left, mark.top) || !inside(mark.right, mark.bottom)) bad.push("mark outside the title row");
    if (b.right > close.left + 0.5) bad.push(`right of ×'s left edge by ${Math.round(b.right - close.left)}`);
    if (button === menu?.querySelector(":scope > .head > button:last-child")) bad.push("the button is ×");
    return bad;
  });

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: W, height: H });
  await open(page);
});

test("Math's Find sheet has the fill button in its title row: a tap fills the screen, the same button restores it", async ({ page }) => {
  await tap(page, ["math"]);
  await expect(page.getByTestId("find")).toBeVisible();
  await expect(full(page)).toHaveCount(1);
  const small = await boxOf(page, '[role="menu"]');
  expect(covers(small)).toBe(false);
  expect(await inHead(page)).toEqual([]);
  await full(page).tap();
  expect(covers(await boxOf(page, '[role="menu"]'))).toBe(true);
  expect(await inHead(page)).toEqual([]); // full, the title row keeps it (the unfill mark)
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

test("R931: Chars (Shift + Vars) has no fill button", async ({ page }) => {
  await tap(page, ["shift", "vars"]);
  await expect(sheet(page)).toBeVisible();
  await expect(page.getByTestId("sheet-hint")).toBeVisible(); // control: the Chars grid is drawn
  await expect(full(page)).toHaveCount(0);
});

/** The sheets with the button: Find (Math), a 40-row list as Vars opens one and a 12-row Units menu (the fake engine's Vars
 *  key shows the store letters, which have no button). */
const SHEETS: ReadonlyArray<readonly [string, (page: Page) => Promise<void>]> = [
  ["Find", (page) => tap(page, ["math"])],
  ["a 40-row list", (page) => menu(page, 40)],
  ["a 12-row Units menu", (page) => menu(page, 12)],
];
const SIZES = [
  [360, 740],
  [412, 915],
] as const;

for (const [w, h] of SIZES) {
  for (const [name, show] of SHEETS) {
    test(`R931: at ${w} × ${h}, ${name}: the fill button sits in the title row left of ×, small and full; a tap, then Esc, returns it`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await show(page);
      await expect(sheet(page)).toBeVisible();
      await expect(full(page)).toHaveCount(1);
      expect(await inHead(page)).toEqual([]);
      await expect(full(page)).toHaveAttribute("aria-pressed", "false");
      await full(page).tap();
      const big = await boxOf(page, '[role="menu"]');
      expect(big.width).toBeGreaterThanOrEqual(w - 0.5);
      expect(big.height).toBeGreaterThanOrEqual(h - 0.5);
      expect(await inHead(page)).toEqual([]);
      await expect(full(page)).toHaveAttribute("aria-pressed", "true");
      await full(page).tap();
      await expect(full(page)).toHaveAttribute("aria-pressed", "false");
      await full(page).tap();
      await page.keyboard.press("Escape");
      await expect(sheet(page)).toBeVisible();
      await expect(full(page)).toHaveAttribute("aria-pressed", "false");
      expect(await inHead(page)).toEqual([]);
    });
  }
}

test("R931: at 360 × 740, Find shows rows 1 to 5 in the first view; no empty band under the list", async ({ page }) => {
  await tap(page, ["math"]);
  await expect(page.getByTestId("find")).toBeVisible();
  await page.waitForTimeout(100);
  const shown = await page.evaluate(() => {
    const list = document.querySelector('[role="menu"] .list')?.getBoundingClientRect();
    if (!list) return -1;
    let n = 0;
    for (const r of document.querySelectorAll('[role="menu"] .list [role="menuitem"]')) {
      const c = r.getBoundingClientRect();
      if (c.top >= list.top - 0.5 && c.bottom <= list.bottom + 0.5) n++;
    }
    return n;
  });
  expect(shown).toBeGreaterThanOrEqual(5);
  const pad = await sheet(page).evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
  expect(pad).toBeLessThan(44); // R892's --touch strip is gone
});

// R892 (owner-style hunt 2026-11-23, h1 #2): in the first view and scrolled to the end, no row or cell shows under the fill
// button, and a tap anywhere on a cell does what the cell says. R931 moved the button into the title row, so the rule holds
// with no strip under the list. Expected values come from the rule: the shown part of each row (its box clipped to the
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
/** The rows and cells shown under the fill button, each with the area in common in px² (none is the rule). */
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
for (const [w, h] of SIZES) {
  for (const [name, show] of SHEETS) {
    test(`R892: at ${w} × ${h}, ${name}: no row under the fill button, in the first view and scrolled to the end`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await show(page);
      await expect(sheet(page)).toBeVisible();
      await expect(full(page)).toHaveCount(1);
      await page.waitForTimeout(100);
      expect(await under(page)).toEqual([]);
      await toEnd(page);
      expect(await under(page)).toEqual([]);
      expect(await inHead(page)).toEqual([]); // control: the button's size and place (R931)
    });
  }
}

test("R892: at 360 × 740, Chars, a tap at the ‰ cell's centre-bottom types ‰", async ({ page }) => {
  await tap(page, ["shift", "vars"]);
  await expect(sheet(page)).toBeVisible();
  await expect(full(page)).toHaveCount(0); // R931: Chars has no fill button
  const b = await sheet(page).locator('[role="menuitem"][aria-label*="‰"]').boundingBox();
  if (!b) throw new Error("the ‰ cell is not visible");
  const s = await boxOf(page, SCROLLER); // the cell's shown part: a cell cut by the grid's edge is tapped where it shows
  await page.touchscreen.tap(b.x + b.width / 2, Math.min(b.y + b.height, s.y + s.height) - 2);
  await expect.poll(() => entryValue(page)).toBe("‰");
  await expect(sheet(page)).toHaveCount(0); // the pick closed the sheet
});
