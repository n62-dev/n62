// SPDX-License-Identifier: GPL-3.0-or-later
// R927 (docs/05 3.4, decisions.md "Settings over Mode (owner, 2026-11-24)"): Settings is the top level and Mode its row 1, Preset
// first in Mode, no Settings row in Mode. ⚙ (the key, a user key that holds Settings, a ☰ menu's ⚙) opens the Settings root; the
// `STD 12 ▾` chip opens Settings › Mode on Format, so back walks up the tree. The fake engine.
import { expect, test, type Page } from "@playwright/test";
import { open, sheet, tap } from "./helpers.ts";

const title = (page: Page) => page.getByTestId("sheet-title");
const row = (page: Page, id: string) => sheet(page).locator(`[role="menuitem"][data-id="${id}"]`);
const active = (page: Page) => sheet(page).locator('[data-active="true"]');
const rowIds = (page: Page) => sheet(page).getByRole("menuitem").evaluateAll((els) => els.map((e) => e.getAttribute("data-id")));
const SETTINGS = ["mode", "appearance", "numbers", "vibration", "keys", "data", "counters", "help"];
const MODE = ["preset", "angle", "format", "digits", "entry"];

/** The Settings root, as ⚙ opens it: row 1 Mode with its value, then the seven sections. */
async function settingsRoot(page: Page): Promise<void> {
  await expect(title(page)).toHaveText("Settings");
  expect(await rowIds(page)).toEqual(SETTINGS);
  await expect(row(page, "mode").getByTestId("sheet-value")).toHaveText("STD 12 RAD");
  await expect(active(page)).toHaveAttribute("data-id", "mode");
}

for (const [w, h] of [[360, 740], [412, 915]] as const)
  test.describe(`at ${w} × ${h}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await open(page);
    });

    test("the ⚙ key opens the Settings root; 1 opens Mode (Preset first, no Settings row); ‹ goes back onto row 1", async ({ page }) => {
      await tap(page, ["help"]);
      await settingsRoot(page);
      await tap(page, ["d1"]);
      await expect(title(page)).toHaveText("Settings › Mode");
      expect(await rowIds(page)).toEqual(MODE);
      await sheet(page).getByRole("button", { name: "Back" }).tap();
      await settingsRoot(page);
      await tap(page, ["d2"]);
      await expect(title(page)).toHaveText("Settings › Appearance");
      await tap(page, ["esc", "esc"]);
      await expect(sheet(page)).toHaveCount(0);
    });

    test("a user key that holds Settings opens the Settings root", async ({ page }) => {
      await page.evaluate(() => window.n62.userKeys.set("u1", "primary", { label: "Settings", action: { special: "settings" } }));
      await tap(page, ["u1"]);
      await settingsRoot(page);
    });

    // (◀ on a Mode row steps its value, as every value row's ◀ does: each Mode row has one)
    test("the chip opens Settings › Mode on Format; Esc, ‹ or Android back goes to the Settings root on row 1, a second one closes", async ({ page }) => {
      for (const up of [() => tap(page, ["esc"]), () => page.evaluate(() => history.back()), () => sheet(page).getByRole("button", { name: "Back" }).tap()]) {
        await page.getByTestId("chip-format").tap();
        await expect(title(page)).toHaveText("Settings › Mode");
        expect(await rowIds(page)).toEqual(MODE);
        await expect(active(page)).toHaveAttribute("data-id", "format");
        await up();
        await settingsRoot(page);
        await tap(page, ["esc"]);
        await expect(sheet(page)).toHaveCount(0);
      }
    });

    test("a user key that holds Mode opens Settings › Mode on Angle", async ({ page }) => {
      await page.evaluate(() => window.n62.userKeys.set("u1", "primary", { label: "Mode", action: { special: "mode" } }));
      await tap(page, ["u1"]);
      await expect(title(page)).toHaveText("Settings › Mode");
      await expect(active(page)).toHaveAttribute("data-id", "angle");
      await tap(page, ["esc"]);
      await settingsRoot(page);
    });

    test("☰'s ⚙ and the ⚙ key over Find or Vars: Settings with Mode at row 1 as the sheet's next level; Mode there has no Settings row", async ({ page }) => {
      await tap(page, ["@menu"]);
      await page.getByTestId("sheet-gear").tap();
      await expect(title(page)).toHaveText("Home menu › Settings");
      expect(await rowIds(page)).toEqual(SETTINGS);
      await tap(page, ["d1"]);
      await expect(title(page)).toHaveText("Home menu › Settings › Mode");
      expect(await rowIds(page)).toEqual(MODE);
      await tap(page, ["help"]); // no loop: Settings is open in this sheet
      await expect(title(page)).toHaveText("Home menu › Settings › Mode");
      await tap(page, ["esc", "esc", "esc"]);
      await expect(sheet(page)).toHaveCount(0);
      for (const key of ["math", "vars"]) {
        const any = page.getByTestId("menu").or(page.getByTestId("find"));
        await tap(page, [key]);
        const before = (await title(page).textContent())?.trim() ?? "";
        await tap(page, ["help"]);
        await expect(title(page)).toHaveText(`${before} › Settings`);
        expect(await any.getByRole("menuitem").evaluateAll((els) => els.map((e) => e.getAttribute("data-id")))).toEqual(SETTINGS);
        await tap(page, ["esc", "esc"]);
        await expect(any).toHaveCount(0);
      }
    });

    test("the ⚙ key in Settings › Mode (from the chip) adds no level", async ({ page }) => {
      await page.getByTestId("chip-format").tap();
      await expect(title(page)).toHaveText("Settings › Mode");
      await tap(page, ["help"]);
      await expect(title(page)).toHaveText("Settings › Mode");
    });
  });
