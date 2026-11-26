// SPDX-License-Identifier: GPL-3.0-or-later
// R900 (owner-style hunt 2026-11-23, h2 #12, #15): the Paste key (Shift + Deselect) in a sheet with a name filter (Find, Vars, Store in)
// types the clipboard's first line into the filter when it is a name (a letter, then letters, digits and `_`, at most 32 characters);
// any other text is the dead press and the sheet stays. Before, Store in closed and pasted on the line ("Paste: not a number") and
// Find took it as a dead press. Controls: Memory's Paste (R816 is still to come: a dead press, nothing typed), Paste on the line.
// The real engine; the expected values are the typed names themselves.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, recordVibrations, setClipboard, tap, vibrations } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

const store = (page: Page) => page.getByTestId("store");
const find = (page: Page) => page.getByTestId("find");
const active = (page: Page) => find(page).locator('[role="menuitem"][data-active="true"]');
const names = (page: Page) => page.evaluate(() => window.n62.session.userNames.map((u) => u.name).sort());
/** The dead press after `before`: the double pulse (R777). `read`: Paste in a sheet reads the clipboard after finger-down, so the
 *  key gets its own press pulse first, then the double one (3); a key known dead at finger-down gets the double pulse alone (2). */
const deadAfter = async (page: Page, before: number, read = true): Promise<void> => {
  await expect.poll(async () => (await vibrations(page)).length - before).toBe(read ? 3 : 2);
};

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await recordVibrations(page);
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
});

test("Store in: 7 Shift + ᴇ, Paste with ZZ types ZZ into the name filter, the sheet stays; Enter stores ZZ", async ({ page }) => {
  await setClipboard(page, "ZZ");
  await tap(page, ["d7", "shift", "emark"]);
  await expect(store(page).getByTestId("sheet-title")).toHaveText("Store 7 in");
  await tap(page, ["shift", "deselect"]);
  await expect(store(page).getByTestId("sheet-filter")).toHaveText("ZZ");
  await expect(store(page).getByTestId("sheet-title")).toHaveText("Store 7 in");
  await expect(page.getByTestId("notice")).toHaveCount(0);
  expect(await entryValue(page)).toBe("7\\blacktriangleright");
  await tap(page, ["enter"]);
  await expect(store(page)).toBeHidden();
  await expect.poll(() => names(page)).toEqual(["ZZ"]);
});

test("Store in: the clipboard's first line is the name (ZZ, then a second line); a name with digits and _ (T_1) is typed whole", async ({ page }) => {
  await setClipboard(page, "ZZ\nmore text");
  await tap(page, ["d7", "shift", "emark"]);
  await tap(page, ["shift", "deselect"]);
  await expect(store(page).getByTestId("sheet-filter")).toHaveText("ZZ");
  await tap(page, ["esc"]);
  await expect(store(page)).toBeHidden();
  await setClipboard(page, "T_1");
  await tap(page, ["shift", "emark"]);
  await expect(store(page)).toBeVisible();
  await tap(page, ["shift", "deselect"]);
  await expect(store(page).getByTestId("sheet-filter")).toHaveText("T_1");
});

test("Store in: the clipboard 1+2 is no name: the dead press, the sheet stays with nothing typed, the line keeps 7 ▶", async ({ page }) => {
  await page.evaluate(() => window.n62.session.setHaptics({ on: true, ms: 10 }));
  await setClipboard(page, "1+2");
  await tap(page, ["d7", "shift", "emark"]);
  await expect(store(page).getByTestId("sheet-title")).toHaveText("Store 7 in");
  await tap(page, ["shift"]);
  const v = (await vibrations(page)).length;
  await tap(page, ["deselect"]);
  await deadAfter(page, v);
  await expect(store(page)).toBeVisible();
  await expect(store(page).getByTestId("sheet-filter")).toHaveCount(0);
  await expect(page.getByTestId("notice")).toHaveCount(0);
  expect(await entryValue(page)).toBe("7\\blacktriangleright");
});

test("Store in: a name past 32 characters is no name: the dead press, the sheet stays", async ({ page }) => {
  await page.evaluate(() => window.n62.session.setHaptics({ on: true, ms: 10 }));
  await setClipboard(page, "a".repeat(33));
  await tap(page, ["d7", "shift", "emark"]);
  await expect(store(page)).toBeVisible();
  await tap(page, ["shift"]);
  const v = (await vibrations(page)).length;
  await tap(page, ["deselect"]);
  await deadAfter(page, v);
  await expect(store(page)).toBeVisible();
  await expect(store(page).getByTestId("sheet-filter")).toHaveCount(0);
});

test("Find: Paste with erfc types the query erfc, its row highlighted; Enter puts it on the line", async ({ page }) => {
  await setClipboard(page, "erfc");
  await tap(page, ["math"]);
  await expect(find(page)).toBeVisible();
  await tap(page, ["shift"]);
  await expect(page.locator('[data-key="deselect"]')).not.toHaveAttribute("data-dead", "true"); // drawn as what it does there (R820)
  await tap(page, ["deselect"]);
  await expect(find(page).getByTestId("sheet-filter")).toHaveText("erfc");
  await expect(active(page)).toContainText("erfc");
  await tap(page, ["enter"]);
  await expect(find(page)).toBeHidden();
  await expect.poll(() => entryValue(page)).toMatch(/erfc/);
});

test("Vars: Paste with a stored name's text types it into the filter and highlights the name", async ({ page }) => {
  await tap(page, ["d5", "shift", "emark", "alpha", "vars", "enter"]);
  await expect.poll(() => names(page)).toEqual(["A"]);
  await tap(page, ["d6", "shift", "emark", "alpha", "math", "enter"]);
  await expect.poll(() => names(page)).toEqual(["A", "B"]);
  await setClipboard(page, "B");
  await tap(page, ["vars"]);
  await expect(find(page)).toBeVisible();
  await tap(page, ["shift", "deselect"]);
  await expect(find(page).getByTestId("sheet-filter")).toHaveText(/^b$/i);
  await expect(active(page)).toContainText("B");
});

test("controls: Memory's Paste stays a dead press with nothing typed (R816 to come); Paste on the line still pastes a number", async ({ page }) => {
  await page.evaluate(() => window.n62.session.setHaptics({ on: true, ms: 10 }));
  await tap(page, ["d5", "shift", "emark", "alpha", "vars", "enter"]);
  await expect.poll(() => names(page)).toEqual(["A"]);
  await setClipboard(page, "A");
  await tap(page, ["shift", "math"]);
  await expect(find(page)).toBeVisible();
  await tap(page, ["shift"]);
  await expect(page.locator('[data-key="deselect"]')).toHaveAttribute("data-dead", "true"); // Memory: dimmed, dead
  const v = (await vibrations(page)).length;
  await tap(page, ["deselect"]);
  await deadAfter(page, v, false);
  await expect(find(page)).toBeVisible();
  await expect(find(page).getByTestId("sheet-filter")).toHaveCount(0);
  await tap(page, ["esc"]);
  await expect(find(page)).toBeHidden();
  await setClipboard(page, "12");
  await tap(page, ["shift", "deselect"]);
  await expect.poll(() => entryValue(page)).toBe("12");
});
