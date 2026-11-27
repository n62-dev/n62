// SPDX-License-Identifier: GPL-3.0-or-later
// G796 (owner-style hunt 2026-11-23, h3 #11): Copy of a row nobody checked (a bare ⚠, fsolve "is not checked") writes the
// digits it shows, no more (docs/04 2.6); a row whose digits are confirmed keeps every one (40 for 1/3). Values derived
// (mpmath, 30 digits): 2^(1/3) = 1.25992104989487316476721…, the root of cos(x) = x 0.739085133215160641655…, each to 12.
import { expect, test, type Page } from "@playwright/test";
import { finger } from "./core-lib.ts";
import { open, setClipboard } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
test.describe.configure({ mode: "serial" });

const clipboard = (page: Page): Promise<string> => page.evaluate(() => navigator.clipboard.readText());
const rows = (page: Page) => page.locator('[data-status="done"]');

/** Enter `latex` in `view` and wait for its row, the n-th. */
async function run(page: Page, view: "home" | "cas", latex: string, n: number): Promise<void> {
  await page.evaluate((v) => window.n62.session.setView(v), view);
  await page.evaluate((l) => window.n62.session.submit(l), latex);
  await expect(rows(page)).toHaveCount(n);
}
/** A hold on the last row's result; the clipboard it leaves. */
async function holdCopy(page: Page): Promise<string> {
  await setClipboard(page, "before");
  await finger(page, "result:last", { ms: 700 });
  await expect.poll(() => clipboard(page)).not.toBe("before");
  return clipboard(page);
}

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
});

test("a hold on Home's fsolve(x^3-2=0,x), ⚠ not checked, copies the 12 digits shown", async ({ page }) => {
  await run(page, "home", "\\operatorname{fsolve}\\left(x^{3}-2=0,x\\right)", 1);
  await expect(rows(page).last().getByTestId("mark")).toHaveText("⚠");
  expect(await holdCopy(page)).toBe("1.25992104989");
});

test("a hold on CAS fsolve(cos(x)=x,x), ⚠ not checked, copies the 12 digits shown", async ({ page }) => {
  await run(page, "cas", "\\operatorname{fsolve}\\left(\\cos\\left(x\\right)=x,x\\right)", 1);
  await expect(rows(page).last().getByTestId("mark")).toHaveText("⚠");
  expect(await holdCopy(page)).toBe("[0.739085133215]");
});

test("control: a hold on Home's 1/3 (≈, every digit confirmed) still copies 40 digits", async ({ page }) => {
  await run(page, "home", "\\frac{1}{3}", 1);
  expect(await holdCopy(page)).toBe("0." + "3".repeat(40));
});
