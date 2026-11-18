// SPDX-License-Identifier: GPL-3.0-or-later
// R724 (decisions.md P16; owner 2026-11-17): ⌄ on the entry field's lower-left corner folds by a tap, and folded the bar
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
/** ⌄'s 20 px icon box, centred on its icon. */
async function iconBox(p: Page): Promise<Box> {
  const i = await box(p, `${CHEV} svg`);
  const cx = i.x + i.width / 2, cy = i.y + i.height / 2;
  return { x: cx - 10, y: cy - 10, width: 20, height: 20 };
}
/** The glyph boxes of the entry field (MathLive's shadow root: the leaf spans with text). */
const glyphs = (p: Page): Promise<Box[]> =>
  p.evaluate(() => {
    const root = document.querySelector('[data-testid="entry"] math-field')?.shadowRoot;
    const out: { x: number; y: number; width: number; height: number }[] = [];
    for (const el of root?.querySelectorAll(".ML__content span") ?? []) {
      if (el.childElementCount > 0 || !(el.textContent ?? "").trim()) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) out.push({ x: r.x, y: r.y, width: r.width, height: r.height });
    }
    return out;
  });
const meets = (a: Box, b: Box): boolean => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test.beforeEach(async ({ page }) => {
  await open(page);
  await expect(keys(page)).toHaveAttribute("data-fold-ready", "true");
});

test("⌄ sits on the field's lower-left corner in Home and CAS: 48 × 48 inside the entry row, named, a tap folds and counts fold.tap", async ({ page }) => {
  for (const view of ["home", "cas"]) {
    if (view === "cas") await page.getByTestId("tab-cas").tap();
    await expect.poll(() => page.evaluate(() => window.n62.session.view)).toBe(view);
    const chev = page.locator(CHEV);
    await expect(chev).toHaveAccessibleName("Fold the keys");
    const [b, field, row, bar] = await Promise.all([box(page, CHEV), box(page, `${LINE} math-field`), box(page, LINE), box(page, '[data-testid="bar"]')]);
    expect(Math.round(b.width)).toBe(48);
    expect(Math.round(b.height)).toBe(48);
    const i = await iconBox(page);
    expect(Math.abs(i.x + 10 - field.x)).toBeLessThanOrEqual(4); // the icon's centre on the corner
    expect(Math.abs(i.y + 10 - (field.y + field.height))).toBeLessThanOrEqual(4);
    expect(b.y + b.height).toBeLessThanOrEqual(row.y + row.height + 0.5); // the touch box stays in the entry row
    expect(b.y + b.height).toBeLessThanOrEqual(bar.y + 0.5); // and never reaches the bar
    await chev.tap();
    await isFolded(page, true);
    await expect(chev).toHaveCount(0); // hidden while folded
    await page.getByTestId("fold-slice").tap();
    await isFolded(page, false);
  }
  await expect.poll(async () => (await counts(page))["fold.tap"]).toBe(2);
});

test("⌄ is absent in Function and in the wide layout", async ({ page }) => {
  await expect(page.locator(CHEV)).toHaveCount(1);
  await tap(page, ["@symb"]);
  await page.waitForFunction(() => window.n62.shell.app === "function" && window.n62.shell.loading === null);
  await expect(page.locator(CHEV)).toHaveCount(0);
  await page.setViewportSize({ width: 1340, height: 800 });
  await open(page);
  await expect(keys(page)).toHaveAttribute("data-fold-ready", "true");
  await expect(page.locator(LINE)).toBeVisible();
  await expect(page.locator(CHEV)).toHaveCount(0);
});

test("folded at 412 × 815: one 44 px row at the bottom holds ⌃, Home, CAS, the slot and ☰; no separate slice; the screen is 771 px", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 815 });
  await fold(page);
  const b = await box(page, FBAR);
  expect(b.height).toBe(44);
  expect(b.y + b.height).toBe(815);
  for (const id of ["fold-slice", "tab-home", "tab-cas", "mod-slot", "menu-button"]) await expect(fbar(page).getByTestId(id)).toBeVisible();
  await expect(page.locator('[data-testid="bar"]')).toHaveCount(1); // one bar: the folded row's
  await expect(fbar(page).getByTestId("bar")).toHaveCount(1);
  for (const id of ["chip-angle", "chip-format", "chip-digits", "place"]) await expect(fbar(page).getByTestId(id)).toBeHidden(); // no chips, no Apps ▾
  expect((await box(page, ".keys")).height).toBe(44);
  const screen = await page.evaluate(() => document.querySelector(".screen")?.getBoundingClientRect().height ?? 0);
  console.log(`folded history height at 412 × 815: ${screen}`);
  expect(screen).toBe(771);
  const s = await box(page, '[data-testid="fold-slice"]');
  expect(s.x).toBeLessThan(b.x + 24); // ⌃ in ⌄'s spot, on the left
});

test("☰ while folded opens Home's seven rows with the keys still down", async ({ page }) => {
  await rows(page);
  await fold(page);
  await fbar(page).getByTestId("menu-button").tap();
  await expect(sheet(page).getByRole("menuitem")).toHaveCount(7);
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
  await page.evaluate(() => window.n62.session.unlock());
  await expect(fbar(page).getByTestId("mod-shift")).toHaveCount(0);
  await page.keyboard.type("2");
  await page.keyboard.press("Enter");
  await expect(fbar(page).getByTestId("tab-home").locator(".tile")).toHaveAttribute("data-ring", "true");
  await expect(page.getByTestId("busy-status")).toHaveText("Working");
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await expect(fbar(page).getByTestId("tab-home").locator(".tile")).toHaveAttribute("data-ring", "false");
  await isFolded(page, true);
});

test("no glyph of the field meets ⌄'s icon: a long line scrolled to its start, and a two-line fraction", async ({ page }) => {
  await page.evaluate(() => {
    const f = window.n62.entry.field;
    if (f) f.value = "1234567890".repeat(6);
    f?.executeCommand("moveToMathfieldStart");
  });
  await page.waitForTimeout(100);
  let icon = await iconBox(page);
  let g = await glyphs(page);
  expect(g.length).toBeGreaterThan(10);
  expect(g.filter((b) => meets(b, icon))).toEqual([]);
  // ⌄'s touch box takes no tap on the text: the first glyph's lower part is the line's
  const first = g.reduce((a, b) => (b.x < a.x ? b : a));
  const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.closest('[data-testid="fold-chevron"]') !== null, [first.x + first.width / 2, first.y + first.height * 0.8]);
  expect(hit).toBe(false);
  await page.evaluate(() => {
    const f = window.n62.entry.field;
    if (f) f.value = "\\frac{12345}{67890}";
    f?.executeCommand("moveToMathfieldStart");
  });
  await page.waitForTimeout(100);
  icon = await iconBox(page);
  g = await glyphs(page);
  expect(g.length).toBeGreaterThanOrEqual(10);
  expect(g.filter((b) => meets(b, icon))).toEqual([]);
  const left = Math.min(...g.map((b) => b.x));
  expect(left).toBeGreaterThanOrEqual(icon.x + icon.width); // every line starts right of the icon
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
  }).filter((b) => b.width > 0).sort((a, b) => a.x - b.x));
  expect(boxes.length).toBe(6); // ⌃, Home, CAS, Store ▶, Copy ›, ☰
  const items = await fbar(page).locator("[data-item]").evaluateAll((els) =>
    els.map((e) => ({ n: (e as HTMLElement).dataset["item"], r: e.getBoundingClientRect() })).filter((e) => e.r.width > 0).sort((a, b) => a.r.x - b.r.x).map((e) => e.n));
  expect(items).toEqual(["unfold", "home", "cas", "store", "copy", "menu"]); // the lock's folded-bar: (barItems.ts FOLDED_BAR_ITEMS)
  for (const b of boxes) {
    expect(b.height, b.id).toBeGreaterThanOrEqual(44);
    expect(b.width, b.id).toBeGreaterThanOrEqual(32);
    expect(b.x, b.id).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width, b.id).toBeLessThanOrEqual(360.5);
  }
  for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.x, boxes[i]!.id).toBeGreaterThanOrEqual(boxes[i - 1]!.x + boxes[i - 1]!.width - 0.5);
  await expect(fbar(page).getByTestId("tab-cas").locator(".nm")).toBeHidden(); // the other tab: its glyph only
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

test("Tab walks the folded bar with a pick in its pinned order: ⌃, Home, CAS, Store ▶, Copy ›, ☰", async ({ page }) => {
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
  expect(walk).toEqual(["unfold", "home", "cas", "store", "copy", "menu"]);
});
