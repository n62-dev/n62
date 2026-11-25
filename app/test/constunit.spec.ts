// SPDX-License-Identifier: GPL-3.0-or-later
// G801: a constant alone in the unit view is shown in its own unit (find/units.yaml constants.ownUnit, NIST's CODATA
// unit column): Planck's h in J·s, not kg·m²/s; the base form stays among the alternatives. On the engine.
import { expect, test, type Page } from "@playwright/test";
import { flick, open, tap } from "./helpers.ts";

const up = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element && document.querySelector('[data-pad="unit"]') !== null);
const find = (page: Page) => page.getByTestId("find");
const row = (page: Page, id: string) => find(page).locator(`[role="menuitem"][data-id="${id}"]`);
const result = (page: Page) => page.getByTestId("unit-result");

test.describe("a constant's own unit (G801)", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "");
    await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
  });

  test("h, the units key, Enter: 6.62607015E-34 J·s (was kg·m²/s)", async ({ page }) => {
    await flick(page, "tmpl", "up"); // the units key
    await up(page);
    await tap(page, ["math"]);
    await expect(find(page)).toBeVisible();
    for (const id of ["ucat:const", "uconst:Quantum", "const:planck"]) await row(page, id).tap();
    await expect(find(page)).toBeHidden();
    await page.waitForFunction(() => /\\const\{planck\}/.test(window.n62.unitView?.view.line ?? ""));
    await up(page);
    await tap(page, ["enter"]);
    await expect(result(page)).toHaveAttribute("data-unit", "J·s");
    await expect(result(page)).toHaveAttribute("data-text", "6.62607015E-34"); // derived: the exact 2019 SI value
  });
});
