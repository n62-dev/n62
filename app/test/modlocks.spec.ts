// SPDX-License-Identifier: GPL-3.0-or-later
// R726 (decisions.md "Modifier locks"; owner 2026-11-17): a second Shift tap locks Shift as a second Alpha tap locks
// Alpha, a third ends it; the bar's ⇧/α sign is a button while Shift or Alpha is on, and a tap on it ends any of them.
// The sign counts nothing; an empty slot is not a button. The fake engine; the folded bar (R724).
import { expect, test, type Page } from "@playwright/test";
import { entryValue, flick, open, tap, touch } from "./helpers.ts";

const slot = (p: Page) => p.getByTestId("mod-slot");
const sign = (p: Page, which: "shift" | "alpha") => p.getByTestId(`mod-${which}`);
const shiftKey = (p: Page) => p.locator('[data-key="shift"]');
const counts = (p: Page) => p.evaluate(() => ({ shift: window.n62.session.taps.counts.shift, alpha: window.n62.session.taps.counts.alpha, presses: window.n62.session.taps.counts.presses }));
const mods = (p: Page) =>
  p.evaluate(() => {
    const s = window.n62.session;
    return { shift: s.shift, alpha: s.alpha, shiftLock: s.shiftLock, alphaLock: s.alphaLock, capsLock: s.capsLock };
  });
const OFF = { shift: false, alpha: false, shiftLock: false, alphaLock: false, capsLock: false };

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await open(page);
});

test("Shift, Shift locks Shift: the key and the sign show it, it stays after each key; a third tap ends it", async ({ page }) => {
  await tap(page, ["shift", "shift"]);
  await expect(shiftKey(page)).toHaveAttribute("data-locked", "true");
  await expect(sign(page, "shift")).toHaveAttribute("data-lock", "true");
  await tap(page, ["d3", "d2"]);
  expect(await entryValue(page)).toMatch(/\\pi.*\\imaginaryI/);
  await tap(page, ["shift", "d3"]);
  expect(await mods(page)).toEqual(OFF);
  expect(await entryValue(page)).toMatch(/\\pi.*\\imaginaryI.*3/);
});

test("Shift ×3 ends it: the next key types its own digit", async ({ page }) => {
  await tap(page, ["shift", "shift", "shift", "d3"]);
  expect(await entryValue(page)).toBe("3");
  expect(await mods(page)).toEqual(OFF);
});

test("with Alpha on, a second Shift tap flips the case again and does not lock", async ({ page }) => {
  await tap(page, ["alpha", "shift", "shift"]);
  expect(await mods(page)).toEqual({ ...OFF, alpha: true });
});

test("the flick up on Shift still locks, and a second one unlocks", async ({ page }) => {
  await flick(page, "shift", "up");
  expect(await mods(page)).toEqual({ ...OFF, shift: true, shiftLock: true });
  await flick(page, "shift", "up");
  expect(await mods(page)).toEqual(OFF);
});

const STATES: Record<string, string[]> = {
  "Shift armed": ["shift"],
  "Shift locked": ["shift", "shift"],
  "Alpha armed": ["alpha"],
  "Alpha locked": ["alpha", "alpha"],
  "the lower-case lock": ["shift", "alpha", "alpha"],
};
for (const [name, keys] of Object.entries(STATES))
  test(`a tap on the bar's sign ends ${name}: the slot empties and 3 types 3, and no Shift or Alpha tap is counted`, async ({ page }) => {
    await tap(page, keys);
    const before = await counts(page);
    const s = sign(page, keys[0] === "alpha" || keys.includes("alpha") ? "alpha" : "shift");
    await expect(s).toHaveAccessibleName(/on\. Double-tap to turn it off$/);
    await s.tap();
    await expect(slot(page).locator("button")).toHaveCount(0);
    await expect(slot(page)).toHaveText("");
    expect(await mods(page)).toEqual(OFF);
    // the Shift and Alpha counts stay (the sign is no Shift or Alpha tap); the tap is a screen press like any bar button's
    expect(await counts(page)).toEqual({ ...before, presses: before.presses + 1 });
    await tap(page, ["d3"]);
    expect(await entryValue(page)).toBe("3");
  });

test("a tap on the empty slot changes nothing and counts nothing", async ({ page }) => {
  const before = await counts(page);
  await slot(page).tap();
  expect(await mods(page)).toEqual(OFF);
  expect(await counts(page)).toEqual(before);
  expect(await entryValue(page)).toBe("");
});

test("folded: Shift, Shift, fold, a tap on the slot ends the lock; unfolded, 3 types 3", async ({ page }) => {
  await expect(page.getByTestId("keys")).toHaveAttribute("data-fold-ready", "true");
  await tap(page, ["shift", "shift"]);
  const f = await touch(page, '[data-testid="entry"]');
  await f.move(0, 40, 4);
  await f.end();
  await expect(page.getByTestId("keys")).toHaveAttribute("data-folded", "true");
  const fbar = page.locator('[data-testid="folded-bar"]');
  await expect(fbar.getByTestId("mod-shift")).toHaveAttribute("data-lock", "true");
  await fbar.getByTestId("mod-shift").tap();
  await expect(fbar.getByTestId("mod-shift")).toHaveCount(0);
  await page.getByTestId("fold-slice").tap();
  await expect(page.getByTestId("keys")).toHaveAttribute("data-folded", "false");
  await tap(page, ["d3"]);
  expect(await entryValue(page)).toBe("3");
});
