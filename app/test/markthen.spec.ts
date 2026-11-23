// SPDX-License-Identifier: GPL-3.0-or-later
// R376 (be-7): in Home, DEG, 30 ° 15 Enter is refused with a message that names the missing mark (it was 450, 30·15
// with no × on the line; the G2 reads it as 30°15′, G2 checklist row 76); with its × it is the product, 450. Keys as
// tapped, real engine; the words and the other marks are the parser's (src/input/markThen.test.ts).
import { expect, test } from "@playwright/test";
import { lastResult, open, sheet, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
  await page.evaluate(() => window.n62.session.setAngle("deg"));
});

/** Shift + 9, then the ° cell. */
async function degree(page: import("@playwright/test").Page): Promise<void> {
  await tap(page, ["shift", "d9"]);
  await sheet(page).locator('[data-id="deg"]').tap();
  await expect(sheet(page)).toBeHidden();
}

test("30°15 is refused, naming ′ and ×; 30°×15 is 450", async ({ page }) => {
  await tap(page, ["d3", "d0"]);
  await degree(page);
  await tap(page, ["d1", "d5", "enter"]);
  const error = page.locator('[data-status="error"]').last().getByRole("alert");
  await expect(error).toHaveText("a number after ° needs its mark: ′ for minutes, or × for a product");
  await tap(page, ["esc", "d3", "d0"]);
  await degree(page);
  await tap(page, ["mul", "d1", "d5", "enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "450");
});
