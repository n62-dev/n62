// SPDX-License-Identifier: GPL-3.0-or-later
// R886: a unit row keeps σ's ⚠ and its reason (docs/04 2.6: a σ keeps its warning). The owner-style hunt's inputs of
// 2026-11-23 (h3 #6) in the unit view, ↑Enter, Esc: the Home row it leaves draws ⚠ before σ as the view does, its reason
// line under it gives the view's reason (G41's words), and Copy as shown writes the ⚠. The real engine. Expected
// values: the view's own (its headline and why line), read on the same run.
import { expect, test, type Page } from "@playwright/test";
import { flick, lastResult, open, PASTE, tap } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

const done = (page: Page) => page.locator('[data-status="done"]');
const clipboard = (page: Page): Promise<string> => page.evaluate(() => navigator.clipboard.readText());
const reasonLine = (page: Page) => page.getByTestId("mark-reason").last();

/** `latex` on Home's line, the units key, Eval (↑Enter): the unit view's result; with `m` in the slot when asked. */
async function inUnits(page: Page, latex: string, metre = false): Promise<void> {
  await page.evaluate((l) => window.n62.entry.insert(l), latex);
  await flick(page, "tmpl", "up");
  await page.waitForFunction(() => window.n62.unitView !== undefined && document.querySelector('[data-pad="unit"]') !== null);
  if (metre) await tap(page, ["d9"]);
  await flick(page, "enter", "up");
  await expect(page.getByTestId("unit-result")).toBeVisible();
}

/** Esc leaves the view (Home's `rows`th row is the unit row), a second Esc clears the line. */
async function leave(page: Page, rows: number): Promise<void> {
  await tap(page, ["esc"]);
  await expect(page.getByTestId("unit-view")).toHaveCount(0);
  await expect(done(page)).toHaveCount(rows);
  await tap(page, ["esc"]);
  await expect.poll(() => page.evaluate(() => window.n62.entry.value)).toBe("");
}

/** The last row picked, its bar → Copy › As shown. */
async function copyShown(page: Page): Promise<void> {
  if ((await page.getByTestId("row-actions").count()) === 0) await tap(page, ["up"]);
  await page.getByTestId("row-actions").getByRole("button", { name: /Copy/ }).tap({ timeout: 5000 });
  await expect(page.getByTestId("menu")).toBeVisible();
  await page.getByRole("menuitem", { name: /^\d As shown$/ }).click();
}

/** The view's σ with its ⚠ (`⚠0.64`) and its why line, read before it is left. */
async function viewWarn(page: Page): Promise<{ sigma: string; why: string }> {
  const value = (await page.getByTestId("unit-result").locator(".value").textContent()) ?? "";
  const sigma = /± (⚠\S+)/.exec(value)?.[1] ?? "";
  expect(sigma, `the view's headline ${value}`).toMatch(/^⚠\d/);
  const why = (await page.getByTestId("unit-why").textContent()) ?? "";
  expect(why).not.toBe("");
  return { sigma, why };
}

test.describe("a unit row keeps σ's ⚠ and its reason (R886)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await open(page, "");
    await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
  });

  test("ln(1 ± 0.5): the row draws ± ⚠0.64 and the view's reason; Copy as shown writes the ⚠", async ({ page }) => {
    await inUnits(page, "\\ln(1\\pm0.5)");
    const v = await viewWarn(page);
    expect(v.sigma).toBe("⚠0.64");
    expect(v.why).toBe("the interval reaches a singular point");
    await leave(page, 1);
    await expect(lastResult(page)).toHaveAttribute("data-text", /± ⚠0\.64$/);
    await expect(reasonLine(page)).toContainText(v.why);
    await copyShown(page);
    await expect.poll(() => clipboard(page)).toMatch(/± ⚠0\.64$/);
  });

  test("(2 ± 0.1)^10: the row draws ± ⚠ and first order's reason; Copy as shown writes the ⚠", async ({ page }) => {
    await inUnits(page, "(2\\pm0.1)^{10}");
    const v = await viewWarn(page);
    expect(v.why).toBe("first order does not hold here");
    await leave(page, 1);
    await expect(lastResult(page)).toHaveAttribute("data-text", new RegExp(` ± ${v.sigma}$`));
    await expect(reasonLine(page)).toContainText(v.why);
    await copyShown(page);
    await expect.poll(() => clipboard(page)).toMatch(new RegExp(` ± ${v.sigma}$`));
  });

  // R886f1: Paste reads the ⚠ text back (R325's round trip, docs/04 2.6): one result chip, σ in the unit, the ⚠ not kept.
  // (ln of a value with a unit is refused by the view, so the warning here is the power's: (2 ± 0.1)^10 in m, a slot m¹⁰)
  test("(2 ± 0.1)^10 in m: Copy as shown writes ± ⚠σ m¹⁰, Paste on an empty line gives the result chip", async ({ page }) => {
    await inUnits(page, "(2\\pm0.1)^{10}", true);
    const v = await viewWarn(page);
    await leave(page, 1);
    await copyShown(page);
    await expect.poll(() => clipboard(page)).toMatch(new RegExp(` ± ${v.sigma} m¹⁰$`));
    await page.evaluate(() => window.n62.entry.clear());
    await tap(page, PASTE);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const table = window.n62.entry.chips;
          const keys = Object.keys(table).filter((k) => k.startsWith("res:"));
          const c = keys.length === 1 ? table[keys[0] as string] : undefined;
          return c && { unc: c.unc, unit: c.unit?.text, exact: c.exact };
        }),
      )
      .toEqual({ unc: v.sigma.slice(1), unit: "m¹⁰", exact: false });
  });

  test("control: a σ without a warning has no ⚠ and no reason line", async ({ page }) => {
    await inUnits(page, "9.81\\pm0.05", true);
    await expect(page.getByTestId("unit-why")).toHaveCount(0);
    await leave(page, 1);
    await expect(lastResult(page)).toHaveAttribute("data-text", "9.810 ± 0.050 m");
    await expect(page.getByTestId("mark-reason")).toHaveCount(0);
  });
});
