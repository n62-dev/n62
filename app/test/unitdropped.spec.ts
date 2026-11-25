// SPDX-License-Identifier: GPL-3.0-or-later
// R902 (owner-style hunt 2026-11-23, h2 #4): a line left with Esc keeps its slots (docs/04 4.3 "The way back"); entered in
// Home, which has no units, its row says the unit was dropped with G392's note (docs/archive/r7-unit-slots.md:217). Esc
// stays silent and the line plain (owner, 2026-11-23); the units key on the same text still brings the slots back.
// Expected values: derived (72 entered in Home is 72).
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

const up = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element && document.querySelector('[data-pad="unit"]') !== null);
const ready = (page: Page): Promise<unknown> => page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
const line = (page: Page): Promise<string> => page.evaluate(() => window.n62.entry.value);
const lastRow = (page: Page) => page.locator("article.item").last();
/** The view's slot as text: `k:m / s`, `` (empty). */
const slotText = (page: Page, id: string): Promise<string> =>
  page.evaluate((id) => {
    const s = window.n62.unitView?.view.model(id)?.slot;
    return (s?.tokens ?? []).map((t, i) => `${i === s?.per ? "/ " : ""}${t.prefix ? `${t.prefix}:` : ""}${t.unit}${t.power ? `^${t.power}` : ""}`).join(" ");
  }, id);
const leave = async (page: Page): Promise<void> => {
  await tap(page, ["esc"]);
  await page.waitForFunction(() => window.n62.unitView === undefined);
};

test.describe("R902: a line whose units were dropped says so when entered in Home", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await open(page, "");
    await ready(page);
  });

  test("7 2, Shift+Tmpl, k m ÷ s, Esc, Enter: 72 = 72 with the note; the units key on 72 brings km/s back", async ({ page }) => {
    await tap(page, ["d7", "d2", "shift", "tmpl"]);
    await up(page);
    await tap(page, ["d4", "d9", "div", "d3"]);
    expect(await slotText(page, "u1")).toBe("k:m / s");
    await leave(page);
    expect(await line(page)).toBe("72"); // Esc is silent: the line plain
    await expect(page.getByTestId("unit-dropped")).toHaveCount(0);
    await tap(page, ["enter"]);
    await expect(lastRow(page)).toHaveAttribute("data-status", "done");
    await expect(lastRow(page).locator(".result")).toContainText("72");
    await expect(lastRow(page).getByTestId("unit-dropped")).toHaveText("unit dropped: Home has no units");
    // the slots stay kept by the text: 7 2 and the units key again
    await tap(page, ["d7", "d2", "shift", "tmpl"]);
    await up(page);
    expect(await slotText(page, "u1")).toBe("k:m / s");
    await leave(page);
  });

  test("control: the noted line entered, 7 2 Enter again has no note (the slots stay kept, the note was for the left line)", async ({ page }) => {
    await tap(page, ["d7", "d2", "shift", "tmpl"]);
    await up(page);
    await tap(page, ["d4", "d9", "div", "d3"]);
    await leave(page);
    await tap(page, ["enter"]);
    await expect(lastRow(page).getByTestId("unit-dropped")).toHaveText("unit dropped: Home has no units");
    await tap(page, ["d7", "d2", "enter"]);
    await expect(page.locator("article.item")).toHaveCount(2);
    await expect(lastRow(page)).toHaveAttribute("data-status", "done");
    await expect(lastRow(page).locator(".result")).toContainText("72");
    await expect(page.getByTestId("unit-dropped")).toHaveCount(1); // the first row's only
  });

  test("control: k m ÷ s, Eval, Store ▶ in X, then 7 2 Enter in Home has no note; the units key on 72 still brings km/s back", async ({ page }) => {
    await tap(page, ["d7", "d2", "shift", "tmpl"]);
    await up(page);
    await tap(page, ["d4", "d9", "div", "d3", "enter"]); // Eval: 72 km/s
    await expect(page.getByTestId("unit-unit")).toHaveText("km/s");
    await tap(page, ["shift", "emark"]); // Store ▶: the view leaves, the line holds the result's chip
    await page.waitForFunction(() => window.n62.unitView === undefined);
    const store = page.getByTestId("store");
    await store.locator('[data-id="name:X"]').tap();
    await expect(store).toBeHidden();
    await expect(page.locator('[data-status="done"]')).toHaveCount(2); // the unit row, then the store row
    await tap(page, ["d7", "d2", "enter"]);
    await expect(page.locator('[data-status="done"]')).toHaveCount(3);
    await expect(lastRow(page).locator(".result")).toContainText("72");
    await expect(lastRow(page).getByTestId("unit-dropped")).toHaveCount(0); // (the store row's note is R63's, its chip's unit)
    await tap(page, ["d7", "d2", "shift", "tmpl"]);
    await up(page);
    expect(await slotText(page, "u1")).toBe("k:m / s");
    await leave(page);
  });

  test("control: a line never in the unit view has no note", async ({ page }) => {
    await tap(page, ["d7", "d3", "enter"]);
    await expect(lastRow(page)).toHaveAttribute("data-status", "done");
    await expect(page.getByTestId("unit-dropped")).toHaveCount(0);
  });

  test("control: a line left with its slots empty has no note", async ({ page }) => {
    await tap(page, ["d7", "d4", "shift", "tmpl"]);
    await up(page);
    await leave(page);
    await tap(page, ["enter"]);
    await expect(lastRow(page)).toHaveAttribute("data-status", "done");
    await expect(page.getByTestId("unit-dropped")).toHaveCount(0);
  });
});
