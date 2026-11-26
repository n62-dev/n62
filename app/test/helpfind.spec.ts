// SPDX-License-Identifier: GPL-3.0-or-later
// R869 (owner, 2026-11-22, S3 point 11): Help on Find's highlighted row opens that item's help as a level over Find: a function's
// R197 rows, a unit's, prefix's or constant's card from the index; ‹, Esc and ◀ go back to Find with its query and highlight. In
// the unit view's Find the same, the unit view staying under it. A row that is no index item (a stored name in Vars) or no row (a
// query that matches nothing) is the dead press. Each Help press is counted under its layer (R127: help:shift). At 412 × 915 and
// 360 × 740; the fake engine (Vars' stored name: the real one). Expected values are the index's (find/units.yaml, the generator's
// `si`): 381/1250 m is 0.3048 m. N62_SHOTS=<dir>: the three cards at 360 × 740 are saved there for the report.
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { flick, open, tap } from "./helpers.ts";

const find = (page: Page) => page.getByTestId("find");
const title = (page: Page) => find(page).getByTestId("sheet-title");
const row = (page: Page, id: string) => find(page).locator(`[role="menuitem"][data-id="${id}"]`);
const active = (page: Page) => find(page).locator('[role="menuitem"][data-active="true"]');
const keys = (page: Page): Promise<Record<string, number>> => page.evaluate(() => ({ ...window.n62.session.taps.counts.keys }));
const HELP = ["shift", "help"];

/** The letters Find types by a tap (Find takes every key's Alpha letter; a digit key picks on an empty query, so a flick down). */
const LETTER: Readonly<Record<string, string>> = { f: "pow", t: "div", s: "d9", i: "tan", n: "paren", q: "d7" }; // spec/keyboard.yaml alpha layer
async function typeFind(page: Page, text: string): Promise<void> {
  for (const ch of text) {
    const id = LETTER[ch];
    if (!id) throw new Error(`no key for ${ch}`);
    if (/^d\d$/.test(id)) await flick(page, id, "down");
    else await tap(page, [id]);
  }
}
/** ▼ until the row `id` is highlighted. */
async function downTo(page: Page, id: string): Promise<void> {
  for (let i = 0; i < 12 && (await active(page).getAttribute("data-id")) !== id; i++) await tap(page, ["down"]);
  await expect(active(page)).toHaveAttribute("data-id", id);
}
/** Help as the dead press (R112, R820): with Shift on, the key is drawn dead (sheetFace), and its tap changes nothing. */
async function deadHelp(page: Page): Promise<void> {
  await tap(page, ["shift"]);
  await expect(page.locator('[data-key="help"]')).toHaveAttribute("data-dead", "true");
  await tap(page, ["help"]);
}
async function shot(page: Page, name: string): Promise<void> {
  const dir = process.env["N62_SHOTS"];
  if (dir && page.viewportSize()?.width === 360) await page.screenshot({ path: join(dir, `${name}.png`) });
}

/** The card of the foot: the value line from its `si`, exact, its quantity; Insert last. */
async function footCard(page: Page): Promise<void> {
  await expect(title(page)).toHaveText(/(^|› )Help: Foot$/);
  await expect(row(page, "names")).toContainText("ft · foot, feet");
  await expect(row(page, "quantity")).toContainText("Length");
  await expect(row(page, "value")).toContainText("1 ft = 0.3048 m");
  await expect(row(page, "value").getByTestId("row-hint")).toHaveText("exact");
  await expect(row(page, "insert")).toContainText("Insert");
}

for (const [width, height] of [[412, 915], [360, 740]] as const) {
  test.describe(`${width} × ${height}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ reducedMotion: "reduce" });
    });

    test("Math, ft, ▼ to unit:ft, Help: the foot's card over Find; Esc: Find with ft and unit:ft as they were", async ({ page }) => {
      await open(page);
      await tap(page, ["math"]);
      await expect(find(page)).toBeVisible();
      await typeFind(page, "ft");
      await downTo(page, "unit:ft");
      await tap(page, ["shift"]);
      await expect(page.locator('[data-key="help"]')).not.toHaveAttribute("data-dead", "true"); // a row to explain: Help is live
      await tap(page, ["shift"]); // (Shift off again: a second tap locks, a third ends it)
      await tap(page, ["shift"]);
      const base = await keys(page);
      await tap(page, HELP);
      await footCard(page);
      await expect(title(page)).toHaveText("Find › Help: Foot");
      expect((await keys(page))["help:shift"]).toBe((base["help:shift"] ?? 0) + 1);
      await shot(page, "card-unit-ft");
      // Help on the card's own row: no index item there, the dead press
      await deadHelp(page);
      await footCard(page);
      await tap(page, ["esc"]);
      await expect(title(page)).toHaveText("Find");
      await expect(find(page).getByTestId("sheet-filter")).toHaveText("ft");
      await expect(active(page)).toHaveAttribute("data-id", "unit:ft");
      // Insert does what Enter on the row does: in Home a unit opens the unit view with it in the slot (R893)
      await tap(page, HELP);
      await footCard(page);
      await row(page, "insert").tap();
      await expect(find(page)).toBeHidden();
      await page.waitForFunction(() => window.n62.unitView?.view.model("u1")?.slot?.tokens[0]?.unit === "ft");
    });

    test("sin highlighted: Help: Sine with R197's rows; a constant's card", async ({ page }) => {
      await open(page);
      await tap(page, ["math"]);
      await expect(find(page)).toBeVisible();
      await typeFind(page, "sin");
      await downTo(page, "fn:sin");
      await tap(page, HELP);
      await expect(title(page)).toHaveText("Find › Help: Sine");
      await expect(row(page, "syntax")).toHaveAttribute("aria-label", "1 sin(x)");
      await expect(row(page, "example").getByTestId("row-hint")).toHaveText("= 0.5");
      await expect(row(page, "insert")).toHaveAttribute("aria-label", "3 Insert the example");
      await shot(page, "card-fn-sin");
      await tap(page, ["left"]); // ◀ goes back as Esc does
      await expect(title(page)).toHaveText("Find");
      await expect(find(page).getByTestId("sheet-filter")).toHaveText("sin");
      await expect(active(page)).toHaveAttribute("data-id", "fn:sin");
      // the Insert row of a function: the example at the cursor, all closed
      await tap(page, HELP);
      await tap(page, ["d3"]);
      await expect(find(page)).toBeHidden();
      expect(await page.evaluate(() => window.n62.entry.value)).toBe("\\sin\\left(30\\degree\\right)");
      // Constants (category 9 on an empty query), c highlighted: exact by the SI definition
      await tap(page, ["math", "tmpl"]);
      await downTo(page, "const:c");
      await tap(page, HELP);
      await expect(title(page)).toHaveText(/› Help: Speed of Light in Vacuum$/);
      await expect(row(page, "value")).toContainText("299792458 m/s");
      await expect(row(page, "value").getByTestId("row-hint")).toHaveText("exact (SI definition)");
      await shot(page, "card-const-c");
    });

    test("the unit view's Find: ft, Help: the same card; Esc goes back to that Find, the unit view under it", async ({ page }) => {
      await open(page);
      await flick(page, "tmpl", "up");
      await page.waitForFunction(() => window.n62.unitView !== undefined && document.querySelector('[data-pad="unit"]') !== null);
      await tap(page, ["math"]);
      await expect(find(page)).toBeVisible();
      await typeFind(page, "ft");
      await downTo(page, "unit:ft");
      const base = await keys(page);
      await tap(page, HELP);
      await footCard(page);
      expect((await keys(page))["help:shift"]).toBe((base["help:shift"] ?? 0) + 1);
      await tap(page, ["esc"]);
      await expect(title(page)).toHaveText("Find");
      await expect(active(page)).toHaveAttribute("data-id", "unit:ft");
      expect(await page.evaluate(() => window.n62.unitView !== undefined)).toBe(true);
      // Insert there is the slot's pick, as Enter on the row
      await tap(page, HELP);
      await tap(page, ["d4"]);
      await expect(find(page)).toBeHidden();
      await page.waitForFunction(() => window.n62.unitView?.view.model("u1")?.slot?.tokens[0]?.unit === "ft");
    });

    test("a query that matches nothing: Help is the dead press, Find stays", async ({ page }) => {
      await open(page);
      await tap(page, ["math"]);
      await expect(find(page)).toBeVisible();
      await typeFind(page, "qqq");
      await expect(find(page).locator('[role="menuitem"]')).toHaveCount(0);
      await deadHelp(page);
      await expect(title(page)).toHaveText("Find");
      await expect(find(page).getByTestId("sheet-filter")).toHaveText("qqq");
    });

    test("Vars with a stored name highlighted: Help is the dead press, Vars stays", async ({ page }) => {
      await open(page, "");
      await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
      await tap(page, ["d7", "shift", "emark", "alpha", "vars", "enter"]); // 7 ▶ A
      await expect(page.locator('[data-status="done"]')).toHaveCount(1);
      await tap(page, ["vars"]);
      await expect(find(page)).toBeVisible();
      await downTo(page, "var:A");
      await deadHelp(page);
      await expect(active(page)).toHaveAttribute("data-id", "var:A");
      await expect(title(page)).not.toHaveText(/Help/);
    });
  });
}
