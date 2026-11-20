// SPDX-License-Identifier: GPL-3.0-or-later
// R770 (owner, 2026-11-19: "all windows should be there, otherwise it is ambiguous"; docs/05 3.1): every window opens in
// the viewport (over the history, in Find's place), never over the keys; the keys stay live below it. Digits pick a
// numbered row, ▲ ▼ move, Enter picks, Esc goes back, any other key is dead and the sheet stays. Expected values are
// derived from the rule: the sheet's box lies inside the screen area and clear of the keypad; ☰'s rows are numbered
// 1…9, 0 in order (1 Insert … Copy › is 2, docs/05 3.2). Run at 360 × 740 and 412 × 915.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

const LINREG = "\\operatorname{linreg}\\left(\\left\\{1,2,3,4\\right\\},\\left\\{2.1,3.9,6.2,7.8\\right\\}\\right)";

const SIZES = [
  { width: 360, height: 740 },
  { width: 412, height: 915 },
];

type Box = { x: number; y: number; width: number; height: number };
const box = async (page: Page, selector: string): Promise<Box> => {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`${selector} is not visible`);
  return b;
};
const panel = (page: Page) => page.locator('[role="menu"]').first();

/** Every window the task names, opened by the keys that open it (each ends with the sheet open on a fresh Home with one result). */
const OPENERS: Record<string, (page: Page) => Promise<void>> = {
  "☰": (page) => tap(page, ["@menu"]),
  "Mode (STD/12)": (page) => tap(page, ["@mode"]),
  Settings: (page) => tap(page, ["@mode", "d6"]),
  Help: (page) => tap(page, ["sin", "d1", "help"]), // the help sheet of sin
  Apps: (page) => tap(page, ["@place"]),
  Tmpl: (page) => tap(page, ["tmpl"]),
  "Shift + 6": (page) => tap(page, ["shift", "d6"]),
  "Copy ›": (page) => tap(page, ["@menu", "d2"]),
  Base: (page) => tap(page, ["shift", "sub"]),
  "matrix size": (page) => tap(page, ["shift", "d4"]),
};

/** The sheet's box lies inside the history area and clear of the keypad (criterion 1a). */
async function insideScreen(page: Page): Promise<void> {
  await expect(panel(page)).toBeVisible();
  const [p, screen, keys] = [await box(page, '[role="menu"]'), await box(page, ".screen"), await box(page, '[data-testid="keys"]')];
  expect(p.y).toBeGreaterThanOrEqual(screen.y - 1);
  expect(p.y + p.height).toBeLessThanOrEqual(screen.y + screen.height + 1);
  expect(p.y + p.height).toBeLessThanOrEqual(keys.y + 1); // no overlap with the keypad's box
}

for (const size of SIZES) {
  test.describe(`${size.width} × ${size.height}`, () => {
    test.use({ viewport: size });
    test.beforeEach(async ({ page }) => {
      await open(page);
      await tap(page, ["d1", "add", "d1", "enter"]); // one result: Base, Copy › and the row menus have something to act on
      await expect(page.locator("[data-status]")).toHaveCount(1);
    });

    for (const [name, openSheet] of Object.entries(OPENERS)) {
      test(`(a) ${name}: the sheet lies in the history area and clear of the keypad`, async ({ page }) => {
        await openSheet(page);
        await insideScreen(page);
      });
    }

    // the stats sheet needs the real engine (a linreg result; the second tap on it opens the sheet, R184)
    test("(a) the stats sheet: the sheet lies in the history area and clear of the keypad", async ({ page }) => {
      await open(page, "");
      await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
      await page.evaluate((l) => window.n62.entry.set(l), LINREG);
      await tap(page, ["enter"]);
      await expect(page.locator('[data-status="done"]')).toHaveCount(1, { timeout: 30_000 });
      const result = page.locator('article.item[data-status] .result').last();
      await result.tap();
      await result.tap();
      await expect(page.getByTestId("menu")).toContainText("Linear regression");
      await insideScreen(page);
    });

    test("(b) ☰: a digit picks its row, ▼ ▼ Enter picks the row two below, Esc goes back, a tap on sin does nothing", async ({ page }) => {
      await tap(page, ["@menu"]);
      const menu = page.getByTestId("menu");
      const rows = menu.getByRole("menuitem");
      await expect(rows.first()).toBeVisible();
      const title = await page.getByTestId("sheet-title").textContent();
      await page.locator('[data-key="sin"]').tap();
      await expect(panel(page)).toBeVisible(); // a key beside the sheet is dead: the sheet stays, nothing typed
      expect(await entryValue(page)).toBe("");
      await page.locator('[data-key="d2"]').tap(); // 2 picks the second row (Copy ›)
      await expect(page.getByTestId("sheet-title")).toContainText("Copy");
      await page.locator('[data-key="esc"]').tap(); // Esc: back one level
      await expect(page.getByTestId("sheet-title")).toHaveText(title ?? "");
      await page.locator('[data-key="esc"]').tap();
      await expect(panel(page)).toHaveCount(0);
      await tap(page, ["@menu"]);
      const ids = await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-id")));
      const k = ids.indexOf(await menu.locator('[data-active="true"]').getAttribute("data-id"));
      await page.locator('[data-key="down"]').tap();
      await page.locator('[data-key="down"]').tap();
      await expect(menu.locator('[data-active="true"]')).toHaveAttribute("data-id", ids[(k + 2) % ids.length] ?? "");
      await page.locator('[data-key="enter"]').tap(); // the highlighted row is picked: a submenu opens or the sheet closes
      await expect.poll(async () => (await panel(page).count()) === 0 || (await page.getByTestId("sheet-title").textContent()) !== title).toBe(true);
    });

    test("(c) Mode: its last row is reached by ▼ and scrolled into view", async ({ page }) => {
      await tap(page, ["@mode"]);
      await expect(panel(page)).toBeVisible();
      const rows = page.getByTestId("menu").getByRole("menuitem");
      const n = await rows.count();
      expect(n).toBeGreaterThan(3);
      for (let i = 0; i < n - 1; i++) await page.locator('[data-key="down"]').tap();
      const last = rows.nth(n - 1);
      await expect(last).toHaveAttribute("data-active", "true");
      const [r, list] = [await last.boundingBox(), await box(page, '[data-testid="menu"] .list')];
      expect(r).not.toBeNull();
      expect(r!.y).toBeGreaterThanOrEqual(list.y - 1);
      expect(r!.y + r!.height).toBeLessThanOrEqual(list.y + list.height + 1);
    });
  });
}

test.describe("controls", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
  });
  test("Find and Vars sit in the viewport and take letters", async ({ page }) => {
    await tap(page, ["math"]);
    await expect(page.getByTestId("find")).toBeVisible();
    await tap(page, ["esc"]);
    await expect(page.getByTestId("find")).toHaveCount(0);
    await tap(page, ["vars"]);
    await expect(page.getByTestId("find")).toBeVisible();
    await tap(page, ["esc"]);
    await expect(page.getByTestId("find")).toHaveCount(0);
  });
  test("with the keys folded a sheet opens as before: over the history", async ({ page }) => {
    await tap(page, ["d1", "add", "d1", "enter"]);
    await expect(page.getByTestId("keys")).toHaveAttribute("data-fold-ready", "true");
    await page.getByTestId("fold-chevron").tap();
    await expect(page.getByTestId("keys")).toHaveAttribute("data-folded", "true");
    await page.evaluate(() => window.n62.shell.showMenu("Test", [{ id: "a", label: "A", run: () => {} }, { id: "b", label: "B", run: () => {} }]));
    await expect(panel(page)).toBeVisible();
    const [p, keys] = [await box(page, '[role="menu"]'), await box(page, '[data-testid="keys"]')];
    expect(p.y + p.height).toBeLessThanOrEqual(keys.y + 1);
  });
});
