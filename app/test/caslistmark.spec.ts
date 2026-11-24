// SPDX-License-Identifier: GPL-3.0-or-later
// G794 (owner-style hunt 2026-11-23, h3 #9): a CAS list or matrix of floats is marked as Home marks it (docs/04 2.9:
// every CAS number with a float is marked). The engine gives CAS a list's facts (engine/host.ts casRun, `numeric` with
// `items`); the row keeps them (state/resultItem.ts casItem), so the mark is the weakest element's. Expected marks are
// derived from the facts the engine gives (phase-1 9c1c42f2: approx([1/3,2/3]) 39 confirmed digits each, ≈ at 12;
// fsolve un-audited, ⚠ with its reason, as Home's line "⚠ fsolve is not checked").
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

const rows = (page: Page) => page.locator('[data-status="done"]');
const why = (page: Page) => page.getByTestId("row-why");

/** Enter `latex` in `view` and wait for its row, the n-th. */
async function run(page: Page, view: "home" | "cas", latex: string, n: number): Promise<void> {
  await page.evaluate((v) => window.n62.session.setView(v), view);
  await page.evaluate((l) => window.n62.session.submit(l), latex);
  await expect(rows(page)).toHaveCount(n);
}
/** The mark of the n-th row ("" for none). */
async function markOf(page: Page, n: number): Promise<string> {
  const m = rows(page).nth(n - 1).getByTestId("mark");
  return (await m.count()) === 0 ? "" : (await m.innerText()).trim();
}

const APPROX_LIST = "\\operatorname{approx}\\left(\\left[\\frac{1}{3},\\frac{2}{3}\\right]\\right)";
const FSOLVE = "\\operatorname{fsolve}\\left(\\cos\\left(x\\right)=x,x\\right)";
const MATRIX = "\\frac{\\operatorname{evalf}\\left(\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}\\right)}{3}";

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
});

test("CAS approx([1/3,2/3]) is ≈; the exact list [1/3,2/3] stays unmarked", async ({ page }) => {
  await run(page, "cas", APPROX_LIST, 1);
  await expect(rows(page).nth(0).locator(".result")).toHaveAttribute("data-text", "[0.333333333333,0.666666666667]");
  expect(await markOf(page, 1)).toBe("≈");
  await run(page, "cas", "\\left[\\frac{1}{3},\\frac{2}{3}\\right]", 2);
  expect(await markOf(page, 2)).toBe("");
});

test("CAS fsolve(cos(x)=x,x) is ⚠ with its reason line", async ({ page }) => {
  await run(page, "cas", FSOLVE, 1);
  expect(await markOf(page, 1)).toBe("⚠");
  await tap(page, ["up"]);
  await expect(why(page)).toBeVisible();
  expect((await why(page).innerText()).trim()).toBe("⚠ fsolve is not checked");
});

test("CAS evalf([[1,2],[3,4]])/3 is ≈", async ({ page }) => {
  await run(page, "cas", MATRIX, 1);
  expect(await markOf(page, 1)).toBe("≈");
});

test("control: a CAS scalar float keeps its mark", async ({ page }) => {
  await run(page, "cas", "\\operatorname{approx}\\left(\\frac{1}{3}\\right)", 1);
  expect(await markOf(page, 1)).toBe("≈");
});

test("controls: Home's list and fsolve keep their marks (each view shows its own rows)", async ({ page }) => {
  await run(page, "home", APPROX_LIST, 1);
  expect(await markOf(page, 1)).toBe("≈");
  await run(page, "home", FSOLVE, 2);
  expect(await markOf(page, 2)).toBe("⚠");
});
