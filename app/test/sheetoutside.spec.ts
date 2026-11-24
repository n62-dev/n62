// SPDX-License-Identifier: GPL-3.0-or-later
// R770 (owner, 2026-11-19, ends R144's "a tap beside a pick sheet closes it"): every sheet is in the viewport and the keys
// stay live below it. A key the sheet does not use (Undo, Help, Select, Deselect, a free key, Shift + Undo) is dead: the
// sheet stays and nothing else happens (no step, no template, no Undo, no copy). ▲ ▼ and a trackpad drag move the
// highlight; Esc goes back one level (the root closes); a tap on the history outside the sheet closes it. A hardware
// keyboard drives the sheet too (▼, a digit, Enter, Escape); Find and Vars, which take letters, keep typing them from the
// keypad; in Settings › Your keys a free key still goes to its row (R4b); the status line's ☰, place and view tabs keep
// their jobs. Expected values derived from the rule.
import { expect, test, type Page } from "@playwright/test";
import { drag, entryValue, open, sheet, tap, touch, closeSheet, historyPoint, tapHistory } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page);
  await tap(page, ["d1", "add", "d1", "enter", "d7", "d8"]); // one history row, and 78 on the line
  await expect(page.locator("[data-status]")).toHaveCount(1);
  expect(await entryValue(page)).toBe("78");
});

/** The pick sheets of the task: Tmpl, Home's ☰, the Mode sheet (the format chip) and the Shift + 9 grid. */
const OPENERS: Record<string, (page: Page) => Promise<void>> = {
  tmpl: (page) => tap(page, ["tmpl"]),
  "home menu": (page) => tap(page, ["@menu"]),
  mode: (page) => page.getByTestId("chip-format").tap(),
  "shift 9": (page) => tap(page, ["shift", "d9"]),
};
/** An on-screen tap on a key the sheet does not use. */
const DEAD: Record<string, (page: Page) => Promise<void>> = {
  Undo: (page) => page.locator('[data-key="undo"]').tap(),
  "Settings (the ⚙ key's tap, R863)": (page) => page.locator('[data-key="help"]').tap(),
  "Help (Shift, the ⚙ key; R723, R863)": async (page) => {
    await tap(page, ["shift"]);
    await page.locator('[data-key="help"]').tap();
  },
  Select: (page) => page.locator('[data-key="select"]').tap(),
  Deselect: (page) => page.locator('[data-key="deselect"]').tap(),
  "⇤ (Shift, Undo)": async (page) => {
    await tap(page, ["shift"]);
    await page.locator('[data-key="undo"]').tap();
  },
  U1: (page) => page.locator('[data-key="u1"]').tap(),
  sin: (page) => page.locator('[data-key="sin"]').tap(),
};

/** What a closing tap must leave as it was: the line, the history and every setting. */
const state = (page: Page): Promise<string> =>
  page.evaluate(() => JSON.stringify([window.n62.entry.value, window.n62.session.items.length, window.n62.session.settings]));

for (const [name, openSheet] of Object.entries(OPENERS)) {
  test.describe(`with ${name} open`, () => {
    for (const [what, press] of Object.entries(DEAD)) {
      test(`an on-screen ${what} is dead: the sheet stays and nothing else happens`, async ({ page }) => {
        const before = await state(page);
        await openSheet(page);
        await expect(sheet(page)).toBeVisible();
        await press(page);
        await page.waitForTimeout(150);
        await expect(sheet(page)).toBeVisible();
        expect(await state(page)).toBe(before);
        expect(await entryValue(page)).toBe("78"); // no template inserted, no undo done
      });
    }

    test("the on-screen Esc closes the root", async ({ page }) => {
      await openSheet(page);
      await page.locator('[data-key="esc"]').tap();
      await expect(sheet(page)).toHaveCount(0);
      expect(await entryValue(page)).toBe("78");
    });

    test("a hardware ▼ moves the highlight and Escape closes", async ({ page }) => {
      await openSheet(page);
      const active = sheet(page).locator('[data-active="true"]');
      const first = await active.getAttribute("data-id");
      await page.keyboard.press("ArrowDown");
      await expect(sheet(page)).toBeVisible();
      await expect(active).not.toHaveAttribute("data-id", first ?? "");
      await page.keyboard.press("Escape");
      await expect(sheet(page)).toHaveCount(0);
      expect(await entryValue(page)).toBe("78");
    });
  });
}

// A tap on the history closes a sheet that leaves history to tap; a sheet that fills the whole view (Mode, Settings levels, ☰ at
// 360 × 740) has none, and closes by Esc, Back or its × (R144, R146 as R770f1 reads them; docs/05 3.1). The point is computed from
// the sheet's box and the history's box (historyPoint), clear of the sheet's own margin.
test.describe("412 × 915: a tap on the history outside the sheet closes it", () => {
  test.use({ viewport: { width: 412, height: 915 } });
  for (const [name, openSheet] of Object.entries(OPENERS)) {
    test(`with ${name} open: it closes and does nothing else`, async ({ page }) => {
      const before = await state(page);
      await openSheet(page);
      const p = await historyPoint(page);
      expect(p, "this sheet leaves history to tap at 412 × 915").not.toBeNull();
      await tapHistory(page);
      await expect(sheet(page)).toHaveCount(0);
      await page.waitForTimeout(150);
      expect(await state(page)).toBe(before);
    });
  }
  test("Mode › Settings (a tall level): it closes too", async ({ page }) => {
    await tap(page, ["@mode", "d6"]);
    await expect(page.getByTestId("sheet-title")).toHaveText("Mode › Settings");
    await tapHistory(page);
    await expect(sheet(page)).toHaveCount(0);
  });
});

test.describe("360 × 740: a sheet that fills the view leaves no history to tap and closes by Esc, Back or ×", () => {
  test.use({ viewport: { width: 360, height: 740 } });
  const FULL: Record<string, (page: Page) => Promise<void>> = {
    Mode: (page) => tap(page, ["@mode"]),
    "Mode › Settings": (page) => tap(page, ["@mode", "d6"]),
    "Plot ☰": async (page) => {
      await tap(page, ["@symb", "@plot"]);
      await page.getByTestId("menu-button").tap();
    },
  };
  for (const [name, openSheet] of Object.entries(FULL)) {
    test(`${name}: no history point; × closes it`, async ({ page }) => {
      await openSheet(page);
      await expect(sheet(page)).toBeVisible();
      expect(await historyPoint(page)).toBeNull();
      const [h, s] = [await page.locator(".screen").boundingBox(), await sheet(page).boundingBox()];
      expect(h && s && s.y + s.height >= h.y + h.height - 8, "the sheet runs to the bottom of the view").toBe(true);
      const line = await entryValue(page);
      await sheet(page).getByRole("button", { name: "Close" }).tap();
      await expect(sheet(page)).toHaveCount(0);
      expect(await entryValue(page)).toBe(line);
    });
  }
  test("Home ☰ fits on the bar with the line's room (R891): a tap on the history above it closes it", async ({ page }) => {
    await tap(page, ["@menu"]);
    await expect(sheet(page)).toBeVisible();
    const line = await entryValue(page);
    await tapHistory(page);
    await expect(sheet(page)).toHaveCount(0);
    expect(await entryValue(page)).toBe(line);
  });
  test("a short sheet still closes by a tap on the history", async ({ page }) => {
    await page.evaluate(() => window.n62.shell.showMenu("Test", [{ id: "a", label: "A", run: () => {} }, { id: "b", label: "B", run: () => {} }]));
    await expect(sheet(page)).toBeVisible();
    expect(await historyPoint(page)).not.toBeNull();
    await closeSheet(page);
    await expect(sheet(page)).toHaveCount(0);
  });
});

test("a trackpad drag moves the highlight of an open sheet: it stays open and picks nothing", async ({ page }) => {
  await tap(page, ["esc"]); // an empty line: a step with no sheet would pick the history row (P4)
  expect(await entryValue(page)).toBe("");
  await tap(page, ["@menu"]);
  await drag(page, '[data-testid="pad-hub"]', 0, 30);
  await expect(sheet(page)).toBeVisible();
  await expect(page.getByTestId("row-actions")).toHaveCount(0);
});

test("a held ⌫ over a short sheet leaves it open and the line as it was", async ({ page }) => {
  await tap(page, ["@place"]); // the Apps sheet: four rows
  await expect(page.getByTestId("apps")).toBeVisible();
  const f = await touch(page, "bksp");
  await page.waitForTimeout(800); // past the repeat delay (400 ms) and several repeats
  await f.end();
  await expect(page.getByTestId("apps")).toBeVisible();
  expect(await entryValue(page)).toBe("78");
});

test("Esc on screen goes back one level from a submenu, then closes the root", async ({ page }) => {
  await tap(page, ["@mode", "d6"]); // Mode › Settings
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode › Settings");
  await page.locator('[data-key="esc"]').tap();
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode");
  await page.locator('[data-key="esc"]').tap();
  await expect(sheet(page)).toHaveCount(0);
});

test("a hardware Enter picks in Tmpl, a hardware digit picks in a menu", async ({ page }) => {
  await tap(page, ["tmpl"]);
  await page.keyboard.press("Enter"); // the highlighted template (the first: a fraction) goes on the line
  await expect(sheet(page)).toHaveCount(0);
  expect(await entryValue(page)).not.toBe("78");
  await tap(page, ["@mode"]); // the Mode sheet on Angle
  await page.keyboard.press("1"); // a digit steps its row's value: RAD → DEG
  await expect(page.getByTestId("chip-angle")).toHaveAttribute("data-angle", "deg");
});

test("Find and Vars keep typing letters from the keypad (Tmpl is c, Vars is a)", async ({ page }) => {
  await tap(page, ["math", "tmpl"]);
  await expect(page.getByTestId("sheet-filter")).toHaveText("c");
  await tap(page, ["esc", "esc"]);
  await expect(sheet(page)).toHaveCount(0);
  await tap(page, ["vars", "vars"]);
  await expect(page.getByTestId("sheet-filter")).toHaveText("a");
});

test("Settings › Your keys: an on-screen U1 goes to its row, the sheet stays", async ({ page }) => {
  await tap(page, ["@mode", "d6", "d4"]);
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode › Settings › Your keys");
  await page.locator('[data-key="u1"]').tap();
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode › Settings › Your keys");
  await expect(sheet(page).locator('[data-active="true"]')).toHaveAttribute("data-id", "u1:primary");
});

test("☰, the place name and a view tab keep their jobs over an open sheet", async ({ page }) => {
  await tap(page, ["@menu"]);
  await expect(sheet(page)).toBeVisible();
  await page.getByTestId("menu-button").tap(); // ☰ toggles its menu
  await expect(sheet(page)).toHaveCount(0);
  await tap(page, ["tmpl"]);
  await page.getByTestId("place").tap(); // the place name opens the Apps sheet in its place
  await expect(page.getByTestId("apps")).toBeVisible();
  await page.locator('[data-testid="apps"] [role="menuitem"][data-id="function"]').tap();
  await expect(page.getByTestId("place")).toHaveAttribute("data-app", "function");
  await tap(page, ["tmpl"]);
  await page.getByTestId("tab-plot").tap(); // a view tab closes the sheet and goes there
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByTestId("place")).toHaveAttribute("data-view", "plot");
});
