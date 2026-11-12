// SPDX-License-Identifier: GPL-3.0-or-later
// R193 (docs/04 5.4): Shift + − opens the Base menu for the last result: HEX, BIN, OCT, DEC. A pick sets that result's
// display form (R192). With text on the line the key is dead (the double pulse). Uses the real engine (GIAC_OUT).
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, recordVibrations, sheet, sheetKey, tap, vibrations } from "./helpers.ts";

const last = (page: Page) => page.locator('[data-testid="result"] .result').last();
const ready = (page: Page) => page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
const row = (page: Page, id: string) => sheet(page).locator(`[data-id="${id}"]`);
const calc = async (page: Page, keys: string[]): Promise<void> => {
  await open(page, "");
  await ready(page);
  await tap(page, [...keys, "enter"]);
};

test("255, Shift + −: HEX shows 0xFF, DEC goes back", async ({ page }) => {
  await calc(page, ["d2", "d5", "d5"]);
  await expect(last(page)).toHaveAttribute("data-text", "255");
  await tap(page, ["shift", "sub"]);
  await expect(page.getByTestId("sheet-title")).toHaveText("Base");
  await expect(sheet(page).getByRole("menuitem")).toHaveCount(4);
  await expect(row(page, "hex")).toHaveAttribute("aria-label", /HEX/);
  await row(page, "hex").tap();
  await expect(sheet(page)).toBeHidden();
  await expect(last(page)).toHaveAttribute("data-text", "0xFF");
  await tap(page, ["shift", "sub"]);
  await expect(row(page, "hex")).toHaveAttribute("data-selected", "true");
  await row(page, "bin").tap();
  await expect(last(page)).toHaveAttribute("data-text", "0b11111111");
  await tap(page, ["shift", "sub"]);
  await row(page, "oct").tap();
  await expect(last(page)).toHaveAttribute("data-text", "0o377");
  await tap(page, ["shift", "sub"]);
  await row(page, "dec").tap();
  await expect(last(page)).toHaveAttribute("data-text", "255");
});

test("the digits pick a row with the keypad (1 HEX, 4 DEC)", async ({ page }) => {
  await calc(page, ["d2", "d5", "d5"]);
  await tap(page, ["shift", "sub"]);
  await sheetKey(page, ["d1"]);
  await expect(last(page)).toHaveAttribute("data-text", "0xFF");
});

test("1.5, Shift + −: the rows are dimmed and a message says only integers", async ({ page }) => {
  await calc(page, ["d1", "dot", "d5"]);
  await expect(last(page)).toHaveAttribute("data-text", "1.5");
  await tap(page, ["shift", "sub"]);
  await expect(page.getByTestId("sheet-title")).toHaveText("Base");
  for (const id of ["hex", "bin", "oct", "dec"]) await expect(row(page, id)).toHaveAttribute("aria-disabled", "true");
  await expect(sheet(page)).toContainText(/only integers/i);
  await sheetKey(page, ["d1"]); // a dimmed row does nothing
  await expect(sheet(page)).toBeVisible();
  await expect(last(page)).toHaveAttribute("data-text", "1.5");
});

test("text on the line: no menu, the line and the result stay, and the press is a dead one", async ({ page }) => {
  await recordVibrations(page);
  await calc(page, ["d2", "d5", "d5"]);
  await page.evaluate(() => window.n62.session.setHaptics({ on: true, ms: 10 }));
  await tap(page, ["d1", "shift"]);
  const before = (await vibrations(page)).length;
  await tap(page, ["sub"]);
  await expect.poll(async () => (await vibrations(page)).length - before).toBe(3); // the touch, then the double (onepulse.spec.ts)
  await expect(sheet(page)).toBeHidden();
  expect(await entryValue(page)).toBe("1");
  await expect(last(page)).toHaveAttribute("data-text", "255");
});

test("no result yet, or an error as the last row: dead, no menu", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await tap(page, ["shift", "sub"]);
  await expect(sheet(page)).toBeHidden();
  expect(await entryValue(page)).toBe("");
});

test("the tap on − still types a minus (R193 changes only its Shift layer)", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await tap(page, ["sub"]);
  expect(await entryValue(page)).toBe("-");
});
