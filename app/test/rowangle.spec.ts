// SPDX-License-Identifier: GPL-3.0-or-later
// R265 (night review 2026-11-09, S2): a history row that reads the angle and ran in another mode than the one on show carries a
// small tag with its mode; a recall of it that runs in the current mode says so in one line. A row of the current mode, a row
// whose input reads no angle (`2+3`) and a chip of the row (docs/04 2.8, it keeps its value) say nothing.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { open, tap, tapTwice } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page);
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
});

const rows = (page: Page): Locator => page.locator("article.item");
const tag = (row: Locator): Locator => row.getByTestId("row-angle");
const note = (row: Locator): Locator => row.getByTestId("row-angle-note");
const setAngle = (page: Page, a: "deg" | "rad"): Promise<void> => page.evaluate((x) => window.n62.session.setAngle(x), a);

async function enterRow(page: Page, keys: string[], count: number): Promise<void> {
  await tap(page, [...keys, "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(count);
}

test("a row typed in DEG shows a DEG tag in RAD; its own mode and an input that reads no angle show none", async ({ page }) => {
  await setAngle(page, "deg");
  await enterRow(page, ["sin", "d3", "d0"], 1);
  await enterRow(page, ["d2", "add", "d3"], 2);
  await expect(tag(rows(page).first())).toHaveCount(0); // DEG on show: the row's own mode
  await setAngle(page, "rad");
  await expect(tag(rows(page).first())).toHaveText("DEG");
  await expect(tag(rows(page).nth(1))).toHaveCount(0); // 2+3 reads no angle
  await enterRow(page, ["sin", "d3", "d0"], 3);
  await expect(tag(rows(page).nth(2))).toHaveCount(0); // a row of the current mode
  await expect(tag(rows(page).first())).toHaveText("DEG");
  await setAngle(page, "deg");
  await expect(tag(rows(page).first())).toHaveCount(0);
  await expect(tag(rows(page).nth(2))).toHaveText("RAD");
});

test("the tag takes no row height", async ({ page }) => {
  await setAngle(page, "deg");
  await enterRow(page, ["sin", "d3", "d0"], 1);
  const before = (await rows(page).first().boundingBox())?.height ?? 0;
  await setAngle(page, "rad");
  await expect(tag(rows(page).first())).toHaveText("DEG");
  expect((await rows(page).first().boundingBox())?.height ?? 0).toBe(before);
});

test("a recall of the DEG row in RAD runs in RAD and the new row says so; a chip of the row and a recall in its own mode say nothing", async ({ page }) => {
  await setAngle(page, "deg");
  await enterRow(page, ["sin", "d3", "d0"], 1);
  await setAngle(page, "rad");
  await tapTwice(rows(page).first().locator(".in"), "click");
  await tap(page, ["enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(2);
  await expect(note(rows(page).nth(1))).toContainText("RAD");
  await expect(note(rows(page).nth(1))).toContainText("DEG");
  await expect(note(rows(page).first())).toHaveCount(0);
  expect(await page.evaluate(() => window.n62.session.items[1]?.angle)).toBe("rad");
  // a chip of the row keeps its value and gets no note
  await tapTwice(rows(page).first().locator(".result"), "click");
  await tap(page, ["enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(3);
  await expect(note(rows(page).nth(2))).toHaveCount(0);
  // a recall edited before Enter is a new entry; a recall in the row's own mode needs no note
  await tapTwice(rows(page).first().locator(".in"), "click");
  await tap(page, ["add", "d1"]);
  await tap(page, ["enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(4);
  await expect(note(rows(page).nth(3))).toHaveCount(0);
  await setAngle(page, "deg");
  await tapTwice(rows(page).first().locator(".in"), "click");
  await tap(page, ["enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(5);
  await expect(note(rows(page).nth(4))).toHaveCount(0);
});

test("a recall cleared and typed again by hand is a new entry: no note (R265f1)", async ({ page }) => {
  await setAngle(page, "deg");
  await enterRow(page, ["sin", "d3", "d0"], 1);
  await setAngle(page, "rad");
  await tapTwice(rows(page).first().locator(".in"), "click");
  await tap(page, ["esc"]); // the line is empty again
  await tap(page, ["sin", "d3", "d0"]); // the same text, typed
  await tap(page, ["enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(2);
  await expect(note(rows(page).nth(1))).toHaveCount(0);
  expect(await page.evaluate(() => window.n62.session.items[1]?.typedIn)).toBeUndefined();
});

test("the note survives a reload", async ({ page }) => {
  await setAngle(page, "deg");
  await enterRow(page, ["sin", "d3", "d0"], 1);
  await setAngle(page, "rad");
  await tapTwice(rows(page).first().locator(".in"), "click");
  await tap(page, ["enter"]);
  await expect(note(rows(page).nth(1))).toContainText("DEG");
  await page.waitForTimeout(800); // the store write is debounced
  await page.reload();
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
  await expect(rows(page)).toHaveCount(2); // the stored history is read after the first frames
  await expect(note(rows(page).nth(1))).toContainText("DEG");
  await expect(tag(rows(page).first())).toHaveText("DEG");
});
