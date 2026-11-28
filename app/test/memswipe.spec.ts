// SPDX-License-Identifier: GPL-3.0-or-later
// R813 (owner, 2026-11-20, walk point C6): in Memory a swipe left on a name's row past 40 % of its width deletes the name,
// the line under the names says "B deleted · Undo" (R314) and Undo brings it back; a short swipe springs back, a swipe
// right does nothing. The real engine; values derived (A = 5, B = 7).
import { expect, test, type Page } from "@playwright/test";
import { finger, STILL_MS } from "./core-lib.ts";
import { lastResult, open, tap } from "./helpers.ts";

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
/** A swipe across `share` of the row's width (+ right, - left), slowly and lifted at rest: no fling. */
async function swipe(page: Page, id: string, share: number): Promise<void> {
  const css = `[data-testid="find"] [role="menuitem"][data-id="${id}"]`;
  const width = (await row(page, id).boundingBox())?.width ?? 0;
  await expect(row(page, id).locator('[data-testid="swipe-del"]')).toHaveCount(1, { timeout: 15_000 }); // the gesture's chunk is in
  await finger(page, css, { dx: share * width, steps: 12, still: STILL_MS });
}
async function memory(page: Page): Promise<void> {
  await start(page);
  await store(page, "d5", "vars", 1);
  await store(page, "d7", "math", 2);
  await tap(page, ["shift", "math"]);
  await expect(row(page, "var:B")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("a swipe left of 60 % deletes the name with 'B deleted · Undo'; Undo brings it back (B is 7 again)", async ({ page }) => {
  await memory(page);
  await swipe(page, "var:B", -0.6);
  await expect(row(page, "var:B")).toHaveCount(0);
  await expect(row(page, "var:A")).toBeVisible();
  await expect(row(page, "undo")).toContainText("B deleted · Undo");
  await expect.poll(() => names(page)).toEqual(["A"]);
  await page.waitForTimeout(250); // (Chrome takes a touch right after a drag as the stop of its fling)
  await row(page, "undo").tap();
  await expect(row(page, "var:B")).toBeVisible();
  await expect.poll(() => names(page)).toEqual(["A", "B"]);
  await tap(page, ["esc", "alpha", "math", "enter"]);
  await expect(page.locator('[data-status="done"],[data-status="error"]')).toHaveCount(3);
  await expect(lastResult(page)).toHaveAttribute("data-text", "7");
});

test("a swipe of 20 % springs back, a swipe right does nothing; Clear all keeps its row and its two Enters", async ({ page }) => {
  await memory(page);
  await swipe(page, "var:B", -0.2);
  await page.waitForTimeout(400);
  await expect(row(page, "var:B")).toBeVisible();
  await expect(row(page, "var:B")).not.toHaveCSS("transform", /matrix\(1, 0, 0, 1, -/);
  await swipe(page, "var:B", 0.6);
  await page.waitForTimeout(400);
  await expect(row(page, "var:B")).toBeVisible();
  await expect(row(page, "undo")).toHaveCount(0);
  await expect.poll(() => names(page)).toEqual(["A", "B"]);
  await tap(page, ["down", "down", "enter"]); // Clear all asks once, then clears
  await expect(row(page, "clearall")).toContainText("Enter again clears 2");
  await tap(page, ["enter"]);
  await expect.poll(() => names(page)).toEqual([]);
});

test("Vars' rows have no swipe: a swipe left on a name there deletes nothing", async ({ page }) => {
  await start(page);
  await store(page, "d5", "vars", 1);
  await tap(page, ["vars"]);
  await expect(row(page, "var:A")).toBeVisible();
  await expect(find(page).locator("[data-swipe]")).toHaveCount(0);
});
