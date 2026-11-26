// SPDX-License-Identifier: GPL-3.0-or-later
// R928 (owner, 2026-11-23, bug list 4 point 4): ⌄ folds the keys in Function's Plot view too (App.svelte canFold), so the
// graph gets the screen; the graph keeps its units per pixel (FunctionPlot.svelte's resize: ymax and x stay, the y span grows
// with the board). ⌃ and Android back unfold; Symb and Num have no fold, so their tabs in the folded bar unfold. The
// in-app folded bar: ⌃, Home, slot 2, the app's views (Symb, Plot, Num), the ⇧ α slot, the angle word, ☰ (spec/layout-lock.yaml
// `folded-bar-app:`). The real engine (the trace's y and Signed area are its numbers).
import { expect, test, type Page } from "@playwright/test";
import { FOLDED_APP_BAR_ITEMS } from "../src/views/barItems.ts";
import { open, sheet, tap } from "./helpers.ts";

const keys = (p: Page) => p.getByTestId("keys");
const isFolded = (p: Page, on: boolean) => expect(keys(p)).toHaveAttribute("data-folded", String(on));
const chevron = (p: Page) => p.getByTestId("fold-chevron");
type Box = [number, number, number, number];
/** The board's window [xmin, ymax, xmax, ymin] and its canvas height. */
const win = (p: Page) =>
  p.evaluate(() => {
    const b = window.n62.plot.board as unknown as { getBoundingBox(): Box; canvasHeight: number };
    return { bb: b.getBoundingBox(), h: b.canvasHeight };
  });
/** The window the app saved (FunctionApp.setWindow). */
const saved = (p: Page) =>
  p.evaluate(() => (window.n62.shell as unknown as { current: { instance: { win: { ymin: number; ymax: number } | null } } }).current.instance.win);
const boardHeight = async (p: Page): Promise<number> => (await p.locator(".board").boundingBox())?.height ?? 0;

/** F1(x) = x² from Home, then Plot, drawn. */
async function plot(p: Page): Promise<void> {
  await tap(p, ["@symb"]);
  await expect(p.getByTestId("entry-label")).toHaveText("F1(x)=");
  await tap(p, ["x", "sq", "enter", "@plot"]);
  await p.waitForFunction(() => window.n62.plot.board !== undefined && window.n62.shell.loading === null);
  await expect(keys(p)).toHaveAttribute("data-fold-ready", "true");
}
async function foldByTap(p: Page): Promise<void> {
  await chevron(p).tap();
  await isFolded(p, true);
}

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
});

for (const [width, height] of [[360, 740], [412, 915]] as const)
  test.describe(`at ${width} × ${height}`, () => {
    test.use({ viewport: { width, height } });

    test("Plot shows ⌄; a tap folds, the board gets the screen and keeps its units per pixel; ⌃ brings the window back", async ({ page }) => {
      await plot(page);
      await expect(chevron(page)).toBeVisible();
      const before = await win(page);
      await foldByTap(page);
      const tall = await boardHeight(page);
      console.log(`R928 board at ${width} × ${height}: ${before.h} px up, ${tall} px folded`);
      if (width === 360) expect(tall).toBeGreaterThanOrEqual(600);
      await expect.poll(async () => (await win(page)).h).toBeGreaterThan(before.h + 300);
      const after = await win(page);
      const [x0, y0, x1, y1] = before.bb;
      const [u0, v0, u1, v1] = after.bb;
      expect(u0).toBeCloseTo(x0, 6); // x unchanged
      expect(u1).toBeCloseTo(x1, 6);
      expect(v0).toBeCloseTo(y0, 6); // ymax stays
      expect((v0 - v1) / after.h).toBeCloseTo((y0 - y1) / before.h, 6); // the y units per pixel stay: the span grows by hNew/hOld
      await expect.poll(async () => (await saved(page))?.ymin).toBeCloseTo(v1, 6); // saved (app.setWindow)
      await page.getByTestId("fold-slice").tap(); // ⌃
      await isFolded(page, false);
      await expect.poll(async () => (await win(page)).h).toBe(before.h);
      const back = (await win(page)).bb;
      for (let i = 0; i < 4; i++) expect(back[i]).toBeCloseTo(before.bb[i]!, 6); // the old window, as it was
    });

    test("the in-app folded bar: ⌃, Home, slot 2, Symb Plot Num, the angle word and ☰ fit the width, none over another", async ({ page }) => {
      await plot(page);
      const upX: Record<string, number> = {};
      for (const id of ["tab-symb", "tab-plot", "tab-num", "chip-angle", "menu-button"]) upX[id] = (await page.getByTestId("bar").getByTestId(id).boundingBox())!.x;
      await foldByTap(page);
      const bar = page.getByTestId("folded-bar");
      const items = await bar.locator("[data-item]").evaluateAll((els) =>
        els.filter((e) => (e as HTMLElement).checkVisibility({ visibilityProperty: true })).map((e) => ({ n: (e as HTMLElement).dataset["item"], r: e.getBoundingClientRect() })).filter((e) => e.r.width > 0).sort((a, b) => a.r.x - b.r.x));
      expect(items.map((e) => e.n)).toEqual([...FOLDED_APP_BAR_ITEMS]); // the lock's folded-bar-app:, left to right
      for (const [i, e] of items.entries()) {
        expect(e.r.x, e.n).toBeGreaterThanOrEqual(0);
        expect(e.r.right, e.n).toBeLessThanOrEqual(width + 0.5);
        expect(e.r.width, e.n).toBeGreaterThanOrEqual(28); // a target
        const next = items[i + 1];
        if (next) expect(e.r.right, `${e.n} | ${next.n}`).toBeLessThanOrEqual(next.r.x + 0.5);
      }
      // the views stand where they do open (R856: every control at one x, open or folded)
      for (const id of ["tab-symb", "tab-plot", "tab-num", "chip-angle", "menu-button"]) expect((await bar.getByTestId(id).boundingBox())!.x, id).toBeCloseTo(upX[id]!, 0);
      await expect(bar.getByTestId("tab-plot")).toHaveAttribute("aria-selected", "true");
    });
  });

// (Esc: a hardware key reaches nothing in Plot, folded or not: the line, which hears the keys, is not drawn there and the focus
// is on the page; R928's report)
test("back unfolds in Plot, a second back closes the app (R926)", async ({ page }) => {
  await plot(page);
  await foldByTap(page);
  await page.goBack();
  await isFolded(page, false);
  expect(await page.evaluate(() => window.n62.shell.app)).toBe("function");
  await page.goBack();
  await expect.poll(() => page.evaluate(() => window.n62.shell.app)).toBeNull();
});

for (const view of ["symb", "num"] as const)
  test(`folded, the ${view === "symb" ? "Symb" : "Num"} tab opens its view with the keys up; it has no ⌄`, async ({ page }) => {
    await plot(page);
    await foldByTap(page);
    await page.getByTestId("folded-bar").getByTestId(`tab-${view}`).tap();
    await isFolded(page, false);
    await expect(page.getByTestId("place")).toHaveAttribute("data-view", view);
    await expect(chevron(page)).toHaveCount(0);
  });

// R928f1: the folded window is saved with its board height; Plot opening again with the keys up (after Symb, or a reload: the
// observer was gone when the keys came up) scales it back to the board's height, so the graph keeps its scale.
for (const via of ["symb", "reload"] as const)
  test(`folded, then ${via === "symb" ? "Symb" : "a reload"} and Plot again with the keys up: the window is the unfolded one`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await plot(page);
    const before = await win(page);
    await foldByTap(page);
    await expect.poll(async () => (await win(page)).h).toBeGreaterThan(before.h + 300);
    const folded = (await win(page)).bb;
    await expect.poll(async () => (await saved(page))?.ymin).toBeCloseTo(folded[3], 6);
    if (via === "symb") {
      await page.getByTestId("folded-bar").getByTestId("tab-symb").tap();
      await isFolded(page, false);
      await tap(page, ["@plot"]);
    } else {
      await page.evaluate(() => window.n62.shell.flush());
      await page.waitForTimeout(300);
      await page.reload();
      await page.waitForFunction(() => window.n62?.shell?.current !== undefined, undefined, { timeout: 20_000 });
      await expect(page.getByTestId("place")).toHaveAttribute("data-view", "plot");
      await isFolded(page, false);
    }
    await page.waitForFunction(() => window.n62.plot.board !== undefined && window.n62.shell.loading === null);
    const again = await win(page);
    expect(again.h).toBe(before.h);
    for (let i = 0; i < 4; i++) expect(again.bb[i]).toBeCloseTo(before.bb[i]!, 6);
  });

test("folded, ☰ › Signed area, a tap on the graph moves the trace, ⌃ and Enter finish it", async ({ page }) => {
  await plot(page);
  await foldByTap(page);
  await page.getByTestId("menu-button").tap();
  await sheet(page).locator('[data-id="area"]').tap(); // it starts at the trace, x = 0
  await expect(sheet(page)).toBeHidden();
  await isFolded(page, true);
  // a tap on the board at x = 1, by the board's own scale (the canvas is the board's box)
  const px = await page.evaluate(() => {
    const b = window.n62.plot.board as unknown as { getBoundingBox(): Box; canvasWidth: number };
    const [x0, , x1] = b.getBoundingBox();
    return ((1 - x0) / (x1 - x0)) * b.canvasWidth;
  });
  const board = (await page.locator(".board").boundingBox())!;
  await page.touchscreen.tap(board.x + px, board.y + board.height / 3);
  await expect.poll(async () => Number(await page.getByTestId("trace-x").textContent())).toBeCloseTo(1, 1);
  const b = Number(await page.getByTestId("trace-x").textContent());
  await page.getByTestId("fold-slice").tap();
  await isFolded(page, false);
  await tap(page, ["enter"]);
  await expect.poll(async () => Number(await page.getByTestId("readout-Signed area").textContent())).toBeCloseTo(b ** 3 / 3, 6); // ∫₀ᵇ x² dx (derived)
});

/** Fingers on the board through CDP: `from` and `to` are pairs of points (board fractions); one point is a pan, two a pinch. */
async function fingers(p: Page, from: [number, number][], to: [number, number][]): Promise<void> {
  const b = (await p.locator(".board").boundingBox())!;
  const pts = (q: [number, number][]) => q.map(([fx, fy], i) => ({ x: Math.round(b.x + fx * b.width), y: Math.round(b.y + fy * b.height), id: i + 1 }));
  const cdp = await p.context().newCDPSession(p);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pts(from) });
  for (let i = 1; i <= 8; i++) {
    const mid = from.map(([x, y], k) => [x + ((to[k]![0] - x) * i) / 8, y + ((to[k]![1] - y) * i) / 8] as [number, number]);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pts(mid) });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

for (const fold of [false, true])
  test(`control: Plot's pan and pinch work ${fold ? "folded" : "with the keys up"}`, async ({ page }) => {
    await plot(page);
    if (fold) await foldByTap(page);
    await expect.poll(async () => (await win(page)).h).toBe(await page.evaluate(() => document.querySelector(".board")?.clientHeight)); // the resize is in
    const a = (await win(page)).bb;
    await fingers(page, [[0.5, 0.5]], [[0.3, 0.5]]); // a pan to the left: the window moves right, its spans stay
    await expect.poll(async () => (await win(page)).bb[0]).toBeGreaterThan(a[0] + 0.5);
    const b = (await win(page)).bb;
    expect(b[2] - b[0]).toBeCloseTo(a[2] - a[0], 6);
    expect(b[1] - b[3]).toBeCloseTo(a[1] - a[3], 6);
    await fingers(page, [[0.4, 0.5], [0.6, 0.5]], [[0.2, 0.5], [0.8, 0.5]]); // a pinch out: it zooms in
    await expect.poll(async () => { const c = (await win(page)).bb; return c[2] - c[0]; }).toBeLessThan(0.8 * (b[2] - b[0]));
    await isFolded(page, fold);
  });
