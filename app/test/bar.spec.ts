// SPDX-License-Identifier: GPL-3.0-or-later
// R722: the bar on the keypad's top edge (docs/05 3.2): Apps ▾ · Home | CAS · ⇧/α · RAD · STD ▾ · 12 ▾ · ☰, 28 px, flush
// on the keys; the short key rows a notch taller (43 / 33 px under 1000 px tall). The fake engine.
import { expect, test, type Page } from "@playwright/test";
import { BAR_ITEMS } from "../src/views/barItems.ts";
import { hwOn, open, sheet, tap, touch } from "./helpers.ts";

const box = (page: Page, sel: string) =>
  page.evaluate((s) => {
    const r = document.querySelector(s)?.getBoundingClientRect();
    return r ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height, width: r.width } : null;
  }, sel);
const BAR = '[data-testid="bar"]';
const angle = (page: Page) => page.evaluate(() => window.n62.session.settings.angle);
const toApp = async (page: Page, app: "function" | "solve", view: "symb" | "plot" | "num"): Promise<void> => {
  await page.evaluate(([a, v]) => window.n62.shell.open(a, v), [app, view] as const);
  await page.waitForFunction(() => window.n62.shell.loading === null && window.n62.shell.current !== null);
};

test("the order at 412 × 815: the entry line, the bar and the pad touch, and the screen is 343 px (R722)", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 815 });
  await open(page);
  const entry = await box(page, '[data-testid="entry"]');
  const bar = await box(page, BAR);
  const keys = await box(page, '[data-testid="keys"]');
  const screen = await box(page, ".screen");
  expect(bar?.height).toBe(28);
  expect(Math.abs((entry?.bottom ?? 0) - (bar?.top ?? -9))).toBeLessThanOrEqual(0.5);
  expect(Math.abs((bar?.bottom ?? 0) - (keys?.top ?? -9))).toBeLessThanOrEqual(0.5);
  expect(screen?.top).toBe(0);
  console.log(`412 × 815: screen ${screen?.height} px, keys ${keys?.height} px, history ${(screen?.height ?? 0) - (entry?.height ?? 0)} px`);
  expect(Math.abs((screen?.height ?? 0) - 343)).toBeLessThanOrEqual(1);
});

test("Home shows the Home tab selected and the CAS tab; one tap switches; Home from Function › Plot is one tap (R722)", async ({ page }) => {
  await open(page);
  const home = page.getByTestId("tab-home");
  const cas = page.getByTestId("tab-cas");
  await expect(home).toHaveAttribute("role", "tab");
  await expect(home).toHaveAttribute("aria-selected", "true");
  await expect(cas).toHaveAttribute("aria-selected", "false");
  await cas.tap();
  expect(await page.evaluate(() => window.n62.session.view)).toBe("cas");
  await expect(cas).toHaveAttribute("aria-selected", "true");
  await expect(home).toHaveAttribute("aria-selected", "false");
  await toApp(page, "function", "plot");
  await expect(home).toHaveAttribute("aria-selected", "false");
  await expect(cas).toHaveAttribute("aria-selected", "false");
  await home.tap();
  expect(await page.evaluate(() => [window.n62.shell.app, window.n62.session.view])).toEqual([null, "home"]);
});

test("the bar's controls stand in the lock's order, left to right (spec/layout-lock.yaml bar:, R722)", async ({ page }) => {
  await open(page);
  const items = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-testid="bar"] [data-item]')].map((e) => ({ n: e.dataset["item"], x: e.getBoundingClientRect().left })),
  );
  expect(items.map((i) => i.n)).toEqual([...BAR_ITEMS]);
  expect(items.every((it, i) => i === 0 || it.x > (items[i - 1]?.x ?? 0))).toBe(true);
});

test("the place opens Apps; in Function it shows the app's glyph and, after the tabs, its views (R722, R785)", async ({ page }) => {
  await open(page);
  await page.getByTestId("place").tap();
  await expect(page.getByTestId("apps")).toBeVisible();
  await page.getByTestId("place").tap();
  await toApp(page, "function", "symb");
  await expect(page.getByTestId("place")).toContainText("ƒ");
  for (const v of ["symb", "plot", "num"]) await expect(page.getByTestId(`tab-${v}`)).toBeVisible();
  const place = (await box(page, '[data-testid="place"]'))!;
  const symb = (await box(page, '[data-testid="tab-symb"]'))!;
  const home = (await box(page, '[data-testid="tab-home"]'))!;
  expect(place.right <= home.left + 0.5 && home.right <= symb.left + 0.5).toBe(true); // glyph ▾, the tabs, the hairline, then the views (the bay)
});

test("the STD|12 chip is one target with no ▾ and opens Mode on Format (R722, R785)", async ({ page }) => {
  await open(page);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="chip-format"]')!, "::after").content)).toBe("none");
  await page.getByTestId("chip-format").tap();
  await expect(sheet(page).locator('[role="menuitem"][data-active="true"]')).toHaveAttribute("data-id", "format");
  await tap(page, ["esc"]);
  await expect(sheet(page)).toBeHidden();
});

/** A finger goes down on a key and the browser's click lands on a bar button (a tap whose up is over the bar). */
async function downOnKeyClickOn(page: Page, key: string, target: string): Promise<void> {
  const f = await touch(page, key);
  await page.evaluate((t) => document.querySelector(`[data-testid="${t}"]`)?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 })), target);
  await f.cancel();
}

test("the guard: a press that went down on a key never acts on the bar (R722)", async ({ page }) => {
  await open(page);
  await downOnKeyClickOn(page, "esc", "chip-angle");
  expect(await angle(page)).toBe("rad");
  await downOnKeyClickOn(page, "help", "chip-format"); // a press that went down on a key
  await expect(sheet(page)).toHaveCount(0);
  await page.getByTestId("chip-angle").tap(); // a press that went down on the chip acts
  expect(await angle(page)).toBe("deg");
});

for (const [width, height, key, nav] of [[412, 839, 43, 33], [360, 740, 43, 33], [800, 1148, 48, 36]] as const)
  test(`a digit key is ${key} px and a cluster key ${nav} px at ${width} × ${height} (R722)`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page);
    expect((await box(page, '[data-key="d5"]'))?.height).toBe(key);
    expect((await box(page, '[data-key="esc"]'))?.height).toBe(nav);
  });

test("the states: the ring on the current tile, the busy line read, the lock underline, a or α in CAS, the update pill at the stage's top (R722)", async ({ page }) => {
  await open(page, "engine=fake&delay=800");
  const tile = (id: string) => page.getByTestId(id).locator(".tile");
  await tap(page, ["d2", "add", "d3", "enter"]);
  await expect(page.getByTestId("busy-status")).toHaveText("Working");
  await expect(tile("tab-home")).toHaveAttribute("data-ring", "true");
  await expect(page.locator(BAR)).toHaveAttribute("data-busy", "true");
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await expect(tile("tab-home")).toHaveAttribute("data-ring", "false");
  await page.getByTestId("tab-cas").tap();
  await tap(page, ["alpha", "alpha"]);
  await hwOn(page); // R783: the badge with a hardware keyboard in use
  await expect(page.getByTestId("mod-alpha")).toHaveText("a");
  await expect(page.getByTestId("mod-alpha")).toHaveAttribute("data-lock", "true");
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="mod-alpha"]')!).boxShadow)).not.toBe("none");
  await tap(page, ["alpha"]);
  await page.evaluate(async () => {
    const url = "/src/state/updateOffer.svelte.ts";
    const m = (await import(/* @vite-ignore */ url)) as typeof import("../src/state/updateOffer.svelte.ts");
    m.updateOffer.restart = () => {};
  });
  const note = page.getByTestId("update-note");
  await expect(note).toBeVisible();
  const n = (await note.boundingBox())!;
  const stage = (await box(page, ".stage"))!;
  expect(n.y - stage.top).toBeLessThanOrEqual(12);
  expect(await page.locator(BAR).getByTestId("update-note").count()).toBe(0);
});

test("wide: at 1280 × 716 the bar heads the keypad column and the stage starts at the top (R722)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 716 });
  await open(page);
  const bar = (await box(page, BAR))!;
  const keys = (await box(page, '[data-testid="keys"]'))!;
  const stage = (await box(page, ".stage"))!;
  expect(Math.abs(bar.left - keys.left)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(bar.right - keys.right)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(bar.bottom - keys.top)).toBeLessThanOrEqual(0.5);
  expect(bar.top).toBe(0);
  expect(stage.top).toBe(0);
});
