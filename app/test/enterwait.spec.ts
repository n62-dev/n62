// SPDX-License-Identifier: GPL-3.0-or-later
// R934: the app refuses Enter while a row runs (session.submit, docs/05 3.5), so `tap` waits for the row before an Enter
// that follows another key of the same call; `busyEnter` presses at once, for a spec that means Enter on a running row.
// The fake engine with each answer late, as under load (R927f1's reds, fold.spec's `rows`, store.spec's `d4 enter d6 enter`).
import { expect, test } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

const done = '[data-status="done"]';

test("R934: d1 Enter d2 Enter in one call, each answer 400 ms late: two rows, the line empty", async ({ page }) => {
  await open(page, "engine=fake&delay=400");
  await tap(page, ["d1", "enter", "d2", "enter"]);
  await expect(page.locator(done)).toHaveCount(2);
  await expect(page.locator('[data-testid="result"] .result')).toHaveText(["1", "2"]);
  expect(await entryValue(page)).toBe("");
});

test("R934: four rows in one call, each answer 400 ms late: four rows", async ({ page }) => {
  await open(page, "engine=fake&delay=400");
  await tap(page, ["d1", "enter", "d2", "enter", "d3", "enter", "d4", "enter"]);
  await expect(page.locator(done)).toHaveCount(4);
});

test("R934 control: with busyEnter the second Enter goes on the running row and is refused; the line keeps 2", async ({ page }) => {
  await open(page, "engine=fake&delay=3000");
  await tap(page, ["d1", "enter", "d2", "enter"], { busyEnter: true });
  expect(await page.evaluate(() => window.n62.session.busy)).toBe(true); // (the first row still runs: the Enter met it)
  await expect(page.locator(done)).toHaveCount(1, { timeout: 6000 });
  await page.waitForTimeout(500);
  await expect(page.locator("article.item")).toHaveCount(1);
  expect(await entryValue(page)).toBe("2");
});
