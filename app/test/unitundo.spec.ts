// SPDX-License-Identifier: GPL-3.0-or-later
// R896 (owner-style hunt 2026-11-23, h2 #7): Clear (Shift + Esc) and Undo / Redo work in the unit view, as on the entry line (P13). 72, units, k m ÷ s:
// Clear empties the active slot, a second Clear every slot; ⌫ takes the s out, Undo brings it back, Redo takes it out again.
import { expect, test, type Page } from "@playwright/test";
import { flick, open, tap } from "./helpers.ts";

const up = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element && document.querySelector('[data-pad="unit"]') !== null);
const reading = (page: Page) => page.getByTestId("unit-reading");
const slot = (page: Page, id: string) => page.evaluate((i) => window.n62.unitView?.view.model(i)?.slot, id);
const active = (page: Page) => page.evaluate(() => window.n62.unitView?.view.activeId);

const start = async (page: Page, line: string[]): Promise<void> => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
  await tap(page, line);
  await flick(page, "tmpl", "up");
  await up(page);
};

test.describe("one slot: 72", () => {
  test.beforeEach(async ({ page }) => {
    await start(page, ["d7", "d2"]);
    await tap(page, ["d4", "d9", "div", "d3"]); // k m ÷ s
    await expect(reading(page)).toHaveText("kilometer per second");
  });

  test("Clear empties the active slot; Undo brings km/s back, Redo empties it again", async ({ page }) => {
    await tap(page, ["shift", "esc"]);
    expect(await slot(page, "u1")).toEqual({ tokens: [] });
    await tap(page, ["undo"]);
    expect(await slot(page, "u1")).toEqual({ tokens: [{ prefix: "k", unit: "m" }, { unit: "s" }], per: 1 });
    await tap(page, ["redo"]);
    expect(await slot(page, "u1")).toEqual({ tokens: [] });
  });

  test("⌫ takes the s out, Undo brings it back, Redo takes it out again; Undo at the start is a dead key", async ({ page }) => {
    await tap(page, ["bksp"]);
    expect(await slot(page, "u1")).toEqual({ tokens: [{ prefix: "k", unit: "m" }] });
    await tap(page, ["undo"]);
    expect(await slot(page, "u1")).toEqual({ tokens: [{ prefix: "k", unit: "m" }, { unit: "s" }], per: 1 });
    await expect(reading(page)).toHaveText("kilometer per second");
    await tap(page, ["redo"]);
    expect(await slot(page, "u1")).toEqual({ tokens: [{ prefix: "k", unit: "m" }] });
    for (let i = 0; i < 6; i++) await tap(page, ["undo"]);
    expect(await slot(page, "u1")).toEqual({ tokens: [] });
    await tap(page, ["undo"]); // nothing left to undo
    expect(await slot(page, "u1")).toEqual({ tokens: [] });
  });

  test("an edit after an Undo drops the Redo", async ({ page }) => {
    await tap(page, ["bksp", "undo", "d6"]); // s out, back, then g after the s
    await tap(page, ["redo"]);
    expect((await slot(page, "u1"))?.tokens).toHaveLength(3);
  });
});

test("Clear twice: the active slot, then every slot; one Undo brings every slot back", async ({ page }) => {
  await start(page, ["d7", "mul", "d3"]); // 7 × 3: slots u1 and u2
  await tap(page, ["d4", "d9", "enter", "d3"]); // u1 km, u2 s
  expect(await active(page)).toBe("u2");
  await tap(page, ["shift", "esc"]);
  expect(await slot(page, "u2")).toEqual({ tokens: [] });
  expect(await slot(page, "u1")).toEqual({ tokens: [{ prefix: "k", unit: "m" }] });
  await tap(page, ["shift", "esc"]);
  expect(await slot(page, "u1")).toEqual({ tokens: [] });
  await tap(page, ["undo"]);
  expect(await slot(page, "u1")).toEqual({ tokens: [{ prefix: "k", unit: "m" }] });
  expect(await slot(page, "u2")).toEqual({ tokens: [] });
  await tap(page, ["undo"]);
  expect(await slot(page, "u2")).toEqual({ tokens: [{ unit: "s" }] });
});
