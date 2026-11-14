// SPDX-License-Identifier: GPL-3.0-or-later
// R130: ☰ then 0 opens Export › (item 10 of the Home/CAS list), and its Work report saves `n62-work-<date>.md` through
// the save port (a stand-in picker here, helpers.savePicker). Expected values are derived: 1/3 at 12 digits, 2 + 3.
import { expect, test } from "@playwright/test";
import { open, savePicker, savedText, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await savePicker(page, "fake");
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
});

test("☰ 0 opens Export ›, and Work report saves the view's steps as n62-work-<date>.md (R130)", async ({ page }) => {
  await tap(page, ["d1", "div", "d3", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await tap(page, ["d2", "add", "d3", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(2);
  await tap(page, ["@menu", "d0"]);
  await expect(page.getByTestId("sheet-title")).toHaveText(/› Export$/);
  await expect(page.getByRole("menuitem")).toHaveText([/^1\s*Work report/]);
  await tap(page, ["d1"]);
  await expect(page.getByTestId("notice")).toHaveText("Work report saved");
  const file = await savedText(page);
  expect(file?.name).toMatch(/^n62-work-\d{4}-\d{2}-\d{2}\.md$/);
  const lines = (file?.text ?? "").split("\n");
  expect(lines[0]).toMatch(/^N62 \d+\.\d+\.\d+\S* · preview: the form of this file can change$/);
  expect(lines).toContain("- Angle mode at export: Radians");
  // R130f1: a row computed in the export's mode has no Angle line; until G211 fills a row's angle each step says it was
  // not recorded (workReport.test.ts pins the three cases)
  expect(lines).not.toContain("- Angle: Radians");
  expect(lines).toContain("- Digits: 12");
  const steps = lines.filter((l) => l !== "- Angle: not recorded");
  const step = (n: number): string[] => steps.slice(steps.indexOf(`## Step ${n}`), steps.indexOf(`## Step ${n}`) + 5);
  expect(step(1)).toEqual(["## Step 1", "", "- Input: `1/3`", "- Mark: ≈ rounded: the exact value is 1/3", "- Value: `0.333333333333`"]);
  expect(step(2)).toEqual(["## Step 2", "", "- Input: `2+3`", "- Mark: = exact", "- Value: `5`"]);
  expect(file?.text).not.toContain("## Step 3");
});

test("Export › is off while nothing has finished, so 0 then 1 saves nothing", async ({ page }) => {
  await tap(page, ["@menu"]);
  await expect(page.locator('[role="menu"] [data-id="export"]')).toBeDisabled();
  await tap(page, ["d0", "d1"]);
  expect(await savedText(page)).toBeUndefined();
});
