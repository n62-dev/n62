// SPDX-License-Identifier: GPL-3.0-or-later
// R702 (F382): Store ▶ (Shift + ᴇ, or its flick up) with nothing to store, an empty line and no result, is a dead
// press (docs/05 3.7: the double pulse), as Base's is: no "Store in", no ▶ on the line, the press counted under its
// layer (R127). A lone ▶ that reaches Enter some other way says what it needs, never the parser's command name
// (docs/05 3.8). The controls: with a result it is Ans ▶ and "Store in" (store.spec.ts), with 5 on the line 5 ▶.
// The real engine.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, flick, open, recordVibrations, tap, vibrations } from "./helpers.ts";

const store = (page: Page) => page.getByTestId("store");
const keys = (page: Page): Promise<Record<string, number>> => page.evaluate(() => ({ ...window.n62.session.taps.counts.keys }));

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await recordVibrations(page);
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
  await page.evaluate(() => window.n62.session.taps.load().then((c) => c?.ready)); // (R320: the counter is a lazy chunk)
  await page.evaluate(() => window.n62.session.setHaptics({ on: true, ms: 10 }));
});

test("(a) an empty history and an empty line: Shift + ᴇ is a dead press, no sheet, the line stays empty", async ({ page }) => {
  const base = await keys(page);
  await tap(page, ["shift"]);
  const v = (await vibrations(page)).length;
  await tap(page, ["emark"]);
  await expect.poll(async () => (await vibrations(page)).length - v).toBe(2); // the double alone (R777: no value, no result)
  await expect.poll(async () => (await keys(page))["emark:shift"] ?? 0).toBe((base["emark:shift"] ?? 0) + 1);
  await page.waitForTimeout(300); // ("Store in" comes with Vars' chunk: give it the time it would take)
  await expect(store(page)).toHaveCount(0);
  expect(await entryValue(page)).toBe("");
});

test("(b) the flick up on ᴇ: the same dead press", async ({ page }) => {
  const base = await keys(page);
  const v = (await vibrations(page)).length;
  await flick(page, "emark", "up");
  await expect.poll(async () => (await keys(page))["emark:up"] ?? 0).toBe((base["emark:up"] ?? 0) + 1);
  await expect.poll(async () => (await vibrations(page)).length - v).toBeGreaterThanOrEqual(2); // the double pulse
  await page.waitForTimeout(300);
  await expect(store(page)).toHaveCount(0);
  expect(await entryValue(page)).toBe("");
});

test("(c) a result in the history, only ▶ on the line (put there some other way): Enter says Store needs a value before ▶", async ({ page }) => {
  await tap(page, ["d5", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await page.evaluate(() => window.n62.entry.set("\\blacktriangleright"));
  await tap(page, ["enter"]);
  const error = page.locator('[data-status="error"]');
  await expect(error).toHaveCount(1);
  await expect(error.last()).toContainText("Store needs a value before ▶");
  await expect(error.last()).not.toContainText("unsupported command");
  await expect(error.last()).not.toContainText("blacktriangleright");
});

test("control: 5 on the line and no result: Shift + ᴇ is 5 ▶ and opens Store in", async ({ page }) => {
  await tap(page, ["d5", "shift", "emark"]);
  await expect(store(page)).toBeVisible();
  expect(await entryValue(page)).toBe("5\\blacktriangleright");
});
