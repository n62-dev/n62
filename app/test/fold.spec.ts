// SPDX-License-Identifier: GPL-3.0-or-later
// R53 (decisions.md P16, owner 2026-11-06), R283: results mode. A swipe down on the entry line (the only way to fold:
// the handle on the keypad's top edge is gone) folds the keypad into a 44 px slice, and the history gets the screen; the
// slice, a swipe up, Android back and Esc bring it back. By touch (synthetic touches through CDP, helpers.ts `touch`) and by keys. The fake engine.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, sheet, tap, touch, useClipboardLock } from "./helpers.ts";
import { finger, STILL_MS } from "./core-lib.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
useClipboardLock(); // Copy writes the clipboard: first hook, so the lock is held before the page opens

const HANDLE = '[data-testid="fold-handle"]'; // R283: it is no longer drawn; one test asserts that
const SLICE = '[data-testid="fold-slice"]';
const LINE = '[data-testid="entry"]';
const keys = (p: Page) => p.getByTestId("keys");
const isFolded = (p: Page, on: boolean) => expect(keys(p)).toHaveAttribute("data-folded", String(on));
const results = (p: Page) => p.locator('[data-testid="result"] .result');
const bar = (p: Page) => p.getByTestId("row-actions");
const picked = (p: Page) => p.locator('[data-selected="true"]');
const box = async (p: Page, sel: string) => {
  const b = await p.locator(sel).first().boundingBox();
  if (!b) throw new Error(`${sel} is not visible`);
  return b;
};
const screenHeight = (p: Page) => p.evaluate(() => document.querySelector(".screen")?.getBoundingClientRect().height ?? 0);
const inLine = (p: Page): Promise<boolean> => p.evaluate(() => document.activeElement?.tagName === "MATH-FIELD");
const selection = (p: Page) => p.evaluate(() => JSON.stringify(window.n62.entry.field?.selection.ranges));
async function swipe(p: Page, sel: string, dy: number): Promise<void> {
  const f = await touch(p, sel);
  await f.move(0, dy, 4);
  await f.end();
}
/** Fold by the entry line's swipe (R283). */
const fold = async (p: Page): Promise<void> => {
  await swipe(p, LINE, 40);
  await isFolded(p, true);
};
const clearLine = (p: Page): Promise<void> => p.evaluate(() => window.n62.entry.clear());
/** R276: a hold on the last result (it copies) and a swipe of the last row (it deletes). */
const holdLast = (p: Page): Promise<void> => finger(p, "result:last", { ms: 700 });
async function swipeLast(p: Page): Promise<void> {
  const w = (await box(p, "article.item:last-of-type")).width;
  const n = await p.locator("article.item").count();
  await finger(p, "row:last", { dx: -0.6 * w, steps: 10, still: STILL_MS }); // lifted at rest: no fling to eat the next tap
  await expect(p.locator("article.item")).toHaveCount(n - 1); // (it slides out, then goes)
}
/** n finished Home rows (the fake engine echoes): 1, 2, … */
async function rows(p: Page, n = 3): Promise<void> {
  for (let i = 1; i <= n; i++) await tap(p, [`d${i}`, "enter"]);
  await expect(p.locator('[data-status="done"]')).toHaveCount(n);
}

test.beforeEach(async ({ page }) => {
  await open(page);
  await expect(keys(page)).toHaveAttribute("data-fold-ready", "true"); // the controls' chunk is in (loaded when idle after the start)
});

test("no handle is drawn; a swipe down on the line folds to the 44 px slice, a tap on the slice brings the keys back", async ({ page }) => {
  await expect(page.locator(HANDLE)).toHaveCount(0);
  const up = await screenHeight(page);
  await fold(page);
  expect((await box(page, ".keys")).height).toBe(44);
  await expect(page.locator(SLICE)).toHaveAccessibleName("Show keypad");
  await expect(page.locator(SLICE)).toHaveText("Keys");
  await expect(page.locator(HANDLE)).toHaveCount(0);
  await expect(page.locator('[data-key="d7"]')).toBeHidden(); // the keypad is under the slice, not drawn
  await page.locator(SLICE).tap();
  await isFolded(page, false);
  expect(await screenHeight(page)).toBe(up); // the keys as they were: the viewport has its old share
});

test("the keypad's top edge folds nothing: a tap where the handle was is the entry line's, the Up key is the key's", async ({ page }) => {
  const [pad, up] = await Promise.all([box(page, ".pad"), box(page, '[data-key="up"]')]);
  const x = up.x + up.width / 2;
  await page.touchscreen.tap(x, pad.y - 6); // the gap above the pad, where the handle lay
  await isFolded(page, false);
  await page.touchscreen.tap(x, up.y + 2); // the top of the Up key: it presses
  await isFolded(page, false);
  await expect(page.locator(HANDLE)).toHaveCount(0);
});

test("a drag up on the slice unfolds at once; a short drag does not", async ({ page }) => {
  await fold(page);
  let f = await touch(page, SLICE);
  await f.move(0, -12, 3);
  await f.cancel(); // a drag that stops short, taken away: nothing
  await isFolded(page, true);
  f = await touch(page, SLICE);
  await f.move(0, -30, 4);
  await isFolded(page, false); // at once, before the lift
  await f.end();
});

test("a swipe down on the line folds and leaves its text, caret and selection; a sideways drag and a tap stay the line's", async ({ page }) => {
  await tap(page, ["d1", "d2", "d3", "d4", "d5", "d6"]);
  await page.evaluate(() => {
    const f = window.n62.entry.field;
    if (f) f.selection = { ranges: [[1, 3]], direction: "forward" };
  });
  const sel = await selection(page);
  expect(sel).toBe("[[1,3]]");
  await swipe(page, LINE, 40);
  await isFolded(page, true);
  expect(await entryValue(page)).toBe("123456");
  expect(await selection(page)).toBe(sel);
  await swipe(page, LINE, 40); // folded: down again is the line's, nothing changes
  await isFolded(page, true);
  await swipe(page, LINE, -40); // up on the line unfolds
  await isFolded(page, false);
  expect(await selection(page)).toBe(sel);
  expect(await entryValue(page)).toBe("123456");

  // a slow or sideways drag is no swipe
  const f = await touch(page, LINE);
  await f.move(-60, 0, 6);
  await f.move(-60, 30, 3);
  await f.end();
  await isFolded(page, false);
  // a sideways drag by a finger reaches the line (past `touch-action: pan-x` and the swipe's recognizer) and selects
  // nothing (R277: it scrolls a long line, linetouch.spec.ts); by the mouse it selects
  const collapsed = () => page.evaluate(() => window.n62.entry.field?.selectionIsCollapsed);
  await page.evaluate(() => window.n62.entry.field?.executeCommand("moveToMathfieldEnd"));
  expect(await collapsed()).toBe(true);
  const drag = await touch(page, '[data-testid="entry"] math-field');
  await drag.move(-70, 0, 20);
  await drag.end();
  await page.waitForTimeout(100);
  expect(await collapsed()).toBe(true);
  expect(await page.evaluate(() => window.n62.entry.field?.position)).toBe(6);
  await isFolded(page, false);
  await page.evaluate(() => window.n62.entry.field?.executeCommand("moveToMathfieldEnd"));
  expect(await collapsed()).toBe(true);
  const l = await box(page, "math-field");
  await page.mouse.move(l.x + l.width / 2, l.y + l.height / 2);
  await page.mouse.down();
  await page.mouse.move(l.x + 14, l.y + l.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(collapsed).toBe(false);
  await isFolded(page, false);
  // a tap places the caret: at the line's left end it goes before the first digit
  await page.evaluate(() => window.n62.entry.field?.executeCommand("moveToMathfieldEnd"));
  await page.touchscreen.tap(l.x + 14, l.y + l.height / 2);
  await expect.poll(() => page.evaluate(() => window.n62.entry.field?.position ?? -1)).toBeLessThan(6);
  await isFolded(page, false);
});

test("the history's own vertical drag is no fold, and an app has no results mode", async ({ page }) => {
  await rows(page, 2);
  await swipe(page, '[aria-label="History"]', 40);
  await isFolded(page, false);
  await tap(page, ["@cas"]);
  await tap(page, ["@plot"]);
  await page.waitForFunction(() => window.n62.shell.app === "function" && window.n62.shell.loading === null);
  await expect(page.locator(HANDLE)).toHaveCount(0);
});

test("Esc after its own jobs (a sheet level, a pick), Android back, and a reload bring the keys back; the line stays", async ({ page }) => {
  await rows(page);
  await tap(page, ["d7", "d8"]);
  await fold(page);
  await isFolded(page, true);
  await page.keyboard.press("Escape"); // nothing else to do: the keys come back, the line is not cleared
  await isFolded(page, false);
  expect(await entryValue(page)).toBe("78");
  await tap(page, ["esc"]); // the keys are up: Esc clears as before
  expect(await entryValue(page)).toBe("");

  await fold(page);
  await results(page).last().tap(); // a pick
  await expect(picked(page)).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(picked(page)).toHaveCount(0);
  await isFolded(page, true);
  await page.getByTestId("menu-button").tap(); // a sheet
  await expect(sheet(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toBeHidden();
  await isFolded(page, true);
  await page.keyboard.press("Escape");
  await isFolded(page, false);

  await fold(page);
  await page.getByTestId("menu-button").tap();
  await page.evaluate(() => history.back()); // Android back: the sheet first
  await expect(sheet(page)).toBeHidden();
  await isFolded(page, true);
  await page.evaluate(() => history.back());
  await isFolded(page, false);

  await fold(page);
  await isFolded(page, true);
  await open(page); // a reload
  await isFolded(page, false);
  await expect(keys(page)).toHaveAttribute("data-fold-ready", "true");
});

test("folded: a tap picks, the second inserts and unfolds; a hold copies and a swipe deletes with the keys down, a recall and Store ▶ unfold; a letter types; ☰ rises over the history", async ({ page }) => {
  await rows(page);
  await fold(page);
  const slice = await box(page, SLICE);
  await results(page).last().tap();
  await expect(picked(page)).toHaveCount(1);
  await expect(bar(page).getByRole("button")).toHaveText(["Store ▶", "Copy as ›"]);
  const b = await box(page, '[data-testid="row-actions"]');
  expect(Math.abs(b.y + b.height - slice.y)).toBeLessThanOrEqual(1); // on the slice's top edge
  await holdLast(page); // on the picked row: it copies, the pick stays
  await expect(page.getByTestId("notice")).toHaveText("Copied");
  await isFolded(page, true);
  await swipeLast(page);
  await expect(page.locator('[data-status="done"]')).toHaveCount(2);
  await expect(bar(page)).toHaveCount(0); // the swipe drops the pick
  await isFolded(page, true);
  await results(page).last().tap();
  await results(page).last().tap(); // the second tap inserts
  await isFolded(page, false);
  expect(await entryValue(page)).toMatch(/^\\res/);

  await clearLine(page);
  await fold(page);
  await page.locator("article.item .in").first().tap();
  await page.locator("article.item .in").first().tap(); // the second tap recalls
  await isFolded(page, false);
  expect(await entryValue(page)).toBe("1");
  await clearLine(page);
  await fold(page);
  await results(page).first().tap();
  await bar(page).getByRole("button", { name: "Store ▶" }).tap();
  await isFolded(page, false);
  expect(await entryValue(page)).toContain("\\blacktriangleright");
  await expect(page.getByTestId("store")).toBeVisible(); // R281: Store ▶ opens the store sheet; Esc closes it
  await tap(page, ["esc"]);

  await clearLine(page);
  await fold(page);
  await page.keyboard.type("x"); // a hardware keyboard types; it needs no keypad
  await isFolded(page, true);
  expect(await entryValue(page)).toBe("x");

  await page.getByTestId("menu-button").tap();
  await expect(sheet(page)).toBeVisible();
  const m = await box(page, '[data-testid="menu"]');
  expect(m.y + m.height).toBeLessThanOrEqual(slice.y + 1); // from the slice's top edge, over the history
  expect(m.y).toBeGreaterThanOrEqual((await box(page, "header")).height);
});

test("by keys: Enter on a pick inserts, or recalls a row without a result, brings the keys back and counts; the Copy key counts and stays down", async ({ page }) => {
  const counts = () => page.evaluate(async () => ({ ...(await window.n62.session.uses()).state.counts }));
  await rows(page);
  await fold(page);
  await results(page).last().tap();
  await expect(picked(page)).toHaveCount(1);
  await page.keyboard.press("Enter");
  await isFolded(page, false);
  expect(await entryValue(page)).toMatch(/^\\res/);
  await expect.poll(async () => (await counts())["insert"]).toBe(1);

  // ☰ → Copy on a pick (R278: the Copy key is gone; the status line's ☰ is on screen while the pad is folded)
  await clearLine(page);
  await fold(page);
  await results(page).last().tap();
  await expect(picked(page)).toHaveCount(1);
  await page.getByTestId("menu-button").tap();
  await sheet(page).locator('[data-id="copy"]').tap();
  await expect(picked(page)).toHaveCount(0);
  await expect.poll(async () => (await counts())["copy"]).toBe(1);
  await isFolded(page, true);
  await page.locator(SLICE).tap();

  // a row without a result: Enter brings its entry back (1ᴇ2.5 fails to parse)
  await tap(page, ["d1", "emark", "d2", "dot", "d5", "enter"]);
  await expect(page.locator('[data-status="error"]')).toHaveCount(1);
  await fold(page);
  await clearLine(page);
  await page.keyboard.press("ArrowUp"); // Up on an empty line picks the newest row
  await expect(picked(page)).toHaveCount(1);
  await page.keyboard.press("Enter");
  await isFolded(page, false);
  expect(await entryValue(page)).not.toBe("");
  await expect.poll(async () => (await counts())["recall"]).toBe(1);
});

test("a layer closed under a sheet leaves no history entry: the slice or its swipe with ☰ open, Android back, Insert from the list", async ({ page }) => {
  const layer = () => page.evaluate(() => (history.state as { n62Layer?: number } | null)?.n62Layer);
  await rows(page);
  // the slice under an open sheet, then Esc
  await fold(page);
  await page.getByTestId("menu-button").tap();
  await expect(sheet(page)).toBeVisible();
  await page.locator(SLICE).tap();
  await isFolded(page, false);
  await expect(sheet(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toBeHidden();
  await expect.poll(layer).toBeUndefined();
  // a swipe up on the slice with ☰ open (the sheet covers the line), then Android back: the sheet, and the entry under it with it
  await fold(page);
  await page.getByTestId("menu-button").tap();
  await swipe(page, SLICE, -40);
  await isFolded(page, false);
  await page.evaluate(() => history.back());
  await expect(sheet(page)).toBeHidden();
  await expect.poll(layer).toBeUndefined();
  // Insert from the list over the fold: the sheet and the fold close in one update
  await fold(page);
  await page.getByTestId("menu-button").tap();
  await sheet(page).locator('[data-id="insert"]').tap();
  await isFolded(page, false);
  await expect.poll(layer).toBeUndefined();
  // the count is even: a new fold takes one entry, and back closes it
  await clearLine(page);
  await fold(page);
  await expect.poll(layer).toBe(0);
  await page.evaluate(() => history.back());
  await isFolded(page, false);
  await expect.poll(layer).toBeUndefined();
});

test("Tab reaches the slice, and Enter on it unfolds; a hardware letter types while folded and Esc brings the keys back", async ({ page }) => {
  await page.evaluate(() => window.n62.entry.focus());
  await fold(page);
  await expect(page.locator(HANDLE)).toHaveCount(0);
  await expect.poll(() => inLine(page)).toBe(true);
  await page.keyboard.press("x");
  await expect.poll(() => entryValue(page)).toContain("x");
  await isFolded(page, true);
  // Tab from the line reaches the slice (the only control the fold has), Enter on it unfolds and typing goes on
  let at = "";
  for (let i = 0; i < 6 && at !== "fold-slice"; i++) {
    await page.keyboard.press("Tab");
    at = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset["testid"] ?? "");
  }
  expect(at).toBe("fold-slice");
  await page.keyboard.press("Enter");
  await isFolded(page, false);
  // the focused button is gone: focus went back to the line, so a hardware letter types
  await expect.poll(() => inLine(page)).toBe(true);
  await page.keyboard.press("y");
  await expect.poll(() => entryValue(page)).toContain("xy");
  // folded again by the swipe, Esc is heard and brings the keys back
  await fold(page);
  await expect.poll(() => inLine(page)).toBe(true);
  await page.keyboard.press("Escape");
  await isFolded(page, false);
});

for (const [width, height] of [[412, 839], [360, 740]] as const) {
  test(`the folded share of the viewport is at least 0.9 at ${width} × ${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await fold(page);
    await isFolded(page, true);
    const share = (await screenHeight(page)) / height;
    console.log(`folded viewport share at ${width} × ${height}: ${share.toFixed(4)}`);
    expect(share).toBeGreaterThanOrEqual(0.9);
  });
}

test("every counter counts (uses: folds by a swipe, picks, each action while folded), and Counters shows them", async ({ page }) => {
  await rows(page, 4);
  const firstIn = page.locator("article.item .in").first();
  // 5 folds, 3 picks: each row action while folded (R276: a second tap, a hold, Store ▶, a swipe)
  await fold(page);
  await results(page).first().tap();
  await results(page).first().tap(); // insert
  await clearLine(page);
  await fold(page);
  await firstIn.tap();
  await firstIn.tap(); // recall
  await clearLine(page);
  await fold(page);
  await holdLast(page); // copy: the keys stay down
  await page.locator(SLICE).tap();
  await fold(page);
  await results(page).first().tap();
  await bar(page).getByRole("button", { name: "Store ▶" }).tap(); // store
  await expect(page.getByTestId("store")).toBeVisible(); // R281: the store sheet; Esc closes it
  await tap(page, ["esc"]);
  await clearLine(page);
  await fold(page);
  await swipeLast(page); // delete: the keys stay down
  await page.locator(SLICE).tap();
  await isFolded(page, false);
  await swipe(page, LINE, 40);
  await isFolded(page, true);
  await results(page).first().tap();
  await expect(picked(page)).toHaveCount(1);
  await results(page).first().tap(); // the second tap: insert
  await isFolded(page, false);
  const counts = await page.evaluate(async () => ({ ...(await window.n62.session.uses()).state.counts }));
  expect(counts).toEqual({ "fold.swipe": 6, pick: 4, insert: 2, recall: 1, copy: 1, store: 1, delete: 1 });
  // the keys up: a hold copies, uncounted
  await clearLine(page);
  await holdLast(page);
  await expect(page.getByTestId("notice")).toHaveText("Copied");
  expect(await page.evaluate(async () => (await window.n62.session.uses()).state.counts["copy"])).toBe(1);

  await tap(page, ["@mode", "d6"]); // Mode › Settings
  await sheet(page).locator('[data-id="counters"]').tap();
  const row = sheet(page).locator('[data-id="uses"]');
  await expect(row).toContainText("Results mode");
  await expect(row).toContainText("6 folds");
  await row.tap();
  await expect(page.getByTestId("sheet-title")).toContainText("Results mode");
  await expect(sheet(page).locator('[data-id="actions"]')).toContainText("6");
  await expect(sheet(page).locator('[data-id="pick"]')).toContainText("4");
  await expect(sheet(page).locator('[data-id="handle"]')).toHaveCount(0); // R283: no row for the handle
});

test("a hold, a swipe and ☰'s list each count their action once while folded (R276)", async ({ page }) => {
  await rows(page, 4);
  await fold(page);
  await holdLast(page);
  await expect(page.getByTestId("notice")).toHaveText("Copied");
  await swipeLast(page);
  await expect(page.locator('[data-status="done"]')).toHaveCount(3);
  await page.getByTestId("menu-button").tap(); // ☰ with no row: the list, on the last result
  await sheet(page).locator('[data-id="copy"]').tap();
  await expect(sheet(page)).toBeHidden();
  const counts = await page.evaluate(async () => ({ ...(await window.n62.session.uses()).state.counts }));
  expect(counts).toEqual({ "fold.swipe": 1, copy: 2, delete: 1 });
});
