// SPDX-License-Identifier: GPL-3.0-or-later
// R930: code that runs only after a key press, a sheet's open or a result left the start chunk for the lazy chunks that the
// same press already waited for. Each moved module's request is held back here: the press made before it is in does its job once
// it is, nothing typed is lost; and a session that sends no job requests no job code (state/jobRun.ts).
import { expect, test, type Page } from "@playwright/test";
import { entryValue, lastResult, open, sheet, tap } from "./helpers.ts";

/** Hold the requests of `what` back; returns the function that lets them through. */
async function hold(page: Page, what: RegExp): Promise<() => void> {
  let release = (): void => {};
  const gate = new Promise<void>((r) => (release = r));
  await page.route(what, async (route) => {
    await gate;
    await route.continue();
  });
  return release;
}

const JOB = /\/src\/state\/jobRun\.ts/;
const ready = (page: Page): Promise<unknown> => page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 30_000 });

test("a session that sends no job requests no job code; its first Enter does, and the result comes", async ({ page }) => {
  const urls: string[] = [];
  page.on("request", (r) => urls.push(r.url()));
  await open(page);
  await ready(page);
  await tap(page, ["d2", "add", "d3"]);
  await page.waitForTimeout(1500); // the idle loads (main.ts) have run
  expect(urls.filter((u) => JOB.test(u))).toEqual([]);
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toBeVisible();
  expect(urls.filter((u) => JOB.test(u)).length).toBeGreaterThan(0);
});

test("an Enter made before the job code is in shows its row at once and its result once the code is in", async ({ page }) => {
  const release = await hold(page, JOB);
  await open(page);
  await ready(page);
  await tap(page, ["d2", "add", "d3", "enter"]);
  await expect(page.locator('[data-testid="result"]')).toHaveCount(1); // the row is there, running
  expect(await entryValue(page)).toBe(""); // the line went with the Enter, as always
  await expect(lastResult(page)).toHaveCount(0);
  release();
  await expect(lastResult(page)).toBeVisible();
});

test("the real engine: an Enter made before the port's result code (calc/portKeys.ts) is in gives its result once it is: 2+3 = 5", async ({ page }) => {
  const release = await hold(page, /\/src\/calc\/portKeys\.ts/);
  await open(page, "");
  await ready(page);
  await tap(page, ["d2", "add", "d3", "enter"]);
  await expect(page.locator('[data-testid="result"]')).toHaveCount(1);
  release();
  await expect(lastResult(page)).toHaveText("5", { timeout: 20_000 }); // derived: 2 + 3
});

test("keys typed before the field's set-up code (entry/fieldUp.ts) is in land on the line, in order, once it is", async ({ page }) => {
  const release = await hold(page, /\/src\/entry\/fieldUp\.ts/);
  await page.goto("/?engine=fake&tips=off");
  await page.waitForFunction(() => window.n62 !== undefined);
  await tap(page, ["d1", "add", "d2"]);
  expect(await page.evaluate(() => window.n62.entry.field === undefined)).toBe(true);
  release();
  await page.evaluate(() => window.n62.entry.ready);
  await expect.poll(() => entryValue(page)).toBe("1+2");
});

test("Apps, then 4, typed before the Apps sheet's rows' code (apps/shellSheets.ts) is in, opens the fourth row's app once it is", async ({ page }) => {
  const release = await hold(page, /\/src\/apps\/shellSheets\.ts/);
  await open(page);
  await tap(page, ["d1", "@place", "d4"]);
  await expect(page.locator('[data-app="solve"]')).toHaveCount(0);
  expect(await entryValue(page)).toBe("1"); // the 4 was not typed into the line
  release();
  await expect(page.locator('[data-app="solve"]')).toBeVisible();
  await expect(page.getByTestId("apps")).toHaveCount(0);
});

test("Menu, then 3, typed before the Menu's rows' code is in, picks the third row (Clear history) once it is", async ({ page }) => {
  const release = await hold(page, /\/src\/apps\/shellSheets\.ts/);
  await open(page);
  await ready(page);
  await tap(page, ["d1", "enter"]);
  await expect(page.locator('[data-testid="result"]')).toHaveCount(1);
  await tap(page, ["@menu", "d3"]);
  expect(await entryValue(page)).toBe("");
  await expect(page.locator('[data-testid="result"]')).toHaveCount(1);
  release();
  await expect(page.locator('[data-testid="result"]')).toHaveCount(0);
  await expect(sheet(page)).toBeHidden();
});
