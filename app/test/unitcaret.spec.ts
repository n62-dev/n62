// SPDX-License-Identifier: GPL-3.0-or-later
// R808 (the owner's walk, point C3): in the unit view ◀ ▶ walk a slot's factors before they cross to another slot, and ⌫ and the powers act at
// the caret. `5`, units, J ÷ kg K, then ◀ ⌫ takes the kilogram out of the denominator, g puts the gram in its place, and Enter evaluates
// (5 J/(g·K) on the engine). ⌫ at the denominator's start with units in it is a dead key with a message.
import { expect, test, type Page } from "@playwright/test";
import { flick, open, tap } from "./helpers.ts";

const up = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element && document.querySelector('[data-pad="unit"]') !== null);
const reading = (page: Page) => page.getByTestId("unit-reading");
const caret = (page: Page) => page.evaluate(() => window.n62.unitView?.view.model("u1")?.caret);
const slot = (page: Page) => page.evaluate(() => window.n62.unitView?.view.model("u1")?.slot);

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
  await tap(page, ["d5"]);
  await flick(page, "tmpl", "up");
  await up(page);
  await tap(page, ["neg", "div", "d4", "d6", "space"]); // J ÷ k g K
  await expect(reading(page)).toHaveText("joule per kilogram kelvin");
});

test("◀ ⌫ takes the kilogram out of J/(kg·K), g puts the gram in; Enter evaluates", async ({ page }) => {
  await tap(page, ["left"]);
  expect(await caret(page)).toEqual({ side: "den", i: 1 });
  await tap(page, ["bksp"]);
  expect(await slot(page)).toEqual({ tokens: [{ unit: "J" }, { unit: "K" }], per: 1 });
  await tap(page, ["d6"]);
  await expect(reading(page)).toHaveText("joule per gram kelvin");
  await tap(page, ["enter"]);
  await expect(page.locator('[data-testid="unit-result"], [data-testid="unit-message"]')).toHaveCount(1);
  await expect(page.getByTestId("unit-result")).toBeVisible();
});

test("◀ ◀ ⌫ at the denominator's start: a dead key and its message, J/(kg·K) never becomes J·kg·K", async ({ page }) => {
  await tap(page, ["left", "left"]);
  expect(await caret(page)).toEqual({ side: "den", i: 0 });
  await tap(page, ["bksp"]);
  await expect(page.getByTestId("unit-message")).toHaveText("The denominator still has units");
  expect(await slot(page)).toEqual({ tokens: [{ unit: "J" }, { prefix: "k", unit: "g" }, { unit: "K" }], per: 1 });
  await tap(page, ["left", "right"]); // the numerator's end and back: ▶ goes to the denominator's start
  expect(await caret(page)).toEqual({ side: "den", i: 0 });
});

test("the same power key again takes the power off; ▲ ▼ go between numerator and denominator", async ({ page }) => {
  await tap(page, ["sq"]);
  expect((await slot(page))?.tokens[2]).toEqual({ unit: "K", power: "2" });
  await tap(page, ["sq"]);
  expect((await slot(page))?.tokens[2]).toEqual({ unit: "K" });
  await tap(page, ["up"]);
  expect(await caret(page)).toEqual({ side: "num", i: 1 });
  await tap(page, ["down"]);
  expect(await caret(page)).toEqual({ side: "den", i: 2 });
});
