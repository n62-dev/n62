// SPDX-License-Identifier: GPL-3.0-or-later
// R700 (F381): Android back (the WebView's goBack(), here `page.goBack()`) closes what is open before it leaves the app:
// a picked history row, the unit view, an armed or locked Shift or Alpha, each as Esc would, in the order they opened
// (app/src/input/backLayer.ts). With nothing open back leaves. The fake engine, 412 × 839.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, flick, open, sheet, tap, touch } from "./helpers.ts";

test.use({ viewport: { width: 412, height: 839 } });

const picked = (p: Page) => p.locator('[data-selected="true"]');
const bar = (p: Page) => p.getByTestId("row-actions");
const layer = (p: Page) => p.evaluate(() => (history.state as { n62Layer?: number } | null)?.n62Layer);
const inLine = (p: Page): Promise<boolean> => p.evaluate(() => document.activeElement?.tagName === "MATH-FIELD");
const gone = (p: Page) => expect.poll(() => p.url()).toBe("about:blank"); // back left the app
const stays = (p: Page) => expect(p.url()).toContain("engine=fake");
const mods = (p: Page) => p.evaluate(() => ({ s: window.n62.session.shift, a: window.n62.session.alpha, sl: window.n62.session.shiftLock, al: window.n62.session.alphaLock }));
/** What the outline says (App.svelte data-ring: "shift" armed, "alpha", "error", else none) and the colour it is drawn in (--ring-c on the field: --shift armed, --ring at rest). */
const ring = (p: Page) =>
  p.evaluate(() => {
    const e = document.querySelector<HTMLElement>('[data-testid="entry"]') as HTMLElement;
    const f = e.querySelector("math-field") as HTMLElement;
    return { state: e.dataset["ring"] ?? "", colour: getComputedStyle(f).getPropertyValue("--ring-c").trim(), w: getComputedStyle(f).getPropertyValue("--ring-w").trim() };
  });
const fold = async (p: Page): Promise<void> => {
  const f = await touch(p, '[data-testid="entry"]'); // R283: a swipe down on the line
  await f.move(0, 40, 4);
  await f.end();
  await expect(p.getByTestId("keys")).toHaveAttribute("data-folded", "true");
};

test.beforeEach(async ({ page }) => {
  await open(page);
  await expect(page.getByTestId("keys")).toHaveAttribute("data-fold-ready", "true");
});

test("(a) a picked row: back drops the pick, the line is empty and focused; a second back leaves", async ({ page }) => {
  await tap(page, ["d2", "add", "d3", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await tap(page, ["up"]);
  await expect(picked(page)).toHaveCount(1);
  await expect(bar(page)).toBeVisible();
  await page.goBack();
  await expect(picked(page)).toHaveCount(0);
  await expect(bar(page)).toHaveCount(0);
  expect(await entryValue(page)).toBe("");
  await expect.poll(() => inLine(page)).toBe(true);
  stays(page);
  expect(await layer(page)).toBeUndefined();
  await page.goBack();
  await gone(page);
});

test("(b) the unit view: back closes it as Esc does, and the line is as it was", async ({ page }) => {
  await tap(page, ["d7"]);
  await tap(page, ["shift", "tmpl"]);
  await page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element);
  await tap(page, ["d5"]);
  await page.goBack();
  await page.waitForFunction(() => window.n62.unitView === undefined);
  stays(page);
  expect(await entryValue(page)).toBe("7");
  expect(await layer(page)).toBeUndefined();
  await page.goBack();
  await gone(page);
});

test("(c) Shift armed: back disarms it and the outline goes back to --ring", async ({ page }) => {
  const before = await ring(page);
  expect(before.state).not.toBe("shift");
  await tap(page, ["shift"]);
  expect((await mods(page)).s).toBe(true);
  await expect.poll(async () => (await ring(page)).state).toBe("shift");
  const armed = await ring(page);
  expect(armed.colour).not.toBe(before.colour); // --shift, not --ring
  await page.goBack();
  await expect.poll(async () => (await mods(page)).s).toBe(false);
  await expect.poll(async () => (await ring(page)).state).not.toBe("shift");
  expect(await ring(page)).toEqual(before); // --ring again, at its resting width
  stays(page);
  await page.goBack();
  await gone(page);
});

test("(d) Alpha lock: back unlocks", async ({ page }) => {
  await tap(page, ["alpha", "alpha"]);
  expect((await mods(page)).al).toBe(true);
  await page.goBack();
  await expect.poll(async () => await mods(page)).toEqual({ s: false, a: false, sl: false, al: false });
  stays(page);
  await flick(page, "shift", "up"); // a Shift lock too
  expect((await mods(page)).sl).toBe(true);
  await page.goBack();
  await expect.poll(async () => (await mods(page)).sl).toBe(false);
  stays(page);
});

test("(e) stacked: the keypad folded, then Shift armed: Shift, then the fold, then leave; Copy › ends the pick, so no pick lies under it", async ({ page }) => {
  await tap(page, ["d2", "add", "d3", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await tap(page, ["up"]);
  await bar(page).getByRole("button", { name: /Copy ›/ }).tap();
  await expect(sheet(page)).toBeVisible();
  await expect(picked(page)).toHaveCount(0); // (the bar's button ends the pick before the sheet opens)
  await page.goBack();
  await expect(sheet(page)).toBeHidden();
  stays(page);
  await fold(page);
  await page.evaluate(() => window.n62.session.toggleShift()); // (the keys are down: Shift is armed from the hardware's side)
  expect((await mods(page)).s).toBe(true);
  await page.goBack();
  await expect.poll(async () => (await mods(page)).s).toBe(false);
  await expect(page.getByTestId("keys")).toHaveAttribute("data-folded", "true");
  await page.goBack();
  await expect(page.getByTestId("keys")).toHaveAttribute("data-folded", "false");
  stays(page);
  await page.goBack();
  await gone(page);
});

test("(f) folded with a picked row: the pick, then the fold, then leave", async ({ page }) => {
  await tap(page, ["d2", "add", "d3", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await fold(page);
  await page.locator('[data-testid="result"] .result').last().tap();
  await expect(picked(page)).toHaveCount(1);
  await page.goBack();
  await expect(picked(page)).toHaveCount(0);
  await expect(page.getByTestId("keys")).toHaveAttribute("data-folded", "true");
  await page.goBack();
  await expect(page.getByTestId("keys")).toHaveAttribute("data-folded", "false");
  stays(page);
  await page.goBack();
  await gone(page);
});

test("control: back with nothing open leaves; a typed line does not stop it", async ({ page }) => {
  await tap(page, ["d4"]);
  await page.goBack();
  await gone(page);
});
