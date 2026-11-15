// SPDX-License-Identifier: GPL-3.0-or-later
// R320: the press counters are a lazy chunk fetched when the browser is idle. Presses made before it is in (the first
// second of a cold start) wait in the session's front and are counted once each when it loads: Settings › Counters
// shows them all.
import { expect, test } from "@playwright/test";
import { tap } from "./helpers.ts";

test("keys and a screen tap in the first second of a cold start are each counted once in Settings › Counters", async ({ page }) => {
  await page.addInitScript(() => {
    const idle = window.requestIdleCallback.bind(window); // hold the idle loads back, so the presses come before the counter
    window.requestIdleCallback = (cb, o) => setTimeout(() => idle(cb, o), 1500) as unknown as number;
  });
  await page.goto("/?engine=fake&tips=off");
  await page.locator('[data-key="d2"]').waitFor();
  await tap(page, ["d1", "d2", "shift", "d3"]); // four keypad presses, one of them a Shift tap
  await tap(page, ["@menu"]); // a tap on the screen: the ☰ button
  expect(await page.evaluate(() => window.n62.session.taps.counter === undefined)).toBe(true); // they wait in the front
  await page.getByTestId("sheet-gear").tap(); // Settings: 1 more
  await page.getByTestId("menu").locator('[data-id="counters"]').tap(); // Counters: 1 more
  const value = (id: string) => page.getByTestId("menu").locator(`[data-id="${id}"]`).getByTestId("sheet-value");
  await expect(value("presses")).toHaveText("7");
  await expect(value("taps")).toHaveText("1 / 0"); // Shift / Alpha
  expect(await page.evaluate(() => ({ ...window.n62.session.taps.counts.keys }))).toEqual({
    "d1:primary": 1,
    "d2:primary": 1,
    "shift:primary": 1,
    "d3:shift": 1,
    "screen:button": 2, // ☰ and the gear
    "screen:row": 1, // Counters
  });
});
