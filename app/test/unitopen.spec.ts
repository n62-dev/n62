// SPDX-License-Identifier: GPL-3.0-or-later
// R917 (layers study 2026-11-23, F370 F371): the unit view opens and closes in one step and gives the line back as it took it.
// Each window is forced, not raced: (b) the open held at its first wait (the dev server's test hook, units/open.ts `unitHooks`),
// (a) the units chunk's request held back (page.route), a fault thrown once the field is hidden, and a key pressed in the same
// task as the constant pick that reopens the view. After Esc the line is the one the view took and the focus is on its field.
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

const viewUp = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element && document.querySelector('[data-pad="unit"]') !== null);
const ready = (page: Page): Promise<unknown> => page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
const row = (page: Page, i: number) => page.locator("article.item").nth(i).locator(".result");
const line = (page: Page): Promise<string> => page.evaluate(() => window.n62.entry.value);
/** The view's line (what it was built on). */
const viewLine = (page: Page): Promise<string | undefined> => page.evaluate(() => window.n62.unitView?.view.line);
const onField = (page: Page): Promise<boolean> => page.evaluate(() => document.activeElement !== null && document.activeElement === window.n62.entry.field);
const fieldShown = (page: Page): Promise<boolean> => page.evaluate(() => (document.querySelector<HTMLElement>(".entry .field")?.style.display ?? "none") !== "none");
const panels = (page: Page): Promise<number> => page.locator('[data-testid="unit-view"]').count();

/** 5 Enter, then 7 2 on the line: the row the taps reach and the line the view takes. */
async function start(page: Page): Promise<void> {
  await ready(page);
  await tap(page, ["d5", "enter"]);
  await expect(page.locator('article.item[data-status="done"]')).toHaveCount(1);
  await tap(page, ["d7", "d2"]);
  expect(await line(page)).toBe("72");
}

/** Esc leaves: the line is `taken` again, the focus on its field, the view and its panel gone. */
async function leaves(page: Page, taken: string): Promise<void> {
  await tap(page, ["esc"]);
  await page.waitForFunction(() => window.n62.unitView === undefined);
  expect(await line(page)).toBe(taken);
  expect(await panels(page)).toBe(0);
  expect(await fieldShown(page)).toBe(true);
  await expect.poll(() => onField(page)).toBe(true);
}

test.describe("R917: the unit view opens in one step and gives the line back", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await open(page, "");
  });

  test("window (b): two row taps while the open waits; the view is on 72 and Esc gives back 72", async ({ page }) => {
    await page.evaluate(() => {
      const w = window as unknown as { release?: () => void; reached?: boolean };
      window.n62.unitHooks = { hold: () => new Promise<void>((r) => ((w.reached = true), (w.release = r))) };
    });
    await start(page);
    await tap(page, ["shift", "tmpl"]);
    await page.waitForFunction(() => (window as unknown as { reached?: boolean }).reached === true, undefined, { timeout: 5000 });
    await row(page, 0).tap();
    await row(page, 0).tap();
    expect(await line(page)).toBe("72"); // the taps wait for the open, as keys do (R8); once it is up they reach the lent line (R918)
    await page.evaluate(() => (window as unknown as { release: () => void }).release());
    await viewUp(page);
    expect(await viewLine(page)).toBe("72");
    await leaves(page, "72");
  });

  test("window (a): two row taps while the units chunk loads wait for it; the view opens on 72 and Esc gives back 72", async ({ page }) => {
    let release = (): void => {};
    const held = new Promise<void>((r) => (release = r));
    await page.route(/\/src\/units\/open\.ts/, async (r) => {
      await held;
      await r.continue();
    });
    await start(page);
    await tap(page, ["shift", "tmpl"]);
    await row(page, 0).tap();
    await row(page, 0).tap();
    expect(await line(page)).toBe("72"); // the taps wait for the load, as keys do (R8)
    release();
    await viewUp(page);
    expect(await viewLine(page)).toBe("72");
    await leaves(page, "72");
  });

  test("a fault once the field is hidden: the line is shown again, no panel stays, the keys reach the line and the units key opens one view", async ({ page }) => {
    await page.evaluate(() => {
      const w = window as unknown as { faulted?: boolean };
      window.n62.unitHooks = { fault: () => ((w.faulted = true), (() => { throw new Error("R917: an injected fault"); })()) };
    });
    await start(page);
    await tap(page, ["shift", "tmpl"]);
    await page.waitForFunction(() => (window as unknown as { faulted?: boolean }).faulted === true, undefined, { timeout: 5000 });
    await page.waitForFunction(() => document.querySelector('[data-testid="unit-view"]') === null);
    expect(await fieldShown(page)).toBe(true);
    expect(await page.evaluate(() => window.n62.unitView)).toBeUndefined();
    await tap(page, ["d3"]);
    expect(await line(page)).toBe("723");
    await page.evaluate(() => (window.n62.unitHooks = undefined));
    await tap(page, ["shift", "tmpl"]);
    await viewUp(page);
    expect(await panels(page)).toBe(1);
    expect(await viewLine(page)).toBe("723");
    await leaves(page, "723");
  });

  test("a key pressed as a constant reopens the view waits for it: it goes to the view, not the line", async ({ page }) => {
    await ready(page);
    await tap(page, ["d2", "shift", "tmpl"]);
    await viewUp(page);
    await tap(page, ["math"]);
    const find = page.getByTestId("find");
    await expect(find).toBeVisible();
    for (const id of ["ucat:const", "uconst:Math"]) await find.locator(`[role="menuitem"][data-id="${id}"]`).tap();
    // the pick and the key in one task: the reopen has not reached its first wait yet
    await page.evaluate(() => {
      const pi = document.querySelector<HTMLElement>('[data-testid="find"] [role="menuitem"][data-id="math:pi"]');
      if (!pi) throw new Error("no π row");
      pi.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      pi.click();
      window.n62.entry.onKey("d3", undefined as never, false);
    });
    await page.waitForFunction(() => /\\pi/.test(window.n62.unitView?.view.line ?? ""));
    await viewUp(page);
    const taken = await line(page);
    expect(taken).toMatch(/^2.*\\pi$/); // the 3 went to the view's slot, not after π on the line
    await leaves(page, taken);
  });
});
