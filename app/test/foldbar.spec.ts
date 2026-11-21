// SPDX-License-Identifier: GPL-3.0-or-later
// R724, R786 (decisions.md P16; owner 2026-11-17, 2026-11-20): ⌄ at the bar's left end folds by a tap, and folded the bar
// and the slice are one 44 px row: ⌃ · Home | CAS · the free stretch · ⇧/α · Store ▶ · Copy › (with a pick) · ☰.
// The fake engine; touches through CDP (helpers.ts `touch`).
import { expect, test, type Page } from "@playwright/test";
import { open, sheet, tap, touch, useClipboardLock } from "./helpers.ts";
import { finger } from "./core-lib.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"], actionTimeout: 10_000 }); // (a missing control fails in 10 s, not at the clipboard budget)
useClipboardLock();

const CHEV = '[data-testid="fold-chevron"]';
const FBAR = '[data-testid="folded-bar"]';
const LINE = '[data-testid="entry"]';
const keys = (p: Page) => p.getByTestId("keys");
const isFolded = (p: Page, on: boolean) => expect(keys(p)).toHaveAttribute("data-folded", String(on));
const results = (p: Page) => p.locator('[data-testid="result"] .result');
const fbar = (p: Page) => p.locator(FBAR);
const clipboard = (p: Page): Promise<string> => p.evaluate(() => navigator.clipboard.readText());
type Box = { x: number; y: number; width: number; height: number };
async function box(p: Page, sel: string): Promise<Box> {
  const b = await p.locator(sel).first().boundingBox({ timeout: 5000 });
  if (!b) throw new Error(`${sel} is not visible`);
  return b;
}
const counts = (p: Page) => p.evaluate(async () => ({ ...(await window.n62.session.uses()).state.counts }));
async function swipeLine(p: Page, dy: number): Promise<void> {
  const f = await touch(p, LINE);
  await f.move(0, dy, 4);
  await f.end();
}
const fold = async (p: Page): Promise<void> => {
  await swipeLine(p, 40);
  await isFolded(p, true);
};
async function rows(p: Page, n = 2): Promise<void> {
  for (let i = 1; i <= n; i++) await tap(p, [`d${i}`, "enter"]);
  await expect(p.locator('[data-status="done"]')).toHaveCount(n);
}
test.beforeEach(async ({ page }) => {
  await open(page);
  await expect(keys(page)).toHaveAttribute("data-fold-ready", "true");
});

test("⌄ is the bar's first control in Home and CAS at 360, 392 and 412: at its left end, at least 28 × 28, named; a tap folds and counts fold.tap; ⌃ stands at the same x", async ({ page }) => {
  for (const width of [360, 392, 412]) {
    await page.setViewportSize({ width, height: 800 });
    for (const view of ["home", "cas"]) {
      await page.getByTestId(view === "home" ? "tab-home" : "tab-slot").tap(); // R782: slot 2 holds CAS
      await expect.poll(() => page.evaluate(() => window.n62.session.view)).toBe(view);
      const chev = page.locator(CHEV);
      await expect(chev).toHaveAccessibleName("Fold the keys");
      await expect(page.locator(`[data-testid="bar"] ${CHEV}`)).toHaveCount(1); // inside the bar, not the entry row
      const [b, bar, place] = await Promise.all([box(page, CHEV), box(page, '[data-testid="bar"]'), box(page, '[data-testid="place"]')]);
      expect(b.width).toBeGreaterThanOrEqual(28);
      expect(b.height).toBeGreaterThanOrEqual(28);
      expect(Math.abs(b.x - bar.x), `${width} ${view}: at the bar's left end`).toBeLessThanOrEqual(1);
      expect(b.x + b.width, `${width} ${view}: Apps ▾ follows`).toBeLessThanOrEqual(place.x + 0.5);
      await chev.tap();
      await isFolded(page, true);
      await expect(chev).toHaveCount(0); // hidden while folded
      const up = await box(page, '[data-testid="fold-slice"]');
      expect(Math.abs(up.x - b.x), `${width} ${view}: ⌃ at ⌄'s x`).toBeLessThanOrEqual(1);
      await page.getByTestId("fold-slice").tap();
      await isFolded(page, false);
    }
  }
  await expect.poll(async () => (await counts(page))["fold.tap"]).toBe(6);
});

test("⌄ is no control in Function (an empty cell, the next control at Home's x) and absent in the wide layout", async ({ page }) => {
  await expect(page.locator(CHEV)).toHaveCount(1);
  const home = (await box(page, '[data-testid="place"]')).x;
  await tap(page, ["@symb"]);
  await page.waitForFunction(() => window.n62.shell.app === "function" && window.n62.shell.loading === null);
  await expect(page.locator(CHEV)).toHaveCount(0);
  await expect(page.locator('[data-testid="bar"] [data-item="fold"]')).toHaveCount(0);
  expect((await box(page, '[data-testid="place"]')).x).toBe(home); // the cell is empty, nothing to its right moved
  await page.setViewportSize({ width: 1340, height: 800 });
  await open(page);
  await expect(keys(page)).toHaveAttribute("data-fold-ready", "true");
  await expect(page.locator(LINE)).toBeVisible();
  await expect(page.locator(CHEV)).toHaveCount(0);
});

test("the entry line has its full width: no left padding is kept for ⌄ (the field's own, at most --sp-3)", async ({ page }) => {
  const [field, row] = await Promise.all([box(page, `${LINE} math-field`), box(page, LINE)]);
  expect(Math.abs(field.x - (row.x + 12))).toBeLessThanOrEqual(1); // --sp-3, the row's padding
  const pad = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('[data-testid="entry"] math-field')!).paddingLeft));
  expect(pad).toBeLessThanOrEqual(12); // the field's own --sp-25, not --chev-pad (24)
});

test("folded at 412 × 815: one 44 px row at the bottom holds ⌃, Home, CAS, the slot and ☰; no separate slice; the screen is 771 px", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 815 });
  await fold(page);
  const b = await box(page, FBAR);
  expect(b.height).toBe(44);
  expect(b.y + b.height).toBe(815);
  for (const id of ["fold-slice", "tab-home", "tab-slot", "mod-slot", "menu-button"]) await expect(fbar(page).getByTestId(id)).toBeVisible();
  await expect(page.locator('[data-testid="bar"]')).toHaveCount(1); // one bar: the folded row's
  await expect(fbar(page).getByTestId("bar")).toHaveCount(1);
  for (const id of ["chip-angle", "chip-format", "place"]) await expect(fbar(page).getByTestId(id)).toBeHidden(); // no chips, no Apps ▾
  expect((await box(page, ".keys")).height).toBe(44);
  const screen = await page.evaluate(() => document.querySelector(".screen")?.getBoundingClientRect().height ?? 0);
  console.log(`folded history height at 412 × 815: ${screen}`);
  expect(screen).toBe(771);
  const s = await box(page, '[data-testid="fold-slice"]');
  expect(s.x).toBeLessThan(b.x + 1); // ⌃ in ⌄'s spot, at the bar's left end
});

test("☰ while folded opens Home's four rows with the keys still down", async ({ page }) => {
  await rows(page);
  await fold(page);
  await fbar(page).getByTestId("menu-button").tap();
  await expect(sheet(page).getByRole("menuitem")).toHaveCount(4);
  await isFolded(page, true);
  const m = await box(page, '[data-testid="menu"]');
  expect(m.y + m.height).toBeLessThanOrEqual((await box(page, FBAR)).y + 1); // over the history, the folded bar uncovered
});

test("a pick while folded: Store ▶ · Copy › in the folded bar; Copy › Full value writes what a hold copies, the keys stay down; Store ▶ opens Store in", async ({ page }) => {
  await rows(page);
  await fold(page);
  await finger(page, "result:last", { ms: 700 }); // a hold copies
  await expect(page.getByTestId("notice")).toHaveText("Copied");
  const held = await clipboard(page);
  await page.evaluate(() => navigator.clipboard.writeText("-"));
  await results(page).last().tap();
  const actions = fbar(page).getByTestId("row-actions");
  await expect(actions.getByRole("button")).toHaveText(["Store ▶", "Copy ›"]);
  const a = await box(page, `${FBAR} [data-testid="row-actions"]`), b = await box(page, FBAR);
  expect(a.y).toBeGreaterThanOrEqual(b.y - 0.5); // in the bar, not over the line
  expect(a.y + a.height).toBeLessThanOrEqual(b.y + b.height + 0.5);
  await actions.getByRole("button", { name: "Copy ›" }).tap();
  await sheet(page).locator('[data-id="full"]').tap();
  await expect.poll(() => clipboard(page)).toBe(held);
  await isFolded(page, true);
  await results(page).last().tap();
  await fbar(page).getByRole("button", { name: "Store ▶" }).tap();
  await expect(page.getByTestId("store")).toBeVisible();
  await isFolded(page, true);
});

test("unfolding from the folded bar: ⌃, the free stretch, and a 30 px drag up from Copy › that copies nothing", async ({ page }) => {
  await rows(page);
  await fold(page);
  await fbar(page).getByTestId("fold-slice").tap();
  await isFolded(page, false);
  await fold(page);
  await fbar(page).getByTestId("fold-free").tap();
  await isFolded(page, false);
  await fold(page);
  await page.evaluate(() => navigator.clipboard.writeText("-"));
  await results(page).last().tap();
  const f = await touch(page, `${FBAR} [data-testid="row-actions"] button:last-child`);
  await f.move(0, -30, 4);
  await isFolded(page, false);
  await f.end();
  await page.waitForTimeout(200);
  await expect(sheet(page)).toBeHidden(); // no Copy › list
  expect(await clipboard(page)).toBe("-");
});

test("the folded bar's states: the busy ring on the current tile, Shift in the slot", async ({ page }) => {
  await open(page, "engine=fake&delay=800");
  await expect(keys(page)).toHaveAttribute("data-fold-ready", "true");
  await tap(page, ["shift"]);
  await fold(page);
  await expect(fbar(page).getByTestId("mod-shift")).toHaveText("⇧");
  await page.evaluate(() => window.n62.session.releaseModifiers());
  await expect(fbar(page).getByTestId("mod-shift")).toHaveCount(0);
  await page.keyboard.type("2");
  await page.keyboard.press("Enter");
  await expect(fbar(page).getByTestId("tab-home").locator(".tile")).toHaveAttribute("data-ring", "true");
  await expect(page.getByTestId("busy-status")).toHaveText("Working");
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await expect(fbar(page).getByTestId("tab-home").locator(".tile")).toHaveAttribute("data-ring", "false");
  await isFolded(page, true);
});

test("at 360 × 740 the folded bar fits with a pick: every target at least 44 px high and 32 px wide, none overlapping", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await rows(page);
  await fold(page);
  await results(page).last().tap();
  await expect(fbar(page).getByTestId("row-actions").getByRole("button")).toHaveCount(2);
  const boxes = await fbar(page).locator("button").evaluateAll((els) => els.map((e) => {
    const r = e.getBoundingClientRect();
    return { id: (e as HTMLElement).dataset["testid"] ?? e.textContent ?? "", x: r.x, y: r.y, width: r.width, height: r.height };
  }).filter((b, i) => b.width > 0 && (els[i] as HTMLElement).checkVisibility({ visibilityProperty: true })).sort((a, b) => a.x - b.x));
  expect(boxes.length).toBe(6); // ⌃, Home, slot 2, Store ▶, Copy ›, ☰
  const items = await fbar(page).locator("[data-item]").evaluateAll((els) =>
    els.filter((e) => (e as HTMLElement).checkVisibility({ visibilityProperty: true })).map((e) => ({ n: (e as HTMLElement).dataset["item"], r: e.getBoundingClientRect() })).filter((e) => e.r.width > 0).sort((a, b) => a.r.x - b.r.x).map((e) => e.n));
  expect(items).toEqual(["unfold", "home", "slot", "store", "copy", "menu"]); // the lock's folded-bar: (barItems.ts FOLDED_BAR_ITEMS)
  for (const b of boxes) {
    expect(b.height, b.id).toBeGreaterThanOrEqual(44);
    expect(b.width, b.id).toBeGreaterThanOrEqual(32);
    expect(b.x, b.id).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width, b.id).toBeLessThanOrEqual(360.5);
  }
  for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.x, boxes[i]!.id).toBeGreaterThanOrEqual(boxes[i - 1]!.x + boxes[i - 1]!.width - 0.5);
  await expect(fbar(page).getByTestId("tab-slot").locator(".nm")).toBeVisible(); // R782: each pill is its glyph and a short name
  await expect(fbar(page).getByTestId("tab-home").locator(".nm")).toBeVisible();
  const screen = await page.evaluate(() => document.querySelector(".screen")?.getBoundingClientRect().height ?? 0);
  console.log(`folded history height at 360 × 740: ${screen}`);
});

/** The data-item of the focused control (or its test id). */
const focused = (p: Page): Promise<string> =>
  p.evaluate(() => {
    const e = document.activeElement as HTMLElement | null;
    return e?.dataset["item"] ?? e?.dataset["testid"] ?? e?.tagName ?? "";
  });
/** Tab from the line until ⌃ has the focus (at most 40 presses). */
async function tabToUnfold(p: Page): Promise<void> {
  for (let i = 0; i < 40 && (await focused(p)) !== "unfold"; i++) await p.keyboard.press("Tab");
  expect(await focused(p)).toBe("unfold");
}

test("a drag up that unfolds leaves no stale drag: Alt+K folds, Tab to ⌃, Enter unfolds", async ({ page }) => {
  await rows(page);
  await fold(page);
  await results(page).last().tap();
  const f = await touch(page, `${FBAR} [data-testid="row-actions"] button:last-child`);
  await f.move(0, -30, 4);
  await isFolded(page, false);
  await f.end(); // a moved touch: no click follows
  await page.waitForTimeout(100);
  await page.evaluate(() => window.n62.entry.focus());
  await page.keyboard.press("Alt+KeyK");
  await isFolded(page, true);
  await tabToUnfold(page);
  await page.keyboard.press("Enter"); // a click with no pointerdown before it
  await isFolded(page, false);
});

test("Tab walks the folded bar with a pick in its pinned order: ⌃, Home, slot 2, Store ▶, Copy ›, ☰", async ({ page }) => {
  await rows(page);
  await fold(page);
  await results(page).last().tap();
  await expect(fbar(page).getByTestId("row-actions").getByRole("button")).toHaveCount(2);
  await page.evaluate(() => window.n62.entry.focus());
  await tabToUnfold(page);
  const walk = ["unfold"];
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Tab");
    walk.push(await focused(page));
  }
  expect(walk).toEqual(["unfold", "home", "slot", "store", "copy", "menu"]);
});
