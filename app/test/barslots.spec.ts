// SPDX-License-Identifier: GPL-3.0-or-later
// R782 (owner, 2026-11-20): the bar's left side never shifts: ⌄ · APP▾ · [Home | slot 2] · hairline. APP▾ is outside the
// track (a neutral ⊞▾ in Home and CAS, the app's glyph in a place opened through it); Home is fixed; slot 2 is CAS until a
// second tap on it (while it is the current place) opens the Apps sheet titled "Slot 2" and a pick puts that place there.
// The fake engine. Widths 360, 392 and 412.
import { expect, test, type Page } from "@playwright/test";
import { open, sheet, touch } from "./helpers.ts";

const WIDTHS = [360, 392, 412] as const;
const PLACES = ["home", "cas", "function:symb", "function:plot", "function:num"] as const;
type Place = (typeof PLACES)[number];

async function goTo(page: Page, place: Place): Promise<void> {
  await page.evaluate(async (p) => {
    const { session, shell } = window.n62;
    if (p === "home" || p === "cas") {
      shell.close();
      session.view = p;
      return;
    }
    const [app, view] = p.split(":") as ["function", "symb" | "plot" | "num"];
    await shell.open(app, view);
  }, place);
  await page.waitForFunction(() => window.n62.shell.loading === null);
}

const left = (page: Page, id: string): Promise<string> =>
  page.evaluate((i) => {
    const r = document.querySelector(`[data-testid="${i}"]`)?.getBoundingClientRect();
    return r ? `${r.left.toFixed(1)},${r.width.toFixed(1)}` : "missing";
  }, id);
const apps = (page: Page) => page.getByTestId("apps");
const row = (page: Page, id: string) => apps(page).locator(`[role="menuitem"][data-id="${id}"]`);
const slot = (page: Page) => page.getByTestId("tab-slot");
const state = (page: Page) => page.evaluate(() => ({ app: window.n62.shell.app, view: window.n62.session.view, slot: window.n62.session.settings.barSlot }));

for (const width of WIDTHS)
  test(`APP▾, Home and slot 2 keep x and width in Home, CAS and Function, at ${width} px (R782)`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    try {
      await open(page);
      for (const barSlot of ["cas", "solve"]) {
        await page.evaluate((s) => (window.n62.session.settings.barSlot = s as "cas" | "solve"), barSlot);
        let base: string[] | undefined;
        for (const place of PLACES) {
          await goTo(page, place);
          const boxes = await Promise.all(["place", "tab-home", "tab-slot"].map((id) => left(page, id)));
          expect(boxes, `${place}, slot ${barSlot}`).not.toContain("missing");
          if (base === undefined) base = boxes;
          else expect(boxes, `${place}, slot ${barSlot}: the left side moved`).toEqual(base);
        }
      }
    } finally {
      await ctx.close();
    }
  });

test("APP▾ is a neutral ⊞▾ in Home and CAS; in Function opened from it, ƒ with the highlight, and the slot stays at CAS (R782)", async ({ page }) => {
  await open(page);
  await expect(page.getByTestId("place").locator(".tile.grid")).toHaveCount(1);
  await expect(page.getByTestId("place")).toContainText("▾");
  await page.getByTestId("tab-slot").tap();
  expect(await state(page)).toEqual({ app: null, view: "cas", slot: "cas" });
  await expect(page.getByTestId("place").locator(".tile.grid")).toHaveCount(1);
  await page.getByTestId("place").tap();
  await row(page, "function").tap();
  await page.waitForFunction(() => window.n62.shell.app === "function" && window.n62.shell.loading === null);
  const place = page.getByTestId("place");
  await expect(place).toContainText("ƒ");
  await expect(place.locator(".tile.grid")).toHaveCount(0);
  await expect(place).toHaveAttribute("data-cur", "true");
  await expect(slot(page)).toHaveAttribute("data-place", "cas"); // a pick from APP▾ leaves the slots as they were
  await expect(slot(page)).toHaveAttribute("aria-selected", "false");
  await expect(page.getByTestId("tab-home")).toHaveAttribute("aria-selected", "false");
  expect((await state(page)).slot).toBe("cas");
});

test("a second tap on the current slot 2 opens \"Slot 2\": Solve fills it, the CAS row restores it, Home's row does nothing (R782)", async ({ page }) => {
  await open(page);
  await slot(page).tap();
  await expect(apps(page)).toHaveCount(0); // the first tap goes to CAS
  expect(await state(page)).toEqual({ app: null, view: "cas", slot: "cas" });
  await slot(page).tap(); // a second tap, on the current place
  await expect(apps(page)).toBeVisible();
  await expect(apps(page)).toContainText("Slot 2");
  await row(page, "home").tap(); // Home's row is dead there
  await expect(apps(page)).toBeVisible();
  expect(await state(page)).toEqual({ app: null, view: "cas", slot: "cas" });
  await row(page, "solve").tap();
  await page.waitForFunction(() => window.n62.shell.app === "solve" && window.n62.shell.loading === null);
  expect((await state(page)).slot).toBe("solve");
  await expect(slot(page)).toHaveAttribute("data-place", "solve");
  await expect(slot(page)).toHaveAttribute("aria-selected", "true");
  await expect(slot(page).locator(".nm")).toHaveText("Solv");
  await expect(page.getByTestId("place").locator(".tile.grid")).toHaveCount(1); // Solve is in the slot: APP▾ is neutral
  // Home, then the slot: one tap opens Solve (the slot holds it); the second tap on it is the sheet
  await page.getByTestId("tab-home").tap();
  expect(await state(page)).toEqual({ app: null, view: "home", slot: "solve" });
  await slot(page).tap();
  await page.waitForFunction(() => window.n62.shell.app === "solve" && window.n62.shell.loading === null);
  await expect(apps(page)).toHaveCount(0);
  await slot(page).tap();
  await expect(apps(page)).toContainText("Slot 2");
  await row(page, "cas").tap();
  await page.waitForFunction(() => window.n62.shell.app === null);
  expect(await state(page)).toEqual({ app: null, view: "cas", slot: "cas" });
  await expect(slot(page)).toHaveAttribute("data-place", "cas");
});

test("◢ shows only on the current slot 2, never on Home, and not for a place opened from APP▾ (R782)", async ({ page }) => {
  await open(page);
  const mark = page.getByTestId("slot-mark");
  await expect(mark).toHaveCount(0); // Home is current
  await slot(page).tap();
  await expect(mark).toHaveCount(1);
  await expect(mark).toHaveText("◢");
  await expect(page.getByTestId("tab-home").getByTestId("slot-mark")).toHaveCount(0);
  await page.getByTestId("tab-home").tap();
  await expect(mark).toHaveCount(0);
  await page.getByTestId("place").tap();
  await row(page, "function").tap();
  await page.waitForFunction(() => window.n62.shell.app === "function" && window.n62.shell.loading === null);
  await expect(mark).toHaveCount(0);
});

test("the slot survives a reload (R782)", async ({ page }) => {
  await open(page);
  await slot(page).tap();
  await slot(page).tap();
  await row(page, "solve").tap();
  await page.waitForFunction(() => window.n62.shell.app === "solve" && window.n62.shell.loading === null);
  await page.waitForTimeout(400); // the settings are written
  await page.reload();
  await page.waitForFunction(() => window.n62 !== undefined && window.n62.session.settings.barSlot === "solve");
  await expect(slot(page)).toHaveAttribute("data-place", "solve");
  await expect(slot(page).locator(".nm")).toHaveText("Solv");
});

test("no hold on APP▾, Home or slot 2 does anything (R782)", async ({ page }) => {
  await open(page);
  for (const id of ["place", "tab-home", "tab-slot"]) {
    const f = await touch(page, `[data-testid="${id}"]`);
    await page.waitForTimeout(900);
    await f.cancel();
    await expect(sheet(page)).toHaveCount(0);
    expect(await state(page), id).toEqual({ app: null, view: "home", slot: "cas" });
  }
});

test("the first-start tip names ⊞▾, Home and a second tap on CAS (R782)", async ({ page }) => {
  await open(page, "engine=fake&tips=on");
  const tips = page.getByTestId("tips");
  await expect(tips).toBeVisible();
  await expect(tips).toContainText("⊞▾");
  await expect(tips).toContainText("Home");
  await expect(tips).toContainText("second tap on CAS");
});

for (const width of [360, 412] as const)
  test(`the folded bar holds Home and slot 2 at the open bar's x and width, at ${width} px (R782)`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width, height: 740 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    try {
      await open(page);
      await expect(page.getByTestId("keys")).toHaveAttribute("data-fold-ready", "true");
      const open_ = await Promise.all(["tab-home", "tab-slot"].map((id) => left(page, id)));
      expect(open_).not.toContain("missing");
      const f = await touch(page, '[data-testid="entry"]');
      await f.move(0, 40, 4);
      await f.end();
      await expect(page.getByTestId("keys")).toHaveAttribute("data-folded", "true");
      expect(await Promise.all(["tab-home", "tab-slot"].map((id) => left(page, id)))).toEqual(open_);
    } finally {
      await ctx.close();
    }
  });
