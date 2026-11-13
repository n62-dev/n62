// SPDX-License-Identifier: GPL-3.0-or-later
// R281 (sd-3, docs/research/store-design.md design A; mockup docs/mockups/store-2026-11.html): Store ▶ puts `value ▶` on
// the line and opens "Store in": the title shows the value with its mark, the letters A–Z with their values, then the
// other names. A tap on a free letter stores (the name and Enter: a history row); a tap on a filled one arms it and the
// second tap stores; any other press disarms. Typed letters (digits after a letter too) and Enter store the typed name;
// Esc leaves `value ▶` on the line. The real engine.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, lastResult, open, tap } from "./helpers.ts";

const store = (page: Page) => page.getByTestId("store");
const cell = (page: Page, letter: string) => store(page).locator(`[data-id="name:${letter}"]`);
const done = (page: Page) => page.locator('[data-status="done"]');
const names = (page: Page) => page.evaluate(() => window.n62.session.userNames.map((u) => u.name).sort());

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
});

test("Shift + ᴇ after a result: Ans ▶ on the line, the title shows the value with its mark; a tap on a free letter stores", async ({ page }) => {
  await tap(page, ["d1", "div", "d3", "right", "enter"]);
  await expect(done(page)).toHaveCount(1);
  await tap(page, ["shift", "emark"]);
  await expect(store(page).getByTestId("sheet-title")).toHaveText("Store ≈ 0.333333333333 in");
  expect(await entryValue(page)).toBe("\\ans\\blacktriangleright");
  await expect(store(page).getByTestId("sheet-cells").getByRole("menuitem")).toHaveCount(26);
  await expect(cell(page, "A")).toHaveAttribute("data-active", "true"); // it opens on the first free letter
  await cell(page, "B").tap();
  await expect(store(page)).toBeHidden();
  await expect(done(page)).toHaveCount(2); // the one store path: the name, Enter, a history row
  await expect(lastResult(page)).toHaveAttribute("data-text", "0.333333333333");
  expect(await names(page)).toEqual(["B"]);
  // the next Store ▶ shows B with its value and mark
  await tap(page, ["d2", "shift", "emark"]);
  await expect(cell(page, "B")).toContainText("≈ 0.333333333333");
});

test("a filled letter asks first: the first tap arms it (5 · again?), the second stores; any other press disarms", async ({ page }) => {
  await tap(page, ["d5", "shift", "emark", "alpha", "vars", "enter"]);
  await expect(done(page)).toHaveCount(1);
  await tap(page, ["d9", "shift", "emark"]);
  await cell(page, "A").tap();
  await expect(cell(page, "A")).toHaveAttribute("data-armed", "true");
  await expect(cell(page, "A")).toContainText("= 5 · again?"); // with its mark, as the cell's value line (principle 3)
  await expect(store(page).getByTestId("find-preview")).toHaveText("A = 5. Tap A again to replace it with 9");
  await expect(done(page)).toHaveCount(1); // nothing stored yet
  await tap(page, ["right"]); // another press: disarmed
  await expect(cell(page, "A")).toHaveAttribute("data-armed", "false");
  await cell(page, "A").tap();
  await expect(done(page)).toHaveCount(1);
  await cell(page, "A").tap();
  await expect(store(page)).toBeHidden();
  await expect(done(page)).toHaveCount(2);
  await tap(page, ["alpha", "vars", "add", "d0", "enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "9");
});

test("the row bar's Store ▶ opens it for the picked row; Esc leaves value ▶ on the line", async ({ page }) => {
  await tap(page, ["d4", "enter", "d6", "enter"]);
  await expect(done(page)).toHaveCount(2);
  await page.locator('[data-testid="result"] .result').first().tap(); // picks the row of 4
  await page.getByTestId("row-actions").getByRole("button", { name: "Store ▶" }).tap();
  await expect(store(page).getByTestId("sheet-title")).toHaveText("Store = 4 in");
  await tap(page, ["esc"]);
  await expect(store(page)).toBeHidden();
  expect(await entryValue(page)).toContain("\\blacktriangleright");
  expect(await names(page)).toEqual([]);
});

test("typed letters filter and Enter stores the typed name, digits after a letter included (A1)", async ({ page }) => {
  await tap(page, ["d3", "shift", "emark", "alpha", "vars"]);
  await expect(store(page).getByTestId("sheet-filter")).toHaveText("A");
  await expect(store(page).getByTestId("sheet-cells").getByRole("menuitem")).toHaveCount(1); // only A is left
  await tap(page, ["d1"]);
  await expect(store(page).getByTestId("sheet-filter")).toHaveText("A1");
  await expect(store(page).getByTestId("find-preview")).toHaveText("Enter stores A1");
  await tap(page, ["enter"]);
  await expect(done(page)).toHaveCount(1);
  expect(await names(page)).toEqual(["A1"]);
});

test("one of N62's own names typed in the sheet is refused: 7 ▶ sigfig says why and stores nothing (our sigfig stays)", async ({ page }) => {
  await tap(page, ["d7", "shift", "emark"]);
  await page.evaluate(() => window.n62.entry.focus()); // the field keeps focus while a sheet is open (hardware letters)
  await page.keyboard.type("sigfig");
  await expect(store(page).getByTestId("sheet-filter")).toHaveText("sigfig");
  await tap(page, ["enter"]);
  await expect(page.getByText("sigfig is one of N62's own names")).toBeVisible();
  expect(await names(page)).toEqual([]); // nothing reached the engine: sigfig:=7 would replace our definition
});

test("R281f1: a key that types no name after typed letters keeps them: 7 ▶ x, Shift + ␣, 0, Enter stores x_0 as before the sheet", async ({ page }) => {
  await tap(page, ["d7", "shift", "emark", "x"]);
  await expect(store(page).getByTestId("sheet-filter")).toHaveText("x");
  await tap(page, ["shift", "space"]); // _ types no name: the sheet closes, x goes on the line, then the _
  await expect(store(page)).toBeHidden();
  await tap(page, ["d0"]);
  expect(await entryValue(page)).toMatch(/x_\{?0\}?$/);
  await tap(page, ["enter"]);
  await expect(done(page)).toHaveCount(1);
  await tap(page, ["x", "shift", "space", "d0", "right", "add", "d1", "enter"]);
  await expect(done(page)).toHaveCount(2);
  await expect(lastResult(page)).toHaveAttribute("data-text", "8");
});
