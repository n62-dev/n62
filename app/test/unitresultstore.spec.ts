// SPDX-License-Identifier: GPL-3.0-or-later
// R353: Store ▶ in the unit view stores the result with its unit (docs/04 4.3 "The way back"). Shift + ᴇ (ᴇ's cell has no
// up item), the button beside the result and Tools › Store in a name each leave the view with the result's chip on
// Home's line and open "Store in" on its row (R281's sheet, the one store path); G371 keeps the unit and σ in the name.
// No result yet, or a result whose chip lacks the unit or σ shown: dead, with the reason under the result. The real
// engine. Expected values: derived (5 km × 2 = 10; (9.81 ± 0.01) × 2 = 19.62 ± 0.02, σ scales with the factor).
import { expect, test, type Page } from "@playwright/test";
import { entryValue, flick, lastResult, open, tap } from "./helpers.ts";

const up = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element && document.querySelector('[data-pad="unit"]') !== null);
const unitsKey = async (page: Page): Promise<void> => {
  await flick(page, "tmpl", "up");
  await up(page);
};
const result = (page: Page) => page.getByTestId("unit-result");
const store = (page: Page) => page.getByTestId("store");
const cell = (page: Page, letter: string) => store(page).locator(`[data-id="name:${letter}"]`);
const done = (page: Page) => page.locator('[data-status="done"]');
const note = (page: Page) => page.getByTestId("unit-store-note");
const find = (page: Page) => page.getByTestId("find");
const FIRST = "Eval first, then Store ▶";
const NO_UNIT = "This result cannot be stored with its unit";

/** The definitions log's entry `name` as stored (state/storage.ts: `{ "@n62": version, value: DefEntry[] }`), as G371's case reads it. */
const stored = (page: Page, name: string) =>
  page.evaluate(
    (name) =>
      new Promise<{ unit?: unknown; facts?: { uncSigma?: string } } | undefined>((resolve, reject) => {
        const req = indexedDB.open("n62", 1);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const get = req.result.transaction("kv", "readonly").objectStore("kv").get("defs");
          get.onerror = () => reject(get.error);
          get.onsuccess = () => {
            const rec = get.result as { value: { name: string; unit?: unknown; facts?: { uncSigma?: string } }[] } | undefined;
            resolve(rec?.value.find((e) => e.name === name));
          };
        };
      }),
    name,
  );

/** 5, the units key, k, m, Eval: = 5 km. */
async function fiveKm(page: Page): Promise<void> {
  await tap(page, ["d5"]);
  await unitsKey(page);
  await tap(page, ["d4", "d9"]); // k, m
  await flick(page, "enter", "up");
  await expect(result(page)).toHaveAttribute("data-text", "5");
  await expect(page.getByTestId("unit-unit")).toHaveText("km");
}

/** "Store 5 km in" is open on Home with the chip and ▶ alone on the line; a tap on X stores; X holds km; X × 2 is 10. */
async function storesX(page: Page): Promise<void> {
  await expect(store(page).getByTestId("sheet-title")).toHaveText("Store = 5 km in");
  await expect(page.getByTestId("unit-view")).toHaveCount(0);
  expect(await entryValue(page)).toMatch(/^\\res\{\d+\}\{5\\htmlStyle\{[^}]*\}\{\\,\\text\{km\}\}\}\\blacktriangleright$/);
  await cell(page, "X").tap();
  await expect(store(page)).toBeHidden();
  await expect(done(page)).toHaveCount(2); // the unit row, then the store row
  await expect.poll(async () => (await stored(page, "X"))?.unit, { timeout: 5000 }).toEqual({ text: "km", dim: "m1", slot: { tokens: [{ prefix: "k", unit: "m" }] } });
  await tap(page, ["alpha", "mul", "mul", "d2", "enter"]); // X × 2
  await expect(done(page)).toHaveCount(3);
  await expect(lastResult(page)).toHaveAttribute("data-text", "10");
}

test.describe("Store ▶ in the unit view (R353)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await open(page, "");
    await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
  });

  test("5 km, Shift + ᴇ: the view leaves, Store 5 km in opens; X stores 5 km with its unit; X × 2 is 10", async ({ page }) => {
    await fiveKm(page);
    await tap(page, ["shift", "emark"]);
    await storesX(page);
  });

  test("the button ▶ Store beside the result does the same", async ({ page }) => {
    await fiveKm(page);
    await expect(page.getByTestId("unit-store")).toHaveText("▶ Store");
    await page.getByTestId("unit-store").tap();
    await storesX(page);
  });

  test("Tools › Store in a name does the same", async ({ page }) => {
    await fiveKm(page);
    await tap(page, ["math"]);
    await expect(find(page)).toBeVisible();
    await find(page).locator('[role="menuitem"][data-id="ucat:tools"]').tap();
    const row = find(page).locator('[role="menuitem"][data-id="utool:store"]');
    await expect(row).toContainText("Store in a name");
    await row.tap();
    await storesX(page);
  });

  test("9.81 ± 0.01 m/s², Store ▶ G: G keeps σ; G × 2 is 19.62 with σ 0.02", async ({ page }) => {
    await tap(page, ["d9", "dot", "d8", "d1", "shift", "comma", "d0", "dot", "d0", "d1"]);
    await unitsKey(page);
    await tap(page, ["d9", "div", "d3", "sq"]); // m ÷ s²
    await flick(page, "enter", "up");
    await expect(result(page).locator(".value")).toHaveText("9.810 ± 0.010");
    await tap(page, ["shift", "emark"]);
    await expect(store(page).getByTestId("sheet-title")).toContainText("9.81");
    await cell(page, "G").tap();
    await expect(store(page)).toBeHidden();
    await expect.poll(async () => (await stored(page, "G"))?.facts?.uncSigma, { timeout: 5000 }).toBeDefined();
    expect(Number((await stored(page, "G"))?.facts?.uncSigma)).toBeCloseTo(0.01, 12);
    await tap(page, ["alpha", "sin", "mul", "d2", "enter"]); // G × 2
    await expect(done(page)).toHaveCount(3);
    await expect(lastResult(page)).toHaveAttribute("data-text", "19.62");
    const facts = await page.evaluate(() => window.n62.session.home.at(-1)?.facts);
    expect(Number(facts?.uncSigma)).toBeCloseTo(0.02, 12);
  });

  test("no result yet: Store ▶ is dead with Eval first; the view stays, nothing is stored", async ({ page }) => {
    await tap(page, ["d5"]);
    await unitsKey(page);
    await tap(page, ["d4", "d9"]);
    await tap(page, ["shift", "emark"]);
    await expect(note(page)).toHaveText(FIRST);
    await expect(page.getByTestId("unit-view")).toBeVisible();
    await expect(store(page)).toHaveCount(0);
    expect(await page.evaluate(() => window.n62.unitView?.view.ids)).toEqual(["u1"]);
    expect(await page.evaluate(() => window.n62.session.userNames.length)).toBe(0);
    // Tools › Store in a name needs a result too
    await tap(page, ["math"]);
    await expect(find(page)).toBeVisible();
    await find(page).locator('[role="menuitem"][data-id="ucat:tools"]').tap();
    await expect(find(page).locator('[role="menuitem"][data-id="utool:store"]')).toHaveAttribute("aria-disabled", "true");
  });

  test("after a refusal (5 m + 3 s): Store ▶ is dead with Eval first, the refusal stays", async ({ page }) => {
    await tap(page, ["d5"]);
    await page.evaluate(() => window.n62.entry.set("5+3"));
    await unitsKey(page);
    await tap(page, ["d9", "enter", "d3"]); // m, then s
    await flick(page, "enter", "up");
    await expect(page.getByTestId("unit-message")).toContainText("Units don't match");
    await tap(page, ["shift", "emark"]);
    await expect(note(page)).toHaveText(FIRST);
    await expect(page.getByTestId("unit-message")).toContainText("Units don't match");
    await expect(store(page)).toHaveCount(0);
  });

  test("a result whose chip lacks its unit: Store ▶, the button and Tools are dead with the reason; nothing is stored", async ({ page }) => {
    await fiveKm(page);
    // the result's row with a chip that lost its unit (as quantityChip gives for no shown slot or a unit text over 40)
    await page.evaluate(() => {
      const u = window.n62.session.home.at(-1)?.units;
      if (u?.chip) delete u.chip.unit;
    });
    await tap(page, ["shift", "emark"]);
    await expect(note(page)).toHaveText(NO_UNIT);
    await page.getByTestId("unit-store").tap();
    await expect(note(page)).toHaveText(NO_UNIT);
    await tap(page, ["math"]);
    await expect(find(page)).toBeVisible();
    await find(page).locator('[role="menuitem"][data-id="ucat:tools"]').tap();
    const row = find(page).locator('[role="menuitem"][data-id="utool:store"]');
    await expect(row).toHaveAttribute("aria-disabled", "true");
    await expect(row).toContainText(NO_UNIT);
    await tap(page, ["esc", "esc"]);
    await expect(store(page)).toHaveCount(0);
    expect(await page.evaluate(() => window.n62.session.userNames.length)).toBe(0);
  });

  // (± typed on Home's line reaching the view, R71, is the σ case above; Home's own Store ▶ is store.spec.ts)
  test("control: ᴇ's tap types mol in a slot", async ({ page }) => {
    await tap(page, ["d2"]);
    await unitsKey(page);
    await tap(page, ["emark"]);
    expect(await page.evaluate(() => (window.n62.unitView?.view.model("u1")?.slot.tokens ?? []).map((t) => t.unit))).toEqual(["mol"]);
    await tap(page, ["esc"]);
    await page.waitForFunction(() => window.n62.unitView === undefined);
  });
});
