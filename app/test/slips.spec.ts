// SPDX-License-Identifier: GPL-3.0-or-later
// R575 (F351): the commonest key slips show a message in plain words on the row, never the parser's internals.
// Keys as tapped, real engine; the words are the parser's (src/input/slips.test.ts).
import { expect, test } from "@playwright/test";
import { open, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
});

for (const [keys, words] of [
  [["sin", "enter"], "fill the empty box"],
  [["d2", "mul", "mul", "d3", "enter"], "× needs a number or name before it"],
] as const) {
  test(`${keys.join(" ")}: ${words}`, async ({ page }) => {
    await tap(page, [...keys]);
    const error = page.locator('[data-status="error"]').last().getByRole("alert");
    await expect(error).toHaveText(words);
  });
}
