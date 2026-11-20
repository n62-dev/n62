// SPDX-License-Identifier: GPL-3.0-or-later
// R776: a name prompt (Settings › Sync › Device name, Presets › Save and Rename) says what it wants and starts in Alpha: the
// Alpha key is locked in lower case, "Type a name. Enter saves, Esc cancels." stays under the entry for as long as the prompt
// is open, the label is in --text, letters need no Alpha press, and Alpha is off again afterwards. The fake engine.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, sheet, tap } from "./helpers.ts";

const HINT = "Type a name. Enter saves, Esc cancels.";
const label = (page: Page) => page.getByTestId("entry-label");
const hint = (page: Page) => page.getByTestId("prompt-hint");
const row = (page: Page, id: string) => sheet(page).locator(`[role="menuitem"][data-id="${id}"]`);
const alphaKey = (page: Page) => page.locator('[data-key="alpha"]');
const mods = (page: Page) => page.evaluate(() => ({ alpha: window.n62.session.alpha, lock: window.n62.session.alphaLock, caps: window.n62.session.capsLock }));

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.emulateMedia({ reducedMotion: "reduce" });
});

/** The prompt is open: its label and hint show, Alpha is locked in lower case. */
async function expectAsking(page: Page, text: string): Promise<void> {
  await expect(label(page)).toHaveText(text);
  await expect(hint(page)).toHaveText(HINT);
  await expect(alphaKey(page)).toHaveAttribute("data-locked", "true");
  expect(await mods(page)).toEqual({ alpha: true, lock: true, caps: true }); // (Home: Shift + Alpha is lower case, R101)
  expect(await label(page).evaluate((e) => getComputedStyle(e).color)).toBe(await page.getByTestId("entry").evaluate((e) => getComputedStyle(e).color));
}
async function expectClosed(page: Page): Promise<void> {
  await expect(label(page)).toHaveCount(0);
  await expect(hint(page)).toHaveCount(0);
  await expect(alphaKey(page)).not.toHaveAttribute("data-locked", "true");
  expect(await mods(page)).toEqual({ alpha: false, lock: false, caps: false });
}

async function openDeviceName(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const cap = {}; // (as settings.spec.ts: the Sync rows are the Android ones)
    Object.defineProperty(cap, "isNativePlatform", { get: () => () => true, set: () => {} });
    (window as unknown as { Capacitor: unknown }).Capacitor = cap;
  });
  await open(page);
  await tap(page, ["d2", "add", "d3"]);
  await tap(page, ["@mode", "d6", "d5"]);
  await row(page, "sync").tap();
  await row(page, "device").tap();
}
const deviceValue = async (page: Page): Promise<string> => {
  await tap(page, ["@mode", "d6", "d5"]);
  await row(page, "sync").tap();
  const v = (await row(page, "device").getByTestId("sheet-value").textContent()) ?? "";
  await tap(page, ["esc", "esc", "esc", "esc"]);
  return v;
};

test("Settings › Sync › Device name: Alpha is locked, the hint shows, abc types without an Alpha press, Enter saves it", async ({ page }) => {
  await openDeviceName(page);
  await expectAsking(page, "Device name");
  await tap(page, ["vars", "math", "tmpl"]);
  expect(await entryValue(page)).toBe("abc");
  await tap(page, ["enter"]);
  await expectClosed(page);
  expect(await entryValue(page)).toBe("2+3"); // the line that was there
  await expect.poll(() => deviceValue(page)).toBe("abc");
});

test("Settings › Sync › Device name: Esc leaves the old name and the old line, and Alpha is off", async ({ page }) => {
  await openDeviceName(page);
  await tap(page, ["vars", "math"]);
  await tap(page, ["esc"]);
  await expectClosed(page);
  expect(await entryValue(page)).toBe("2+3");
  expect(await deviceValue(page)).toBe("made at the first write");
});

test("Presets › Save: the same prompt; letters type with no Alpha press, and a number once Alpha is tapped off", async ({ page }) => {
  await open(page);
  await tap(page, ["d2", "add", "d3"]);
  await tap(page, ["@mode", "d5", "d1"]);
  await expectAsking(page, "Preset name");
  await tap(page, ["vars", "alpha", "d7"]); // a; the Alpha tap ends the lock (a digit key's Alpha letter is Q); then 7 types as before
  expect(await entryValue(page)).toBe("a7");
  expect(await mods(page)).toEqual({ alpha: false, lock: false, caps: false });
  await tap(page, ["enter"]);
  await expectClosed(page);
  expect(await entryValue(page)).toBe("2+3");
  await tap(page, ["@mode"]);
  await expect(page.getByTestId("menu")).toContainText("a7");
});

test("Presets › Save: Esc cancels, the old line comes back and Alpha is off", async ({ page }) => {
  await open(page);
  await tap(page, ["d2", "add", "d3"]);
  await tap(page, ["@mode", "d5", "d1"]);
  await expectAsking(page, "Preset name");
  await tap(page, ["vars"]);
  await tap(page, ["esc"]);
  await expectClosed(page);
  expect(await entryValue(page)).toBe("2+3");
});

test("Control: outside a prompt Alpha is off and a number types as before", async ({ page }) => {
  await open(page);
  await expectClosed(page);
  await tap(page, ["d4", "d2"]);
  expect(await entryValue(page)).toBe("42");
  await expectClosed(page);
});
