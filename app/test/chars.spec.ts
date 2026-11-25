// SPDX-License-Identifier: GPL-3.0-or-later
// R725: the Chars sheet, Shift + Vars (spec/keyboard.yaml `chars:`), on the real engine. 46 cells in rows of 10, each with
// its digit in the corner; a digit picks that cell of the row with the focus, ▲ ▼ move between rows, a tap picks any
// cell. It rises over the view like a list that takes letters, so the digit keys stay uncovered. ≈, Å and µ type nothing
// on a maths line and say why; ‰ is per mille; a name prompt takes every cell. Expected values derived by hand.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, lastResult, open, sheet, sheetKey, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
});

const active = (page: Page) => sheet(page).locator('[data-active="true"]');
const CHARS = ["shift", "vars"];
/** Shift + Vars, then a tap on the cell. */
async function tapCell(page: Page, id: string): Promise<void> {
  await tap(page, CHARS);
  await sheet(page).locator(`[data-id="${id}"]`).tap();
  await expect(sheet(page)).toBeHidden();
}

test("Shift + Vars opens 46 cells with their digits; 3 picks γ, ▼ then 2 picks ξ; the digit keys stay uncovered", async ({ page }) => {
  await tap(page, CHARS);
  await expect(page.getByTestId("sheet-title")).toHaveText("Characters");
  await expect(sheet(page).locator('[role="menuitem"]')).toHaveCount(46);
  await expect(sheet(page).getByTestId("cell-digit")).toHaveText([..."1234567890", ..."1234567890", ..."1234567890", ..."1234567890", ..."123456"]);
  await expect(active(page)).toHaveAttribute("data-id", "alpha");
  // the sheet is over the view: the digit keys are not under it (the pad keys are the sheet's keys)
  const cover = await page.evaluate(() => {
    const k = document.querySelector('[data-key="d3"]') as HTMLElement;
    const r = k.getBoundingClientRect();
    const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return el !== null && el.closest('[role="menu"]') !== null;
  });
  expect(cover).toBe(false);
  await page.locator('[data-key="d3"]').tap(); // a real tap on the keypad's 3
  await expect(sheet(page)).toBeHidden();
  expect(await entryValue(page)).toBe("\\gamma");
  await tap(page, ["esc"]);
  await tap(page, [...CHARS, "down"]); // opens on the last pick (γ, row 1); ▼ is row 2
  await expect(active(page)).toHaveAttribute("data-id", "rho");
  await page.locator('[data-key="d2"]').tap();
  expect(await entryValue(page)).toBe("\\xi"); // (the Esc before it cleared γ)
});

test("a tap on Ω puts \\Omega on the line; µ, ≈ and Å type nothing and say why", async ({ page }) => {
  await tapCell(page, "Omega");
  expect(await entryValue(page)).toBe("\\Omega");
  await tap(page, ["esc"]);
  for (const [id, why] of [["approx", /≈ has no meaning/], ["micro", /µ.*has no meaning.*μ/], ["angstrom", /Å is a unit/]] as const) {
    await tap(page, CHARS);
    await sheet(page).locator(`[data-id="${id}"]`).tap();
    await expect(page.getByTestId("notice")).toHaveText(why);
    expect(await entryValue(page)).toBe("");
    await tap(page, ["esc"]);
  }
  await expect(page.locator('[data-status="done"]')).toHaveCount(0); // nothing was evaluated
});

test("2, Chars ×, 3, Enter is 6; 30 then Chars ° is Shift + 9's °; 5 ∠ 30° is 5 ∡ 30°", async ({ page }) => {
  await tap(page, ["d2"]);
  await tapCell(page, "times");
  await tap(page, ["d3", "enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "6");
  await tap(page, ["d3", "d0"]);
  await tapCell(page, "deg");
  const chars = await entryValue(page);
  await tap(page, ["esc", "d3", "d0", "shift", "d9"]);
  await sheet(page).locator('[data-id="deg"]').tap();
  expect(await entryValue(page)).toBe(chars);
  expect(chars).toBe("30\\degree");
  await tap(page, ["esc", "d5"]);
  await tapCell(page, "angle");
  await tap(page, ["d3", "d0"]);
  await tapCell(page, "deg");
  await tap(page, ["enter"]);
  const viaChars = await lastResult(page).getAttribute("data-text");
  await tap(page, ["d5", "shift", "mul"]); // 5, then the key ∡ (Shift + ×)
  await tap(page, ["d3", "d0"]);
  await tapCell(page, "deg");
  await tap(page, ["enter"]);
  expect(await lastResult(page).getAttribute("data-text")).toBe(viaChars);
});

test("5‰ is 0.005 and 2·50‰ is 0.1; 5% is still 0.05", async ({ page }) => {
  await tap(page, ["d5"]);
  await tapCell(page, "permille");
  expect(await entryValue(page)).toBe("5‰"); // MathLive keeps the character; the parser reads it (and \permille) as per mille
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "0.005");
  await tap(page, ["d2"]);
  await tapCell(page, "cdot");
  await tap(page, ["d5", "d0"]);
  await tapCell(page, "permille");
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "0.1");
  await tap(page, ["d5", "shift", "d0", "enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "0.05");
});

test("Π is a name, π stays Shift + 3: 2·Π is drawn 2Π, never 2π", async ({ page }) => {
  await tap(page, ["d2"]);
  await tapCell(page, "Pi");
  await tap(page, ["enter"]);
  await expect(lastResult(page)).not.toHaveAttribute("data-text", /^6\.28/); // not 2π
  await expect(lastResult(page)).toHaveText(/2.*Π/);
});

test("Store ▶ on a result: Chars θ types the name, and the row is stored under theta", async ({ page }) => {
  await tap(page, ["d5", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await tap(page, ["shift", "emark"]); // Ans ▶ and the Store in sheet
  await tap(page, CHARS); // the store sheet closes, Chars opens on the line after ▶
  await sheet(page).locator('[data-id="theta"]').tap();
  expect(await entryValue(page)).toBe("\\ans\\blacktriangleright\\theta");
  await tap(page, ["enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(2);
  expect(await page.evaluate(() => window.n62.session.userNames.map((u) => u.name))).toEqual(["theta"]);
});

test("a name prompt takes every cell: Chars in a preset's name types the character, ≈ and µ too; Esc leaves the sheet and keeps the prompt", async ({ page }) => {
  await tap(page, ["d2", "add", "d3"]);
  await tap(page, ["@mode", "d1", "d1"]);
  await expect(page.getByTestId("entry-label")).toHaveText("Preset name");
  await tap(page, ["alpha"]); // R776: the name prompt starts with Alpha locked; under it Shift + Vars would type a letter
  await tap(page, CHARS);
  await sheet(page).locator('[data-id="theta"]').tap();
  await expect(page.getByTestId("entry-label")).toHaveText("Preset name"); // the prompt stays
  await tap(page, CHARS);
  await sheet(page).locator('[data-id="approx"]').tap(); // a refused cell types too, in a name
  expect(await entryValue(page)).toMatch(/^\\theta(\\approx|≈)$/);
  await tap(page, CHARS);
  await sheetKey(page, ["esc"]);
  await expect(sheet(page)).toBeHidden();
  await expect(page.getByTestId("entry-label")).toHaveText("Preset name");
  await tap(page, ["esc"]);
  await expect(page.getByTestId("entry-label")).toHaveCount(0);
  expect(await entryValue(page)).toBe("2+3");
});

test("Shift + 9, Shift + 6 and Vars are as before", async ({ page }) => {
  await tap(page, ["shift", "d9"]);
  await expect(sheet(page).locator('[role="menuitem"]')).toHaveCount(25);
  await tap(page, ["esc", "shift", "d6"]);
  await expect(sheet(page).locator('[role="menuitem"]')).toHaveCount(11);
  await tap(page, ["esc", "vars"]);
  await expect(page.getByTestId("find")).toBeVisible();
});
