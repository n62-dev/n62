// SPDX-License-Identifier: GPL-3.0-or-later
// R327 (the owner, 2026-11-15), on the real engine: Shift + 1 opens the uncertainty sheet of a result with σ (mockup
// docs/mockups/uncertainty-sheet.html sections 1, 3 and 4): on the picked row in Home, else on the last finished row, and
// in the unit view on its result. Its head: the result with its mark, the short form, σ, U = 2σ and relative σ; R328: the
// inputs' rows under it (each one's share of σ², G272: 98.3 %, 1.7 %, second order < 0.1 %), ▲ ▼ over them. Anywhere else a dead press (the double pulse, counted under d1 Shift), never a typed character.
// Controls: 1 and Alpha + 1 unchanged, a b/c, 7 and Fmt still reserved on Shift, the σ line on a picked row unchanged.
// Expected values derived: t10 = 12.34 × 3.2 = 39.488 m², σ² = 1.548381 (G41), σ = 1.24434… → 1.2, U = 2.48868… → 2.5,
// σ/|y| = 3.151 % → 3.2 %; G × 5.972ᴇ24 (constdigits.spec.ts): σ 8.958ᴇ9 → 9.0ᴇ9, U 1.79ᴇ10 → 1.8ᴇ10, σ/|y| =
// 8.958ᴇ9 / 3.98589ᴇ14 = 0.002247 % → 0.0022 %.
import { expect, test, type Page } from "@playwright/test";
import type * as Finder from "../src/find/finder.ts";
import { entryValue, flick, open, recordVibrations, sheet, tap, vibrations } from "./helpers.ts";

const key = (page: Page, id: string) => page.locator(`[data-key="${id}"]`);
const shiftLegend = (page: Page, id: string) => key(page, id).evaluate((k) => k.querySelector(".shiftlegend")?.textContent?.trim() ?? "");
const head = (page: Page) => page.getByTestId("unc-head");
const title = (page: Page) => sheet(page).getByTestId("sheet-title");
const counts = (page: Page): Promise<Record<string, number>> => page.evaluate(() => ({ ...window.n62.session.taps.counts.keys }));
const done = (page: Page, n: number) => expect(page.locator('[data-status="done"]')).toHaveCount(n, { timeout: 20_000 });
const up = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.unitView !== undefined && document.querySelector('[data-pad="unit"]') !== null);

/** (12.34 ± 0.05) m × (3.2 ± 0.1) m in the unit view (unitback.spec.ts t10): ≈ 39.5 ± 1.2 m². */
async function t10(page: Page): Promise<void> {
  await tap(page, ["d1", "d2", "dot", "d3", "d4", "shift", "comma", "d0", "dot", "d0", "d5"]);
  await tap(page, ["mul", "d3", "dot", "d2", "shift", "comma", "d0", "dot", "d1"]);
  await flick(page, "tmpl", "up");
  await up(page);
  await tap(page, ["d9", "enter", "d9"]);
  await flick(page, "enter", "up");
  await expect(page.getByTestId("unit-result").locator(".value")).toHaveText("39.5 ± 1.2");
}
const leaveView = async (page: Page): Promise<void> => {
  await tap(page, ["esc"]);
  await page.waitForFunction(() => window.n62.unitView === undefined);
};
/** t10's head, as section 2 of the mockup draws it. */
async function t10Head(page: Page): Promise<void> {
  await expect(title(page)).toHaveText("Uncertainty");
  await expect(head(page).getByTestId("unc-of")).toHaveText("≈ 39.488 m²");
  await expect(head(page).getByTestId("unc-short")).toHaveText("≈ 39.5(12) m²");
  await expect(head(page).locator('[data-id="sigma"]')).toHaveText(["standard uncertainty (σ)", "1.2 m²"].join(""));
  await expect(head(page).locator('[data-id="expanded"]')).toHaveText("expandedU = 2σ = 2.5 m² (k = 2)");
  await expect(head(page).locator('[data-id="relative"]')).toHaveText("relative σ3.2 %");
  await expect(sheet(page).getByTestId("sheet-empty")).toHaveCount(0);
}
/** R328: t10's rows under the head (the mockup's section 2, variant A); the first one highlighted. */
async function t10Rows(page: Page): Promise<void> {
  const rows = sheet(page).locator('[role="menuitem"]');
  await expect(rows).toHaveCount(3);
  await expect(rows.getByTestId("unc-label")).toHaveText(["3.2 ± 0.1 m", "12.34 ± 0.05 m", "second order"]);
  await expect(rows.getByTestId("unc-uy")).toHaveText(["1.2 m²", "0.16 m²", ""]);
  await expect(rows.getByTestId("unc-share")).toHaveText(["98.3 %", "1.7 %", "< 0.1 %"]);
  await expect(rows.nth(0)).toHaveAttribute("data-active", "true");
  await expect(sheet(page).getByTestId("unc-lines")).toHaveCount(0); // the shares add to 100.0 %: no line
}

test.beforeEach(async ({ page }) => {
  await recordVibrations(page);
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
});

test("t10, leave the view, Shift + 1: the sheet Uncertainty with t10's head; Esc closes it", async ({ page }) => {
  await t10(page);
  await leaveView(page);
  const line = await entryValue(page); // (the line keeps t10's request)
  await tap(page, ["shift", "d1"]);
  await t10Head(page);
  expect(await entryValue(page)).toBe(line); // never a typed 1
  await tap(page, ["esc"]);
  await expect(sheet(page)).toHaveCount(0);
});

test("in the unit view, Shift + 1 opens the sheet on its result; Esc closes it and the view stays", async ({ page }) => {
  await t10(page);
  await tap(page, ["shift", "d1"]);
  await t10Head(page);
  await tap(page, ["esc"]);
  await expect(sheet(page)).toHaveCount(0);
  expect(await page.evaluate(() => window.n62.unitView !== undefined)).toBe(true);
});

test("R328: t10, Shift + 1: three rows under the head; ▼ moves the highlight over them, a digit keeps the sheet; Esc closes", async ({ page }) => {
  await t10(page);
  await tap(page, ["shift", "d1"]);
  await t10Head(page);
  await t10Rows(page);
  const rows = sheet(page).locator('[role="menuitem"]');
  // the keyboard's ▼ (an on-screen tap outside a pick sheet closes it, R144)
  await page.keyboard.press("ArrowDown");
  await expect(rows.nth(1)).toHaveAttribute("data-active", "true");
  await expect(rows.nth(0)).toHaveAttribute("data-active", "false");
  await page.keyboard.press("ArrowDown");
  await expect(rows.nth(2)).toHaveAttribute("data-active", "true");
  await page.keyboard.press("ArrowDown"); // round the end
  await expect(rows.nth(0)).toHaveAttribute("data-active", "true");
  await page.keyboard.press("2"); // a row's digit highlights it; the sheet stays
  await expect(rows.nth(1)).toHaveAttribute("data-active", "true");
  await expect(sheet(page)).toHaveCount(1);
  await tap(page, ["esc"]);
  await expect(sheet(page)).toHaveCount(0);
  expect(await page.evaluate(() => window.n62.unitView !== undefined)).toBe(true);
  // the same rows from Home's row of the visit
  await leaveView(page);
  await tap(page, ["shift", "d1"]);
  await t10Rows(page);
});

test("a picked row: the sheet is that row's, not the last one's; the σ line on a pick is unchanged", async ({ page }) => {
  // G × 5.972ᴇ24 (a Home row whose σ comes from a constant), then t10's unit row last
  await page.evaluate(async () => {
    const url = "/src/find/finder.ts";
    const f = (await import(/* @vite-ignore */ url)) as typeof Finder;
    const it = (await f.loadIndex(true)).byId.get("const:G");
    if (!it) throw new Error("no constant G in the index");
    f.putOnLine(window.n62.entry, it);
  });
  await tap(page, ["mul", "d5", "dot", "d9", "d7", "d2", "emark", "d2", "d4", "enter"]);
  await done(page, 1);
  await t10(page);
  await leaveView(page);
  await done(page, 2);
  // control: a tap on the G row's mark shows its σ line, as before
  await page.locator("article.item").first().getByTestId("mark").tap();
  await expect(page.getByTestId("sigma")).toHaveText("σ = 9.0ᴇ9 · U = 2σ = 1.8ᴇ10 (k = 2)"); // (constdigits.spec.ts)
  // Esc drops any pick; ▲ picks the last row (t10), ▲ again the G row: Shift + 1 is the G row's sheet
  await tap(page, ["esc"]);
  await page.evaluate(() => window.n62.entry.clear());
  await tap(page, ["up", "up", "shift", "d1"]);
  await expect(title(page)).toHaveText("Uncertainty");
  await expect(head(page).locator('[data-id="sigma"]')).toHaveText("standard uncertainty (σ)9.0ᴇ9");
  await expect(head(page).locator('[data-id="expanded"]')).toHaveText("expandedU = 2σ = 1.8ᴇ10 (k = 2)");
  await expect(head(page).locator('[data-id="relative"]')).toHaveText("relative σ0.0022 %");
  await expect(head(page).getByTestId("unc-of")).toContainText("≈");
  // R328: Home's rows (G274's terms, first order): G alone at 100.0 %, its uᵢ as the σ line writes σ, no second-order row
  const rows = sheet(page).locator('[role="menuitem"]');
  await expect(rows.getByTestId("unc-label")).toHaveText(["G"]);
  await expect(rows.getByTestId("unc-uy")).toHaveText(["9.0ᴇ9"]);
  await expect(rows.getByTestId("unc-share")).toHaveText(["100.0 %"]);
});

test("2·π·50, Enter, Shift + 1: a dead press (the double pulse, counted under d1 Shift), no sheet, nothing typed; t10's row above it still opens", async ({ page }) => {
  await t10(page);
  await leaveView(page);
  await page.evaluate(() => window.n62.entry.clear());
  await tap(page, ["d2", "mul"]);
  await flick(page, "d3", "up");
  await tap(page, ["mul", "d5", "d0", "enter"]);
  await done(page, 2);
  await page.evaluate(() => window.n62.session.setHaptics({ on: true, ms: 10 }));
  const base = await counts(page);
  await tap(page, ["shift"]);
  const before = (await vibrations(page)).length;
  await tap(page, ["d1"]);
  await expect.poll(async () => (await vibrations(page)).length - before).toBe(3); // the touch, then the double (onepulse.spec.ts)
  await expect(sheet(page)).toHaveCount(0);
  expect(await entryValue(page)).toBe("");
  expect((await counts(page))["d1:shift"]).toBe((base["d1:shift"] ?? 0) + 1);
  // the key is dead for that row only: ▲ ▲ picks t10's row above it, and Shift + 1 is its sheet
  await tap(page, ["up", "up", "shift", "d1"]);
  await t10Head(page);
});

test("controls: σ over 1, live; 1 types 1, Alpha + 1 types Y; a b/c, 7 and Fmt still reserved on Shift", async ({ page }) => {
  expect(await shiftLegend(page, "d1")).toContain("σ");
  await tap(page, ["shift"]);
  await expect(key(page, "d1")).not.toHaveAttribute("data-dead", "true");
  for (const id of ["frac", "d7", "fmt"]) {
    await expect(key(page, id), id).toHaveAttribute("data-dead", "true");
    expect(await shiftLegend(page, id), id).toBe("");
  }
  await tap(page, ["shift", "d1", "alpha", "d1"]);
  expect(await entryValue(page)).toBe("1Y");
  // an empty history: Shift + 1 is dead and types nothing
  await page.evaluate(() => window.n62.entry.clear());
  await tap(page, ["shift", "d1"]);
  await expect(sheet(page)).toHaveCount(0);
  expect(await entryValue(page)).toBe("");
});
