// SPDX-License-Identifier: GPL-3.0-or-later
// R814 (owner, 2026-11-20, walk point C6): in Memory Shift + ⌫ and the hardware Delete delete the highlighted name with R813's line
// "B deleted · Undo" (R314); on Clear all they arm it as Enter does; plain ⌫ takes the last search letter back and does nothing on an
// empty search. Vars keeps Shift + ⌫ as ⌫. The real engine; values derived (A = 5, B = 7).
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

const find = (page: Page) => page.getByTestId("find");
const row = (page: Page, id: string) => find(page).locator(`[role="menuitem"][data-id="${id}"]`);
const names = (page: Page) => page.evaluate(() => window.n62.session.userNames.map((u) => u.name).sort());

async function start(page: Page): Promise<void> {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
}
async function store(page: Page, digit: string, letterKey: "vars" | "math", count: number): Promise<void> {
  await tap(page, [digit, "shift", "emark", "alpha", letterKey, "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(count);
}
/** A = 5 and B = 7 stored, Memory open, the highlight on B (the newest, the first row). */
async function memory(page: Page): Promise<void> {
  await start(page);
  await store(page, "d5", "vars", 1);
  await store(page, "d7", "math", 2);
  await tap(page, ["shift", "math"]);
  await expect(row(page, "var:B")).toBeVisible();
  await expect(row(page, "var:B")).toHaveAttribute("data-active", "true");
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("Shift, ⌫ on the highlighted B deletes it with 'B deleted · Undo'; Undo brings it back", async ({ page }) => {
  await memory(page);
  await tap(page, ["shift", "bksp"]);
  await expect(row(page, "var:B")).toHaveCount(0);
  await expect(row(page, "var:A")).toBeVisible();
  await expect(row(page, "undo")).toContainText("B deleted · Undo");
  await expect.poll(() => names(page)).toEqual(["A"]);
  await row(page, "undo").tap();
  await expect(row(page, "var:B")).toBeVisible();
  await expect.poll(() => names(page)).toEqual(["A", "B"]);
});

test("the hardware Delete does the same, and the highlight stays on a row", async ({ page }) => {
  await memory(page);
  await page.evaluate(() => window.n62.entry.focus()); // the field keeps focus while a sheet is open
  await page.keyboard.press("Delete");
  await expect(row(page, "var:B")).toHaveCount(0);
  await expect(row(page, "undo")).toContainText("B deleted · Undo");
  await expect.poll(() => names(page)).toEqual(["A"]);
  await expect(find(page).locator('[role="menuitem"][data-active="true"]')).toHaveCount(1);
  await row(page, "undo").tap();
  await expect.poll(() => names(page)).toEqual(["A", "B"]);
});

test("on Clear all Shift, ⌫ arms it as Enter does; a second one clears", async ({ page }) => {
  await memory(page);
  await tap(page, ["down", "down", "shift", "bksp"]);
  await expect(row(page, "clearall")).toContainText("Enter again clears 2");
  await expect.poll(() => names(page)).toEqual(["A", "B"]);
  await tap(page, ["shift", "bksp"]);
  await expect.poll(() => names(page)).toEqual([]);
});

test("plain ⌫ takes the last search letter back (the names are listed again) and does nothing on an empty search", async ({ page }) => {
  await memory(page);
  await tap(page, ["alpha", "vars"]); // a
  await expect(row(page, "var:A")).toBeVisible();
  await expect(row(page, "var:B")).toHaveCount(0);
  await tap(page, ["bksp"]);
  await expect(row(page, "var:A")).toBeVisible();
  await expect(row(page, "var:B")).toBeVisible();
  await tap(page, ["bksp"]); // empty search: a dead press, nothing is deleted
  await expect(row(page, "var:B")).toBeVisible();
  await expect.poll(() => names(page)).toEqual(["A", "B"]);
});

test("Vars: Shift, ⌫ stays ⌫ (a search letter goes, no name is deleted)", async ({ page }) => {
  await start(page);
  await store(page, "d5", "vars", 1);
  await tap(page, ["vars"]);
  await expect(row(page, "var:A")).toBeVisible();
  await tap(page, ["shift", "bksp"]);
  await expect(row(page, "var:A")).toBeVisible();
  await expect.poll(() => names(page)).toEqual(["A"]);
});
