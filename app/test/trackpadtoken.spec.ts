// SPDX-License-Identifier: GPL-3.0-or-later
// R867 (owner, 2026-11-22, point 14): a sideways drag on the round pad steps over a whole number or name (a token: a run
// of digits, points and decimal commas, the ᴇ mark with its sign, a run of single letters on one level); the boxes of a
// template are still entered one by one, a chip, a function name with its bracket and an operator are one step each.
// Taps on ◀ ▶ stay one character; a hardware Ctrl+← → takes the drag's step. Offsets as MathLive 0.111 numbers them
// (entry/boxes.ts); the line is set as linetouch.spec.ts sets it, the cursor at 0.
import { expect, test, type Page } from "@playwright/test";
import { drag, entryValue, open, tap } from "./helpers.ts";

/** `latex` on the line, the cursor at its start (`end`: at its end). */
async function setLine(page: Page, latex: string, end = false): Promise<void> {
  await page.evaluate(
    ([l, e]) => {
      const mf = window.n62.entry.field;
      if (!mf) throw new Error("no field");
      mf.value = l as string;
      mf.focus();
      mf.executeCommand(e ? "moveToMathfieldEnd" : "moveToMathfieldStart");
    },
    [latex, end] as const,
  );
  await page.waitForTimeout(150);
}
const caret = (page: Page): Promise<number> => page.evaluate(() => window.n62.entry.field?.position ?? -1);
const last = (page: Page): Promise<number> => page.evaluate(() => window.n62.entry.field?.lastOffset ?? -1);

/** The caret before the first step and after each drag step `dir` (one 13 px drag each), until it stops moving. */
async function visits(page: Page, dir: "right" | "left"): Promise<number[]> {
  const out = [await caret(page)];
  for (let i = 0; i < 30; i++) {
    await drag(page, dir, dir === "right" ? 13 : -13, 0);
    const c = await caret(page);
    if (c === out[out.length - 1]) break;
    out.push(c);
  }
  return out;
}

test.beforeEach(async ({ page }) => {
  await open(page);
});

test("(a) a number is one drag step, the next one the operator; (g) dragging back crosses it again", async ({ page }) => {
  await setLine(page, "0.98934893284+x");
  expect(await last(page)).toBe(15);
  await drag(page, "right", 13, 0);
  expect(await caret(page)).toBe(13);
  await drag(page, "right", 13, 0);
  expect(await caret(page)).toBe(14);
  // (g) three steps left from the end: x, +, the number
  await setLine(page, "0.98934893284+x", true);
  for (let i = 0; i < 3; i++) await drag(page, "left", -13, 0);
  expect(await caret(page)).toBe(0);
});

test("(a) control: a ▶ tap still moves one character, ◀ one back", async ({ page }) => {
  await setLine(page, "0.98934893284+x");
  await tap(page, ["right"]);
  expect(await caret(page)).toBe(1);
  await tap(page, ["right", "left"]);
  expect(await caret(page)).toBe(1);
});

test("(b) 6.022ᴇ-23 typed with the keys: the steps stop before ᴇ, after ᴇ-, at the end", async ({ page }) => {
  await tap(page, ["d6", "dot", "d0", "d2", "d2", "emark", "sub", "d2", "d3"]);
  expect(await entryValue(page)).toBe("6.022\\emark-23");
  const end = await caret(page);
  await page.evaluate(() => window.n62.entry.field?.executeCommand("moveToMathfieldStart"));
  const seen = await visits(page, "right");
  expect(seen).toHaveLength(4);
  expect(seen[0]).toBe(0);
  expect(seen[1]).toBe(5); // 6.022, before the mark
  expect(seen[3]).toBe(end);
  const atAfter = await page.evaluate((o) => window.n62.entry.field?.getElementInfo(o)?.latex, seen[2] ?? -1);
  expect(atAfter).toBe("-"); // after ᴇ-
  // and back the same way
  expect(await visits(page, "left")).toEqual([...seen].reverse());
});

test("(c) a fraction: each box entered, a number in it crossed at once", async ({ page }) => {
  await setLine(page, "\\frac{12}{345}+2");
  expect(await visits(page, "right")).toEqual([0, 1, 3, 4, 7, 8, 9, 10]);
});

test("(d) a power: the steps enter the exponent and cross 10 in one step", async ({ page }) => {
  await setLine(page, "2^{10}+3");
  const seen = await visits(page, "right");
  expect(seen).toEqual([0, 1, 2, 4, 5, 6, 7]);
});

test("(e) a number before a unit chip: 0, 4, 9, 10, 11, never inside the chip", async ({ page }) => {
  await setLine(page, "9.81\\unit{m}{\\mathrm{m}}+1");
  expect(await visits(page, "right")).toEqual([0, 4, 9, 10, 11]);
});

test("(f) a run of letters is one step", async ({ page }) => {
  await setLine(page, "abc+12");
  expect(await visits(page, "right")).toEqual([0, 3, 4, 6]);
  expect(await visits(page, "left")).toEqual([6, 4, 3, 0]);
});

test("(h) a hardware Ctrl+→ takes the drag's step, Ctrl+← back", async ({ page }) => {
  await setLine(page, "0.98934893284+x");
  await page.keyboard.press("Control+ArrowRight");
  expect(await caret(page)).toBe(13);
  await page.keyboard.press("Control+ArrowLeft");
  expect(await caret(page)).toBe(0);
  // a plain arrow stays one character
  await page.keyboard.press("ArrowRight");
  expect(await caret(page)).toBe(1);
});
