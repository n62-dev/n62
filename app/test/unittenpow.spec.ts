// SPDX-License-Identifier: GPL-3.0-or-later
// R925 (F379): the unit view puts one slot on 6.62607015×10⁻³⁴, after the power, not one on the number and one on the 10
// (m there gave (10 m)⁻³⁴, `= 6.626 070 15E-34 1/m³⁴`). On the engine: m in the one slot, Enter, the value in m.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, flick, open, tap } from "./helpers.ts";

const up = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element && document.querySelector('[data-pad="unit"]') !== null);
const result = (page: Page) => page.getByTestId("unit-result");

test("6.62607015×10⁻³⁴ has one slot, after the power; m in it, Enter: = 6.626 070 15E-34 m (R925)", async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
  await tap(page, ["d6", "dot", "d6", "d2", "d6", "d0", "d7", "d0", "d1", "d5", "mul", "d1", "d0", "pow", "neg", "d3", "d4"]);
  expect(await entryValue(page)).toBe("6.62607015\\times10^{-34}");
  await flick(page, "tmpl", "up");
  await up(page);
  expect(await page.evaluate(() => window.n62.unitView?.field.getPrompts())).toEqual(["u1"]);
  expect(await page.evaluate(() => window.n62.unitView?.view.activeId)).toBe("u1");
  await tap(page, ["d9", "enter"]);
  await expect(result(page)).toBeVisible();
  await expect(page.getByTestId("unit-mark")).toHaveText("=");
  await expect(page.getByTestId("unit-unit")).toHaveText("m");
  await expect(result(page).locator(".value")).toHaveText(/^6\.626\s?070\s?15E-34$/);
});
