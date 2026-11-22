// SPDX-License-Identifier: GPL-3.0-or-later
// R838: Settings and Mode open as sheets over the unit view and close back onto it (docs/05, the unit view): the slots, the
// active slot, an armed prefix and the result stay; while the sheet is open every key is the sheet's; on close the focus is
// on the view again (a hardware ← moves between slots) and a changed setting the view shows (the digits) redraws its result.
// Home, CAS and Apps stay places: they close the view. Expected values: derived (2π·25 = 157.0796326794896…, from the
// oracle value of tasks.yaml t04, 2π·0.025 = 0.1570796326794896…; at 6 significant digits 157.080).
import { expect, test, type Page } from "@playwright/test";
import { flick, open, tap } from "./helpers.ts";

const up = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element && document.querySelector('[data-pad="unit"]') !== null);
const unitsKey = async (page: Page): Promise<void> => {
  await flick(page, "tmpl", "up");
  await up(page);
};
/** The view's slot as text: `k:m`, `h`, `` (empty). */
const slotText = (page: Page, id: string): Promise<string> =>
  page.evaluate((id) => {
    const s = window.n62.unitView?.view.model(id)?.slot;
    return (s?.tokens ?? []).map((t, i) => `${i === s?.per ? "/ " : ""}${t.prefix ? `${t.prefix}:` : ""}${t.unit}${t.power ? `^${t.power}` : ""}`).join(" ");
  }, id);
const active = (page: Page): Promise<number | undefined> => page.evaluate(() => window.n62.unitView?.view.active);
const viewOpen = (page: Page): Promise<boolean> => page.evaluate(() => window.n62.unitView !== undefined && document.querySelector('[data-testid="unit-field"]') !== null);
const depth = (page: Page): Promise<number> => page.evaluate(() => window.n62.shell.sheet?.depth ?? 0);
/** The sheet is closed and the focus is on the unit view's element (the hardware keys reach it at once). */
const backOnView = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.shell.sheet === null && window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element);

/** 3 ÷ 2 on the line, the unit view on it: u1 = km, u2 = h (the active slot). */
async function kmPerH(page: Page): Promise<void> {
  await tap(page, ["d3", "div", "d2"]);
  await unitsKey(page);
  await tap(page, ["d4", "d9", "enter"]);
  await flick(page, "d3", "up");
  expect(await slotText(page, "u1")).toBe("k:m");
  expect(await slotText(page, "u2")).toBe("h");
  expect(await active(page)).toBe(1);
}

/** The view as kmPerH left it, with the focus on it: a hardware ← makes u1 the active slot. */
async function sameView(page: Page): Promise<void> {
  await backOnView(page);
  expect(await viewOpen(page)).toBe(true);
  expect(await page.evaluate(() => window.n62.unitView?.view.line)).toBe("3\\div2");
  expect(await slotText(page, "u1")).toBe("k:m");
  expect(await slotText(page, "u2")).toBe("h");
  expect(await active(page)).toBe(1);
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => active(page)).toBe(0);
}

for (const width of [412, 360]) {
  test.describe(`Settings and Mode over the unit view (R838), ${width} px`, () => {
    test.use({ viewport: { width, height: 860 } });
    test.beforeEach(async ({ page }) => open(page));

    test("Shift + Help opens Settings over the view; Esc twice comes back to it, slots and focus as they were", async ({ page }) => {
      await kmPerH(page);
      await tap(page, ["shift", "help"]);
      await expect(page.getByTestId("menu")).toBeVisible();
      expect(await depth(page)).toBe(2); // Mode › Settings
      expect(await viewOpen(page)).toBe(true);
      await tap(page, ["esc", "esc"]);
      await sameView(page);
    });

    test("Mode from Alt + Shift + O and from the bar's chip opens over the view; Esc comes back to it", async ({ page }) => {
      await kmPerH(page);
      await page.keyboard.press("Alt+Shift+O");
      await expect(page.getByTestId("menu")).toBeVisible();
      expect(await viewOpen(page)).toBe(true);
      await tap(page, ["esc"]);
      await sameView(page);
      await page.keyboard.press("ArrowRight"); // u2 active again
      await expect.poll(() => active(page)).toBe(1);
      await tap(page, ["@mode"]);
      await expect(page.getByTestId("menu")).toBeVisible();
      await tap(page, ["esc"]);
      await sameView(page);
    });

    test("with Settings open over the view every key is the sheet's: 4 picks its row 4, ▲ ▼ move; the slots stay", async ({ page }) => {
      await kmPerH(page);
      await tap(page, ["shift", "help"]);
      await expect(page.getByTestId("menu")).toBeVisible();
      const hl = (): Promise<number | undefined> => page.evaluate(() => window.n62.shell.sheet?.level.highlight);
      const first = await hl();
      await tap(page, ["down"]);
      await expect.poll(hl).not.toBe(first);
      await tap(page, ["up"]);
      await expect.poll(hl).toBe(first);
      await tap(page, ["d4"]); // Settings' row 4 opens its level (no k into a slot)
      await expect.poll(() => depth(page)).toBe(3);
      expect(await slotText(page, "u1")).toBe("k:m");
      expect(await slotText(page, "u2")).toBe("h");
      await tap(page, ["esc", "esc", "esc"]);
      await sameView(page);
    });

    test("Shift + Help with a prefix armed (k): after close the prefix is still armed, m makes km", async ({ page }) => {
      await tap(page, ["d3"]);
      await unitsKey(page);
      await tap(page, ["d4"]); // k, armed
      expect(await slotText(page, "u1")).toBe("");
      await tap(page, ["shift", "help"]);
      await expect(page.getByTestId("menu")).toBeVisible();
      await tap(page, ["esc", "esc"]);
      await backOnView(page);
      await tap(page, ["d9"]);
      expect(await slotText(page, "u1")).toBe("k:m");
    });

    test("control: Home, CAS and Apps still close the view", async ({ page }) => {
      // from Home: CAS (slot 2) and Apps; from CAS: Home (a tap on the current Home pill is no press)
      for (const place of ["@place", "@cas", "@home"]) {
        await page.evaluate(() => window.n62.entry.clear());
        await tap(page, ["d3"]);
        await unitsKey(page);
        await tap(page, [place]);
        await page.waitForFunction(() => window.n62.unitView === undefined);
        if (place === "@place") {
          await expect(page.getByTestId("apps")).toBeVisible();
          await tap(page, ["esc"]);
        }
        expect(await page.evaluate(() => window.n62.session.view)).toBe(place === "@cas" ? "cas" : "home");
      }
    });
  });
}

test.describe("a setting changed over the unit view redraws its result (R838)", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "");
    await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
  });

  test("2π·25 mm: Mode › Significant digits 6 over the result, and on close the result shows 157.08 with no new engine call", async ({ page }) => {
    await tap(page, ["d2", "mul"]);
    await flick(page, "d3", "up");
    await tap(page, ["mul", "d2", "d5"]);
    await unitsKey(page);
    await tap(page, ["enter", "d1", "d9"]);
    await flick(page, "enter", "up");
    const value = page.getByTestId("unit-result").locator(".value");
    await expect(value).toHaveText("157.079632679");
    await page.evaluate(() => {
      const calc = window.n62.calc;
      const units = calc.units.bind(calc);
      const w = window as unknown as { unitCalls: number };
      w.unitCalls = 0;
      calc.units = (...a) => {
        w.unitCalls++;
        return units(...a);
      };
    });
    await tap(page, ["@mode", "d3", "d2"]); // Mode (on Format) › Significant digits › 6: the pick closes the sheet
    await backOnView(page);
    await expect(value).toHaveText(/^157\.080?$/);
    await expect(page.getByTestId("unit-unit")).toHaveText("mm");
    expect(await page.evaluate(() => (window as unknown as { unitCalls: number }).unitCalls)).toBe(0);
  });
});
