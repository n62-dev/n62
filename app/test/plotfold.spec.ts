// SPDX-License-Identifier: GPL-3.0-or-later
// R928 (owner, 2026-11-23, bug list 4 point 4): ⌄ folds the keys in Function's Plot view too (App.svelte canFold), so the
// graph gets the screen; the graph keeps its units per pixel (FunctionPlot.svelte's resize: ymax and x stay, the y span grows
// with the board). ⌃, Esc and Android back unfold; Symb and Num have no fold, so their tabs in the folded bar unfold. The
// in-app folded bar: ⌃, Home, slot 2, the app's views (Symb, Plot, Num), the ⇧ α slot, the angle word, ☰ (spec/layout-lock.yaml
// `folded-bar-app:`). The real engine (the trace's y and Signed area are its numbers).
import { expect, test, type Page } from "@playwright/test";
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
      if (width === 360) expect(await boardHeight(page)).toBeGreaterThanOrEqual(600);
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
      await foldByTap(page);
      const bar = page.getByTestId("folded-bar");
      const ids = ["fold-slice", "tab-home", "tab-slot", "tab-symb", "tab-plot", "tab-num", "mod-slot", "chip-angle", "menu-button"];
      const boxes = [];
      for (const id of ids) {
        const b = await bar.getByTestId(id).boundingBox();
        expect(b, id).not.toBeNull();
        boxes.push({ id, ...b! });
      }
      boxes.sort((a, b) => a.x - b.x);
      expect(boxes.map((b) => b.id)).toEqual(ids); // in the lock's order, left to right
      for (const [i, b] of boxes.entries()) {
        expect(b.x, b.id).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width, b.id).toBeLessThanOrEqual(width + 0.5);
        const next = boxes[i + 1];
        if (next) expect(b.x + b.width, `${b.id} | ${next.id}`).toBeLessThanOrEqual(next.x + 0.5);
      }
      await expect(bar.getByTestId("tab-plot")).toHaveAttribute("aria-selected", "true");
    });
  });

test("Esc unfolds in Plot; back unfolds, a second back closes the app (R926)", async ({ page }) => {
  await plot(page);
  await foldByTap(page);
  await page.keyboard.press("Escape");
  await isFolded(page, false);
  expect(await page.evaluate(() => window.n62.shell.app)).toBe("function");
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
