// SPDX-License-Identifier: GPL-3.0-or-later
// R224 (docs/05 3.9, owner 2026-11-12, mh-C decision 5): the wide layout. On a landscape screen at least 1000 × 600 px
// (a tablet held sideways, a desktop window) the stage and the keypad stand side by side; a phone and a tablet held
// upright keep the one centred column, box for box. The keypad's grid does not change (docs/03 rule 8). No results mode
// side by side: the keypad covers no history there, so the line's swipe folds nothing. A rotation is a resize: no
// reload, the history and the engine stay. The fake engine.
import { expect, test, type Page } from "@playwright/test";
import { open, tap, touch } from "./helpers.ts";

type Box = [number, number, number, number];
const box = (page: Page, sel: string): Promise<Box> =>
  page.evaluate((s) => {
    const b = document.querySelector(s)?.getBoundingClientRect();
    if (!b) throw new Error(`${s} is not drawn`);
    return [b.x, b.y, b.width, b.height] as Box;
  }, sel);
const near = (got: Box, want: Box): void => {
  for (let i = 0; i < 4; i++) expect(Math.abs((got[i] ?? NaN) - (want[i] ?? NaN)), `${JSON.stringify(got)} against ${JSON.stringify(want)}`).toBeLessThanOrEqual(0.5);
};
const LINE = '[data-testid="entry"]';
const keys = (p: Page) => p.getByTestId("keys");

/** Side by side: the stage ends left of the keypad, nothing scrolls, every key is inside the viewport. */
async function sideBySide(page: Page): Promise<void> {
  const [stage, pad] = await Promise.all([box(page, ".stage"), box(page, ".keys")]);
  expect(stage[0] + stage[2]).toBeLessThanOrEqual(pad[0] + 0.5);
  const m = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("[data-key]")) {
      const r = el.getBoundingClientRect();
      if (r.left < 0 || r.top < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) out.push(el.dataset["key"] ?? "");
    }
    const s = document.scrollingElement as HTMLElement;
    return { outside: out, scroll: s.scrollHeight - s.clientHeight, keys: document.querySelectorAll("[data-key]").length };
  });
  expect(m.keys).toBeGreaterThan(40);
  expect(m.outside).toEqual([]);
  expect(m.scroll).toBe(0);
}

/** The keys row by row as drawn: each row's ids from left to right, rows from top to bottom (a key is in the row of its top edge). */
const rowsOfKeys = (page: Page): Promise<string[][]> =>
  page.evaluate(() => {
    const at = new Map<number, { x: number; id: string }[]>();
    for (const el of document.querySelectorAll<HTMLElement>("[data-key]")) {
      const r = el.getBoundingClientRect();
      const row = Number(el.style.gridRowStart || el.style.gridRow.split("/")[0]);
      at.set(row, [...(at.get(row) ?? []), { x: r.x, id: el.dataset["key"] ?? "" }]);
    }
    return [...at.entries()].sort((a, b) => a[0] - b[0]).map(([, ks]) => ks.sort((a, b) => a.x - b.x).map((k) => k.id));
  });
const keyOrder = (page: Page): Promise<string[]> => page.evaluate(() => [...document.querySelectorAll<HTMLElement>("[data-key]")].map((el) => el.dataset["key"] ?? ""));

for (const [width, height] of [[1340, 800], [1280, 800]] as const)
  test(`at ${width} × ${height} the stage and the keypad stand side by side, no scroll, every key on screen`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page);
    await sideBySide(page);
  });

test("the keypad's grid is the phone's: same key ids, same order, same rows, side by side as in the column", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await open(page);
  const [order, rows] = await Promise.all([keyOrder(page), rowsOfKeys(page)]);
  await page.setViewportSize({ width: 1340, height: 800 });
  await sideBySide(page);
  expect(await keyOrder(page)).toEqual(order);
  expect(await rowsOfKeys(page)).toEqual(rows);
  // each row's keys share their top edge in the wide layout too (the grid did not reflow)
  const tops = await page.evaluate(() => {
    const byRow = new Map<string, Set<number>>();
    for (const el of document.querySelectorAll<HTMLElement>("[data-key]")) {
      if (el.dataset["zone"]) continue; // the trackpad's zones are placed in its circle
      const row = el.style.gridRowStart || el.style.gridRow;
      byRow.set(row, (byRow.get(row) ?? new Set()).add(Math.round(el.getBoundingClientRect().top)));
    }
    return [...byRow.values()].map((s) => s.size);
  });
  expect(tops.every((n) => n === 1)).toBe(true);
});

// phase-1's boxes (measured 2026-11-13 at 4ee33b66): x, y, width, height of the stage and of the keypad's box
const COLUMN: Record<string, { stage: Box; keys: Box }> = {
  "412x915": { stage: [0, 28, 412, 319.40625], keys: [0, 427, 412, 488] },
  "800x1340": { stage: [40, 28, 720, 744.40625], keys: [40, 852, 720, 488] },
};
for (const [width, height] of [[412, 915], [800, 1340]] as const)
  test(`at ${width} × ${height} the layout is the one centred column, box for box`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page);
    const want = COLUMN[`${width}x${height}`]!;
    near(await box(page, ".stage"), want.stage);
    near(await box(page, ".keys"), want.keys);
  });

test("a rotation from 800 × 1340 to 1340 × 800 keeps the history and the engine, with no reload", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 1340 });
  await open(page);
  await tap(page, ["d1", "add", "d2", "enter", "d3", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(2);
  await page.evaluate(() => ((window as unknown as { r224: number }).r224 = 7)); // gone on a reload
  await page.setViewportSize({ width: 1340, height: 800 });
  await sideBySide(page);
  expect(await page.evaluate(() => (window as unknown as { r224?: number }).r224)).toBe(7);
  await expect(page.locator('[data-status="done"]')).toHaveCount(2);
  expect(await page.evaluate(() => window.n62.session.engineState)).toBe("ready");
  await tap(page, ["d4", "enter"]); // and it still answers
  await expect(page.locator('[data-status="done"]')).toHaveCount(3);
});

test.describe("no results mode side by side", () => {
  async function swipeDown(page: Page): Promise<void> {
    const f = await touch(page, LINE);
    await f.move(0, 40, 4);
    await f.end();
  }
  const ready = (page: Page) => expect(keys(page)).toHaveAttribute("data-fold-ready", "true");

  test("at 1340 × 800 a swipe down on the line folds nothing; the line keeps its text and caret", async ({ page }) => {
    await page.setViewportSize({ width: 1340, height: 800 });
    await open(page);
    await ready(page);
    await tap(page, ["d1", "d2", "d3", "left"]);
    const before = await page.evaluate(() => JSON.stringify(window.n62.entry.field?.selection.ranges));
    await swipeDown(page);
    await page.waitForTimeout(100);
    await expect(keys(page)).toHaveAttribute("data-folded", "false");
    await expect(page.getByTestId("fold-slice")).toHaveCount(0);
    expect(await page.evaluate(() => window.n62.entry.value)).toBe("123");
    expect(await page.evaluate(() => JSON.stringify(window.n62.entry.field?.selection.ranges))).toBe(before);
    await sideBySide(page);
  });

  test("at 800 × 1340 the swipe folds as today; turned to 1340 × 800 the keypad is up", async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 1340 });
    await open(page);
    await ready(page);
    await swipeDown(page);
    await expect(keys(page)).toHaveAttribute("data-folded", "true");
    await expect(page.getByTestId("fold-slice")).toBeVisible();
    await page.setViewportSize({ width: 1340, height: 800 });
    await expect(keys(page)).toHaveAttribute("data-folded", "false");
    await expect(page.getByTestId("fold-slice")).toHaveCount(0);
    await expect(page.locator('[data-key="d7"]')).toBeVisible();
    await sideBySide(page);
  });
});

test("Plot: turned from 800 × 1340 to 1340 × 800, the board fills its new box", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 1340 });
  await open(page);
  await page.evaluate(() => window.n62.shell.open("function", "plot"));
  await page.waitForFunction(() => window.n62.shell.loading === null);
  const canvas = page.locator(".plot .board canvas");
  await expect(canvas).toHaveCount(1);
  const fills = (): Promise<{ board: Box; canvas: Box }> =>
    page.evaluate(() => {
      const r = (el: Element | null): Box => {
        const b = el?.getBoundingClientRect();
        return b ? [b.x, b.y, b.width, b.height] : [NaN, NaN, NaN, NaN];
      };
      return { board: r(document.querySelector(".plot .board")), canvas: r(document.querySelector(".plot .board canvas")) };
    });
  const tall = await fills();
  near(tall.canvas, tall.board);
  await page.setViewportSize({ width: 1340, height: 800 });
  await sideBySide(page);
  await expect.poll(async () => {
    const f = await fills();
    return Math.max(...f.canvas.map((v, i) => Math.abs(v - (f.board[i] ?? NaN))));
  }).toBeLessThanOrEqual(0.5);
  const wide = await fills();
  expect(wide.board[2]).not.toBe(tall.board[2]); // the board did change size
});
