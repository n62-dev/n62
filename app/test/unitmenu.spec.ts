// SPDX-License-Identifier: GPL-3.0-or-later
// R862: ☰ in the unit view opens the view's tools menu (owner, 2026-11-22, his list point 2; sandra's S3): a sheet titled
// "Units" over the view with Tools' six rows in units/tools.ts's order, then Constants ›, each running what the units
// menu's row runs (R92, unitconst.spec.ts). A tool is ☰ then its digit; a second ☰ closes the sheet onto the view as it
// was (R838's close path). The real engine (the fake one has no unit results). Expected values: derived (72 km/h is the
// line's number in the slots' unit; g₀'s chip is R92's).
import { expect, test, type Page } from "@playwright/test";
import { entryValue, flick, open, tap } from "./helpers.ts";

const up = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element && document.querySelector('[data-pad="unit"]') !== null);
const unitsKey = async (page: Page): Promise<void> => {
  await flick(page, "tmpl", "up");
  await up(page);
};
const menu = (page: Page) => page.getByTestId("menu");
const row = (page: Page, id: string) => menu(page).locator(`[role="menuitem"][data-id="${id}"]`);
const result = (page: Page) => page.getByTestId("unit-result");
const viewOpen = (page: Page): Promise<boolean> => page.evaluate(() => window.n62.unitView !== undefined && document.querySelector('[data-testid="unit-field"]') !== null);
const activeId = (page: Page): Promise<string | undefined> => page.evaluate(() => window.n62.unitView?.view.activeId);
/** The view's slot as text: `k:m / h`. */
const slotText = (page: Page, id: string): Promise<string> =>
  page.evaluate((id) => {
    const s = window.n62.unitView?.view.model(id)?.slot;
    return (s?.tokens ?? []).map((t, i) => `${i === s?.per ? "/ " : ""}${t.prefix ? `${t.prefix}:` : ""}${t.unit}${t.power ? `^${t.power}` : ""}`).join(" ");
  }, id);
const backOnView = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.shell.sheet === null && window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element);
const TOOLS = ["utool:end", "utool:si", "utool:alts", "utool:unit", "utool:number", "utool:store"];
const LABELS = ["Check against a unit", "The SI form", "The alternatives", "The unit alone", "The number into Home", "Store in a name", "Constants"];

/** 72, the units key, k m ÷ h, Enter (evaluates in the last slot, R349): 72 km/h shown. */
async function kmh(page: Page): Promise<void> {
  await tap(page, ["d7", "d2"]);
  await unitsKey(page);
  await tap(page, ["d4", "d9", "div"]);
  await flick(page, "d3", "up"); // h
  await tap(page, ["enter"]);
  await expect(result(page)).toHaveAttribute("data-text", "72");
  await expect(result(page)).toHaveAttribute("data-unit", /km/);
}

for (const [w, h] of [[412, 915], [360, 740]] as const) {
  test.describe(`☰ in the unit view opens its tools (R862), ${w} × ${h}`, () => {
    test.use({ viewport: { width: w, height: h } });
    test.beforeEach(async ({ page }) => {
      await open(page, "");
      await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
    });

    test("with a result, ☰ opens “Units” over the view: the six tools, then Constants ›; the slots stay in the DOM", async ({ page }) => {
      await kmh(page);
      await tap(page, ["@menu"]);
      await expect(menu(page)).toBeVisible();
      await expect(menu(page).getByTestId("sheet-title")).toHaveText("Units");
      await expect(menu(page).getByTestId("sheet-gear")).toBeVisible(); // the ⚙ every ☰ menu has
      const ids = await menu(page).locator('[role="menuitem"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-id")));
      expect(ids).toEqual([...TOOLS, "ucat:const"]);
      const labels = await menu(page).locator('[role="menuitem"] .label').allTextContents();
      expect(labels).toEqual(LABELS);
      await expect(row(page, "utool:number")).not.toHaveAttribute("aria-disabled", "true");
      await expect(row(page, "utool:store")).not.toHaveAttribute("aria-disabled", "true");
      expect(await viewOpen(page)).toBe(true);
      await expect(page.getByTestId("unit-field")).toBeAttached();
      await expect(result(page)).toBeVisible();
      await page.screenshot({ path: test.info().outputPath(`r862-units-menu-${w}.png`) });
    });

    test("5 (the number into Home) leaves the view; Home's line holds the result's chip", async ({ page }) => {
      await kmh(page);
      await tap(page, ["@menu", "d5"]);
      await page.waitForFunction(() => window.n62.unitView === undefined);
      await expect(menu(page)).toBeHidden();
      expect(await entryValue(page)).toMatch(/\\res\{/);
    });

    test("with no result the number into Home and Store in are disabled with their reason; 5 and 6 on them run nothing", async ({ page }) => {
      await tap(page, ["d7", "d2"]);
      await unitsKey(page);
      await tap(page, ["d4", "d9"]);
      await tap(page, ["@menu"]);
      await expect(menu(page)).toBeVisible();
      await expect(row(page, "utool:number")).toHaveAttribute("aria-disabled", "true");
      await expect(row(page, "utool:store")).toHaveAttribute("aria-disabled", "true");
      await expect(menu(page)).toContainText("needs a result first");
      // a digit on a disabled row runs nothing and the sheet stays, as in every sheet (Sheet.activate; docs/05 3.1, 3.3)
      const rows = await page.evaluate(() => window.n62.session.home.length);
      await tap(page, ["d5"]);
      await tap(page, ["d6"]);
      await page.waitForTimeout(300);
      await expect(menu(page)).toBeVisible();
      await expect(menu(page).getByTestId("sheet-title")).toHaveText("Units");
      expect(await viewOpen(page)).toBe(true);
      expect(await page.evaluate(() => window.n62.session.home.length)).toBe(rows);
      expect(await entryValue(page)).not.toMatch(/\\res\{/);
      await tap(page, ["esc"]); // Esc closes the sheet onto the view
      await backOnView(page);
      expect(await slotText(page, "u1")).toBe("k:m");
    });

    test("1 (Check against a unit) closes the sheet and makes the end slot active", async ({ page }) => {
      await kmh(page);
      expect(await activeId(page)).not.toBe("end");
      await tap(page, ["@menu", "d1"]);
      await backOnView(page);
      await expect(menu(page)).toBeHidden();
      expect(await activeId(page)).toBe("end");
      expect(await page.evaluate(() => window.n62.unitView?.view.ids)).toContain("end");
    });

    test("Constants › Physics › g₀ goes on Home's line and the view opens again on it (R92's path)", async ({ page }) => {
      await tap(page, ["d5"]);
      await unitsKey(page);
      await tap(page, ["d4", "d6"]); // k, g
      await tap(page, ["@menu", "d7"]); // Constants ›
      await expect(menu(page).getByTestId("sheet-title")).toHaveText("Units › Constants");
      await row(page, "uconst:Physics").tap();
      await row(page, "const:g_0").tap();
      await expect(menu(page)).toBeHidden();
      await page.waitForFunction(() => /\\const\{g_0\}/.test(window.n62.unitView?.view.line ?? ""));
      await up(page);
      expect(await entryValue(page)).toMatch(/^5.*\\const\{g_0\}/);
      expect(await slotText(page, "u1")).toBe("k:g");
    });

    test("a second ☰ closes the sheet: the view as it was, the focus on it (a hardware ← moves between its slots)", async ({ page }) => {
      await tap(page, ["d3", "div", "d2"]);
      await unitsKey(page);
      await tap(page, ["d4", "d9", "enter"]);
      await flick(page, "d3", "up"); // u1 = km, u2 = h, active
      await tap(page, ["enter"]); // evaluates in the last slot
      await expect(result(page)).toBeVisible();
      const text = await result(page).getAttribute("data-text");
      await tap(page, ["@menu"]);
      await expect(menu(page)).toBeVisible();
      await tap(page, ["@menu"]);
      await backOnView(page);
      await expect(menu(page)).toBeHidden();
      expect(await slotText(page, "u1")).toBe("k:m");
      expect(await slotText(page, "u2")).toBe("h");
      expect(await activeId(page)).toBe("u2");
      await expect(result(page)).toHaveAttribute("data-text", text ?? "");
      await page.keyboard.press("ArrowLeft"); // R808: h is one factor: the first ← moves the caret before it,
      expect(await activeId(page)).toBe("u2");
      await page.keyboard.press("ArrowLeft"); // the second crosses to u1
      await expect.poll(() => activeId(page)).toBe("u1");
    });
  });
}
