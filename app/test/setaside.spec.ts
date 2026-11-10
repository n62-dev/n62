// SPDX-License-Identifier: GPL-3.0-or-later
// R270 (bu-8, S3): Home's half-typed line waits while an app is open and comes back on close (R34 between views).
import { expect, test, type Page } from "@playwright/test";
import { entryValue, lastResult, open, tap, tapTwice } from "./helpers.ts";

const engineReady = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
const cursorAtEnd = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const mf = window.n62.entry.field;
    return mf !== undefined && mf.selectionIsCollapsed && mf.position === mf.lastOffset;
  });
const chipsOf = (page: Page): Promise<unknown> => page.evaluate(() => window.n62.entry.chips);
async function hide(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(300); // the store write is asynchronous
}

test("Home's unentered line, with its chips, waits while Function is open and comes back at the end", async ({ page }) => {
  await open(page, "");
  await engineReady(page);
  await tap(page, ["d1", "div", "d3", "enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "0.333333333333");
  await tapTwice(lastResult(page));
  await tap(page, ["add", "d1", "div", "d2"]);
  const line = await entryValue(page);
  expect(line).toBe("\\res{1}{0.333333333333}+\\frac12");
  const chips = await chipsOf(page);
  await tap(page, ["@symb"]);
  await expect(page.locator('[data-app="function"]')).toBeVisible();
  await expect.poll(() => entryValue(page)).toBe("");
  await tap(page, ["d7"]); // typed in Symb: the app's line
  await tap(page, ["@home"]);
  expect(await entryValue(page)).toBe(line);
  expect(await chipsOf(page)).toEqual(chips);
  expect(await cursorAtEnd(page)).toBe(true);
  await tap(page, ["enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(2);
  await expect(lastResult(page)).toHaveAttribute("data-text", "0.833333333333"); // derived: 1/3 + 1/2 = 5/6
});

test("a relaunch while the app is open brings the line back in Home", async ({ page }) => {
  await open(page, "engine=fake");
  await tap(page, ["d2", "add", "d3", "@symb"]);
  await expect(page.locator('[data-app="function"]')).toBeVisible();
  await hide(page);
  await page.evaluate(() => window.n62.yieldWriter());
  const next = await page.context().newPage();
  await open(next, "engine=fake");
  await expect(next.locator('[data-app="function"]')).toBeVisible();
  expect(await entryValue(next)).toBe("");
  await tap(next, ["@home"]);
  expect(await entryValue(next)).toBe("2+3");
  expect(await cursorAtEnd(next)).toBe(true);
});

test("an empty Home line stays empty; a line typed in the app is not carried over an empty Home", async ({ page }) => {
  await open(page, "engine=fake");
  await tap(page, ["@symb"]);
  await expect(page.locator('[data-app="function"]')).toBeVisible();
  await tap(page, ["@home"]);
  expect(await entryValue(page)).toBe("");
  await tap(page, ["@symb", "d4", "@home"]); // R34: the app's half-typed line follows to an empty Home
  expect(await entryValue(page)).toBe("4");
});

test("Home's line is put back once, then Esc empties it for good", async ({ page }) => {
  await open(page, "engine=fake");
  await tap(page, ["d2", "add", "d3", "@symb", "@home"]);
  expect(await entryValue(page)).toBe("2+3");
  await tap(page, ["esc", "@symb", "@home"]);
  expect(await entryValue(page)).toBe("");
});
