// SPDX-License-Identifier: GPL-3.0-or-later
// R277 (owner, 2026-11-10): the entry line under a finger. A sideways drag scrolls a line wider than the field and leaves
// the caret where it was (no selection); a tap puts the caret at the touched term; a hold selects that term, and the keys
// act on it (⌫ deletes it, x² raises it); a hold on empty space or an operator selects nothing. A mouse drag still
// selects (fold.spec.ts). Synthetic touches through CDP; the fake engine. The drag test also pins our one write into
// MathLive's shadow DOM (field.ts scrollLine): it fails when `[part=content]` is gone or its scrollLeft no longer moves
// the drawn line, so a MathLive update shows here first.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

interface Box { left: number; right: number; top: number; bottom: number }

/** One finger at (x, y): down, `ms` still, then a slide by (dx, dy) in `steps`, then up. */
async function finger(page: Page, x: number, y: number, how: { ms?: number; dx?: number; dy?: number; steps?: number } = {}): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const at = (u: number, v: number) => [{ x: Math.round(x + u), y: Math.round(y + v), id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at(0, 0) });
  if (how.ms) await page.waitForTimeout(how.ms);
  const steps = how.steps ?? 10;
  if (how.dx || how.dy)
    for (let i = 1; i <= steps; i++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: at(((how.dx ?? 0) * i) / steps, ((how.dy ?? 0) * i) / steps) });
      await page.waitForTimeout(16);
    }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}
const hold = (page: Page, p: { x: number; y: number }) => finger(page, p.x, p.y, { ms: 700 });

/** `latex` on the line, the caret at its end; then past MathLive's double-tap time. */
async function setLine(page: Page, latex: string): Promise<void> {
  await page.evaluate((l) => {
    const mf = window.n62.entry.field;
    if (!mf) throw new Error("no field");
    mf.value = l;
    mf.focus();
    mf.executeCommand("moveToMathfieldEnd");
  }, latex);
  await page.waitForTimeout(150);
}

/** The drawn box of the atom at offset `o` (after a render: MathLive keeps bounds from one, lineTouch.ts rerender). */
const boxOf = (page: Page, o: number): Promise<Box> =>
  page.evaluate(async (k) => {
    const mf = window.n62.entry.field;
    if (!mf) throw new Error("no field");
    mf.minFontScale = mf.minFontScale;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const b = mf.getElementInfo(k)?.bounds;
    if (!b) throw new Error(`no bounds at ${k}`);
    return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
  }, o);
/** Where the drawn line starts (its first glyph's box in the shadow DOM, read as it is drawn). */
const drawnLeft = (page: Page): Promise<number> =>
  page.evaluate(() => window.n62.entry.field?.shadowRoot?.querySelector(".ML__latex")?.getBoundingClientRect().left ?? NaN);
const mid = (b: Box) => ({ x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 });
const ranges = (page: Page) => page.evaluate(() => JSON.stringify(window.n62.entry.field?.selection.ranges));
const caret = (page: Page) => page.evaluate(() => window.n62.entry.field?.position ?? -1);
const collapsed = (page: Page) => page.evaluate(() => window.n62.entry.field?.selectionIsCollapsed ?? false);
const scrolled = (page: Page) =>
  page.evaluate(() => {
    const c = window.n62.entry.field?.shadowRoot?.querySelector<HTMLElement>("[part=content]");
    return c ? { left: c.scrollLeft, room: c.scrollWidth - c.clientWidth } : undefined;
  });
const field = async (page: Page): Promise<Box> => {
  const b = await page.locator('[data-testid="entry"] math-field').boundingBox();
  if (!b) throw new Error("no field");
  return { left: b.x, right: b.x + b.width, top: b.y, bottom: b.y + b.height };
};

const LONG = "1234567890".repeat(6);

test.beforeEach(async ({ page }) => {
  await open(page);
});

test("a sideways drag scrolls a long line with the finger and leaves the caret and the selection as they were", async ({ page }) => {
  await setLine(page, LONG);
  const end = await caret(page);
  const s0 = await scrolled(page);
  // MathLive's scroller is there and the line is wider than the field (scrolled to its end, where the caret is)
  expect(s0, "MathLive's [part=content] (field.ts scrollLine)").toBeDefined();
  expect(s0?.room ?? 0).toBeGreaterThan(200);
  expect(s0?.left ?? 0).toBeGreaterThan(200);
  const first0 = await drawnLeft(page);
  const f = await field(page);
  await finger(page, (f.left + f.right) / 2, (f.top + f.bottom) / 2, { dx: 150, steps: 15 });
  const s1 = await scrolled(page);
  const moved = (s0?.left ?? 0) - (s1?.left ?? 0);
  // the line follows the finger (less the 8 px slop), and the drawn line moves by what scrollLeft says
  expect(moved).toBeGreaterThan(120);
  expect(moved).toBeLessThanOrEqual(150);
  expect((await drawnLeft(page)) - first0).toBeCloseTo(moved, 0);
  expect(await collapsed(page)).toBe(true);
  expect(await caret(page)).toBe(end);
  await expect(page.getByTestId("keys")).toHaveAttribute("data-folded", "false");
  // back the other way
  await finger(page, (f.left + f.right) / 2, (f.top + f.bottom) / 2, { dx: -100, steps: 10 });
  expect((s1?.left ?? 0) - ((await scrolled(page))?.left ?? 0)).toBeLessThan(-70);
  expect(await collapsed(page)).toBe(true);
  // a key types at the caret, which never moved: the line scrolls back to it
  await tap(page, ["d0"]);
  expect(await entryValue(page)).toBe(`${LONG}0`);
});

test("a tap puts the caret at the touched term, on a scrolled line too", async ({ page }) => {
  await setLine(page, "123+456");
  const five = await boxOf(page, 6); // the 5
  await finger(page, five.right - 2, (five.top + five.bottom) / 2);
  await expect.poll(() => caret(page)).toBe(6);
  await tap(page, ["d9"]);
  expect(await entryValue(page)).toBe("123+4596");
  // a long line scrolled to its start: a tap on its tenth digit puts the caret after it
  await setLine(page, LONG);
  const f = await field(page);
  for (let k = 0; k < 2; k++) await finger(page, f.left + 20, (f.top + f.bottom) / 2, { dx: f.right - f.left - 40, steps: 20 });
  expect((await scrolled(page))?.left).toBe(0);
  const tenth = await boxOf(page, 10);
  await page.waitForTimeout(550);
  await finger(page, tenth.right - 2, (tenth.top + tenth.bottom) / 2);
  await expect.poll(() => caret(page)).toBe(10);
  expect(await collapsed(page)).toBe(true);
});

test("a hold selects the term under the finger; ⌫ deletes it, x² raises it", async ({ page }) => {
  // a number with its ᴇ part: 2+1.5ᴇ-3×4 (offsets: 1 2, 2 +, 3 1, 4 ., 5 5, 6-9 the mark's parts, 10 the mark, 11 -, 12 3, 13 ×, 14 4)
  await setLine(page, "2+1.5\\emark-3\\times4");
  await hold(page, mid(await boxOf(page, 5)));
  await expect.poll(() => ranges(page)).toBe("[[2,12]]");
  await tap(page, ["bksp"]);
  expect(await entryValue(page)).toBe("2+\\times4");
  // the same from its exponent, then x² brackets it (R17)
  await setLine(page, "2+1.5\\emark-3\\times4");
  await hold(page, mid(await boxOf(page, 12)));
  await expect.poll(() => ranges(page)).toBe("[[2,12]]");
  await tap(page, ["sq"]);
  expect(await entryValue(page)).toBe("2+\\left(1.5\\emark-3\\right)^2\\times4");
});

test("a hold on a function's name takes its bracket, on a root's sign the root, on a chip the chip", async ({ page }) => {
  // 5\sin\left(23\right)+1: 1 5, 2 \sin, 3-5 the body, 6 the pair, 7 +, 8 1
  await setLine(page, "5\\sin\\left(23\\right)+1");
  await hold(page, mid(await boxOf(page, 2)));
  await expect.poll(() => ranges(page)).toBe("[[1,6]]");
  // inside the bracket: the number there
  await setLine(page, "5\\sin\\left(23\\right)+1");
  await hold(page, mid(await boxOf(page, 4)));
  await expect.poll(() => ranges(page)).toBe("[[3,5]]");
  // \sqrt{2}x: the sign is left of the radicand's box: 1-2 the radicand, 3 the root, 4 x
  await setLine(page, "\\sqrt{2}x");
  const root = await boxOf(page, 3);
  await hold(page, { x: root.left + 3, y: (root.top + root.bottom) / 2 });
  await expect.poll(() => ranges(page)).toBe("[[0,3]]");
  // a result chip (R16): one term
  await page.evaluate(() => window.n62.entry.clear());
  await page.evaluate(() => window.n62.entry.insertResult("7", { value: "7", exact: true }));
  await page.evaluate(() => window.n62.entry.insert("+1"));
  await page.waitForTimeout(150);
  const chip = await page.evaluate(() => {
    const mf = window.n62.entry.field;
    for (let o = 1; mf && o <= mf.lastOffset; o++) if ((mf.getElementInfo(o)?.latex ?? "").startsWith("\\res")) return o;
    return -1;
  });
  expect(chip).toBeGreaterThan(0);
  await hold(page, mid(await boxOf(page, chip)));
  await expect.poll(() => ranges(page)).toBe(`[[0,${chip}]]`);
});

test("a hold on empty space or on an operator selects nothing and leaves the caret", async ({ page }) => {
  await setLine(page, "12+34");
  const f = await field(page);
  const last = await boxOf(page, 5);
  await hold(page, { x: Math.min(f.right - 4, last.right + 40), y: (last.top + last.bottom) / 2 });
  await page.waitForTimeout(100);
  expect(await collapsed(page)).toBe(true);
  expect(await caret(page)).toBe(5);
  await hold(page, mid(await boxOf(page, 3)));
  await page.waitForTimeout(100);
  expect(await collapsed(page)).toBe(true);
  expect(await caret(page)).toBe(5);
});
