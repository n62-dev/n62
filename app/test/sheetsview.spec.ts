// SPDX-License-Identifier: GPL-3.0-or-later
// R770 (owner, 2026-11-19: "all windows should be there, otherwise it is ambiguous"; docs/05 3.1): every window opens in
// the viewport (over the history, in Find's place), never over the keys; the keys stay live below it. Digits pick a
// numbered row, ▲ ▼ move, Enter picks, Esc goes back, any other key is dead and the sheet stays. Expected values are
// derived from the rule: the sheet's box lies inside the screen area and clear of the keypad; ☰'s rows are numbered
// 1…9, 0 in order (R830: ☰ has four rows, docs/05 3.3). Run at 360 × 740 and 412 × 915.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, recordVibrations, tap, vibrations } from "./helpers.ts";

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
  Settings: (page) => tap(page, ["help"]),
  Help: (page) => tap(page, ["sin", "d1", "shift", "help"]), // the help sheet of sin (Shift + the ⚙ key, R863)
  Apps: (page) => tap(page, ["@place"]),
  Tmpl: (page) => tap(page, ["tmpl"]),
  "Shift + 6": (page) => tap(page, ["shift", "d6"]),
  "Copy ›": async (page) => {
    await tap(page, ["up"]); // the picked row's bar (R830: ☰ has no Copy row)
    await page.getByTestId("row-actions").getByRole("button", { name: /Copy/ }).tap();
  },
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
      await page.locator('[data-key="d4"]').tap(); // 4 picks the fourth row (Export ›, R830)
      await expect(page.getByTestId("sheet-title")).toContainText("Export");
      await page.locator('[data-key="esc"]').tap(); // Esc: back one level
      await expect(page.getByTestId("sheet-title")).toHaveText(title ?? "");
      await page.locator('[data-key="esc"]').tap();
      await expect(panel(page)).toHaveCount(0);
      // criterion 1(b): in a known state (one result on the history) ☰'s rows are Delete, Share, Clear, Export › in that order (R830);
      // the digit 1 picks the first by its effect (Delete drops the one history row) and the sheet closes
      const items = (): Promise<number> => page.evaluate(() => window.n62.session.items.length);
      await tap(page, ["@menu"]);
      await expect(rows.first()).toBeVisible();
      const ids = await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-id")));
      expect(ids).toEqual(["delete", "share", "clear", "export"]);
      await expect(rows.nth(0)).toContainText("Delete");
      expect(await items()).toBe(1);
      const at = async (): Promise<number> => ids.indexOf(await menu.locator('[data-active="true"]').getAttribute("data-id"));
      if ((await at()) === 0) await page.locator('[data-key="down"]').tap(); // the sheet remembers the last pick: the highlight must not already sit on row 1
      expect(await at()).not.toBe(0);
      await page.locator('[data-key="d1"]').tap();
      await expect(panel(page)).toHaveCount(0);
      expect(await items()).toBe(0); // the first row ran (Delete), not the second (Share) or the fourth (Export ›)
      // ▼ ▼ Enter from the highlighted row (the first) picks the row two below it, the third (Clear history): again a state with one result
      await tap(page, ["d1", "add", "d1", "enter"]);
      await expect(page.locator("[data-status]")).toHaveCount(1);
      await tap(page, ["@menu"]);
      await expect(rows.first()).toBeVisible();
      for (let i = await at(); i > 0; i--) await page.locator('[data-key="up"]').tap(); // the sheet opens on the last pick: ▲ to the first row
      await expect(menu.locator('[data-active="true"]')).toHaveAttribute("data-id", ids[0] ?? "");
      await page.locator('[data-key="down"]').tap();
      await page.locator('[data-key="down"]').tap();
      await expect(menu.locator('[data-active="true"]')).toHaveAttribute("data-id", ids[2] ?? ""); // two below the first row
      await expect(menu.locator('[data-active="true"]')).toContainText("Clear");
      await page.locator('[data-key="enter"]').tap(); // the highlighted row is picked: Clear history empties the history, the sheet closes
      await expect(panel(page)).toHaveCount(0);
      expect(await items()).toBe(0);
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

// R770f1: a key the sheet does not use gives the dead key's feedback (route.ts c.dead(): the double pulse; R777: alone when the key is
// alone for ⌫ on an empty filter too, which the route turns into nothing); the sheet stays and the line is as it was. A key the sheet uses gives the key's pulse alone.
test.describe("☰ open: the dead key's pulses", () => {
  test.beforeEach(async ({ page }) => {
    await recordVibrations(page);
    await open(page);
    await page.evaluate(() => window.n62.session.setHaptics({ on: true, ms: 10 }));
    await tap(page, ["d1", "add", "d1", "enter", "d7"]);
    await expect(page.locator("[data-status]")).toHaveCount(1);
    await tap(page, ["@menu"]);
    await expect(page.getByTestId("menu").getByRole("menuitem").first()).toBeVisible();
  });
  const stays = async (page: Page): Promise<void> => {
    await expect(panel(page)).toBeVisible();
    expect(await entryValue(page)).toBe("7");
    expect(await page.evaluate(() => window.n62.session.items.length)).toBe(1);
  };
  const pulses = async (page: Page, press: () => Promise<unknown>): Promise<number> => {
    const v0 = (await vibrations(page)).length;
    await press();
    await page.waitForTimeout(250); // the pulses of one press have all been sent
    return (await vibrations(page)).length - v0;
  };
  test("a key the sheet uses (▼) gives the key's pulse alone", async ({ page }) => {
    expect(await pulses(page, () => page.locator('[data-key="down"]').tap())).toBe(1);
    await stays(page);
  });
  test("a tap on sin (drawn dead) gives the dead pulses alone, and nothing else happens", async ({ page }) => {
    expect(await pulses(page, () => page.locator('[data-key="sin"]').tap())).toBe(2); // R777: no key pulse on a key drawn dead
    await stays(page);
  });
  test("a tap on Undo (drawn dead) gives the dead pulses alone, and nothing else happens", async ({ page }) => {
    expect(await pulses(page, () => page.locator('[data-key="undo"]').tap())).toBe(2);
    await stays(page);
  });
  test("⌫ with an empty filter gives the dead pulses alone (R777); the sheet stays and the line is unchanged", async ({ page }) => {
    await expect(page.getByTestId("sheet-filter")).toHaveCount(0); // no filter typed
    expect(await pulses(page, () => page.locator('[data-key="bksp"]').tap())).toBe(2);
    await stays(page);
  });
});
