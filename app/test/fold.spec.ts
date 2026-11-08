// SPDX-License-Identifier: GPL-3.0-or-later
// R53 (decisions.md P16, owner 2026-11-06): results mode. The handle on the keypad's top edge, or a swipe down on the
// entry line, folds the keypad into a 44 px slice, and the history gets the screen; the slice, a swipe up, Android back
// and Esc bring it back. By touch (synthetic touches through CDP, helpers.ts `touch`) and by keys. The fake engine.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, sheet, tap, touch, useClipboardLock } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
useClipboardLock(); // Copy writes the clipboard: first hook, so the lock is held before the page opens

const HANDLE = '[data-testid="fold-handle"]';
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
const clearLine = (p: Page): Promise<void> => p.evaluate(() => window.n62.entry.clear());
/** n finished Home rows (the fake engine echoes): 1, 2, … */
async function rows(p: Page, n = 3): Promise<void> {
  for (let i = 1; i <= n; i++) await tap(p, [`d${i}`, "enter"]);
  await expect(p.locator('[data-status="done"]')).toHaveCount(n);
}

test.beforeEach(async ({ page }) => {
  await open(page);
  await page.locator(HANDLE).waitFor(); // the controls' chunk is in (loaded when idle after the start)
});

test("the handle: a 48 × 24 px button on the keypad's top edge over no key; a tap folds to the 44 px slice, a tap on the slice brings the keys back", async ({ page }) => {
  const h = await box(page, HANDLE);
  expect(h.width).toBeGreaterThanOrEqual(48);
  expect(h.height).toBeGreaterThanOrEqual(24);
  await expect(page.locator(HANDLE)).toHaveAccessibleName("Show history");
  // no key's hit area shrinks: no point of any key's box (a 2 px grid) is the handle's
  const lost = await page.evaluate(() => {
    const handle = document.querySelector('[data-testid="fold-handle"]');
    return [...document.querySelectorAll<HTMLElement>("[data-key]")].filter((k) => {
      const r = k.getBoundingClientRect();
      for (let y = r.top; y < r.bottom; y += 2) for (let x = r.left; x < r.right; x += 2) if (handle?.contains(document.elementFromPoint(x, y))) return true;
      return false;
    }).map((k) => k.dataset["key"]);
  });
  expect(lost).toEqual([]);
  const up = await screenHeight(page);
  await page.locator(HANDLE).tap();
  await isFolded(page, true);
  expect((await box(page, ".keys")).height).toBe(44);
  await expect(page.locator(SLICE)).toHaveAccessibleName("Show keypad");
  await expect(page.locator(SLICE)).toHaveText("Keys");
  await expect(page.locator(HANDLE)).toHaveCount(0);
  await expect(page.locator('[data-key="d7"]')).toBeHidden(); // the keypad is under the slice, not drawn
  await page.locator(SLICE).tap();
  await isFolded(page, false);
  expect(await screenHeight(page)).toBe(up); // the keys as they were: the viewport has its old share
});

test("a drag of 24 px down on the handle folds, a swipe up on the slice unfolds; a short drag does neither", async ({ page }) => {
  let f = await touch(page, HANDLE);
  await f.move(0, 12, 3);
  await f.cancel(); // a drag that stops short, taken away: nothing
  await isFolded(page, false);
  await swipe(page, HANDLE, 30);
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
  // a sideways drag selects, by the mouse and by a finger (past `touch-action: pan-x` and the swipe's recognizer)
  const collapsed = () => page.evaluate(() => window.n62.entry.field?.selectionIsCollapsed);
  await page.evaluate(() => window.n62.entry.field?.executeCommand("moveToMathfieldEnd"));
  expect(await collapsed()).toBe(true);
  const drag = await touch(page, '[data-testid="entry"] math-field');
  await drag.move(-70, 0, 20);
  await drag.end();
  await expect.poll(collapsed).toBe(false);
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

test("the history's own vertical drag is no fold, and an app draws no handle; CAS has it", async ({ page }) => {
  await rows(page, 2);
  await swipe(page, '[aria-label="History"]', 40);
  await isFolded(page, false);
  await tap(page, ["@cas"]);
  await expect(page.locator(HANDLE)).toHaveCount(1);
  await tap(page, ["@plot"]);
  await page.waitForFunction(() => window.n62.shell.app === "function" && window.n62.shell.loading === null);
  await expect(page.locator(HANDLE)).toHaveCount(0);
});

test("Esc after its own jobs (a sheet level, a pick), Android back, and a reload bring the keys back; the line stays", async ({ page }) => {
  await rows(page);
  await tap(page, ["d7", "d8"]);
  await page.locator(HANDLE).tap();
  await isFolded(page, true);
  await page.keyboard.press("Escape"); // nothing else to do: the keys come back, the line is not cleared
  await isFolded(page, false);
  expect(await entryValue(page)).toBe("78");
  await tap(page, ["esc"]); // the keys are up: Esc clears as before
  expect(await entryValue(page)).toBe("");

  await page.locator(HANDLE).tap();
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

  await page.locator(HANDLE).tap();
  await page.getByTestId("menu-button").tap();
  await page.evaluate(() => history.back()); // Android back: the sheet first
  await expect(sheet(page)).toBeHidden();
  await isFolded(page, true);
  await page.evaluate(() => history.back());
  await isFolded(page, false);

  await page.locator(HANDLE).tap();
  await isFolded(page, true);
  await open(page); // a reload
  await isFolded(page, false);
  await expect(page.locator(HANDLE)).toBeVisible();
});

test("folded: a tap picks, the second inserts and unfolds; Copy and Delete stay down, Recall and Store ▶ unfold; a letter types; ☰ rises over the history", async ({ page }) => {
  await rows(page);
  await page.locator(HANDLE).tap();
  const slice = await box(page, SLICE);
  await results(page).last().tap();
  await expect(picked(page)).toHaveCount(1);
  await expect(bar(page).getByRole("button")).toHaveText(["Insert", "Recall", "Copy", "Store ▶", "Delete"]);
  const b = await box(page, '[data-testid="row-actions"]');
  expect(Math.abs(b.y + b.height - slice.y)).toBeLessThanOrEqual(1); // on the slice's top edge
  await bar(page).getByRole("button", { name: "Copy" }).tap();
  await expect(bar(page)).toHaveCount(0);
  await isFolded(page, true);
  await results(page).last().tap();
  await bar(page).getByRole("button", { name: "Delete" }).tap();
  await expect(page.locator('[data-status="done"]')).toHaveCount(2);
  await isFolded(page, true);
  await results(page).last().tap();
  await results(page).last().tap(); // the second tap inserts
  await isFolded(page, false);
  expect(await entryValue(page)).toMatch(/^\\res/);

  await clearLine(page);
  await page.locator(HANDLE).tap();
  await results(page).first().tap();
  await bar(page).getByRole("button", { name: "Recall" }).tap();
  await isFolded(page, false);
  expect(await entryValue(page)).toBe("1");
  await clearLine(page);
  await page.locator(HANDLE).tap();
  await results(page).first().tap();
  await bar(page).getByRole("button", { name: "Store ▶" }).tap();
  await isFolded(page, false);
  expect(await entryValue(page)).toContain("\\blacktriangleright");

  await clearLine(page);
  await page.locator(HANDLE).tap();
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
  await page.locator(HANDLE).tap();
  await results(page).last().tap();
  await expect(picked(page)).toHaveCount(1);
  await page.keyboard.press("Enter");
  await isFolded(page, false);
  expect(await entryValue(page)).toMatch(/^\\res/);
  await expect.poll(async () => (await counts())["insert"]).toBe(1);

  // the Copy key on a pick: the pad is inert while folded, so its press comes as the pad's own events
  await clearLine(page);
  await page.locator(HANDLE).tap();
  await results(page).last().tap();
  await expect(picked(page)).toHaveCount(1);
  await page.evaluate(() => {
    const k = document.querySelector('[data-key="copy"]');
    for (const type of ["pointerdown", "pointerup"]) k?.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 9, button: 0, pointerType: "touch" }));
  });
  await expect(picked(page)).toHaveCount(0);
  await expect.poll(async () => (await counts())["copy"]).toBe(1);
  await isFolded(page, true);
  await page.locator(SLICE).tap();

  // a row without a result: Enter brings its entry back (1ᴇ2.5 fails to parse)
  await tap(page, ["d1", "emark", "d2", "dot", "d5", "enter"]);
  await expect(page.locator('[data-status="error"]')).toHaveCount(1);
  await page.locator(HANDLE).tap();
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
  await page.locator(HANDLE).tap();
  await page.getByTestId("menu-button").tap();
  await expect(sheet(page)).toBeVisible();
  await page.locator(SLICE).tap();
  await isFolded(page, false);
  await expect(sheet(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toBeHidden();
  await expect.poll(layer).toBeUndefined();
  // a swipe up on the slice with ☰ open (the sheet covers the line), then Android back: the sheet, and the entry under it with it
  await page.locator(HANDLE).tap();
  await page.getByTestId("menu-button").tap();
  await swipe(page, SLICE, -40);
  await isFolded(page, false);
  await page.evaluate(() => history.back());
  await expect(sheet(page)).toBeHidden();
  await expect.poll(layer).toBeUndefined();
  // Insert from the list over the fold: the sheet and the fold close in one update
  await page.locator(HANDLE).tap();
  await page.getByTestId("menu-button").tap();
  await sheet(page).locator('[data-id="insert"]').tap();
  await isFolded(page, false);
  await expect.poll(layer).toBeUndefined();
  // the count is even: a new fold takes one entry, and back closes it
  await clearLine(page);
  await page.locator(HANDLE).tap();
  await expect.poll(layer).toBe(0);
  await page.evaluate(() => history.back());
  await isFolded(page, false);
  await expect.poll(layer).toBeUndefined();
});

test("Tab reaches the handle, and Enter on it folds", async ({ page }) => {
  await page.evaluate(() => window.n62.entry.focus());
  let at = "";
  for (let i = 0; i < 6 && at !== "fold-handle"; i++) {
    await page.keyboard.press("Tab");
    at = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset["testid"] ?? "");
  }
  expect(at).toBe("fold-handle");
  await page.keyboard.press("Enter");
  await isFolded(page, true);
  // the focused button is gone: focus went back to the line, so a hardware letter types while folded
  await expect.poll(() => inLine(page)).toBe(true);
  await page.keyboard.press("x");
  await expect.poll(() => entryValue(page)).toContain("x");
  await isFolded(page, true);
  // Enter on the slice unfolds and typing goes on
  await page.locator(SLICE).focus();
  await page.keyboard.press("Enter");
  await isFolded(page, false);
  await expect.poll(() => inLine(page)).toBe(true);
  await page.keyboard.press("y");
  await expect.poll(() => entryValue(page)).toContain("xy");
  // folded again by Enter on the handle, Esc is heard and brings the keys back
  await page.locator(HANDLE).focus();
  await page.keyboard.press("Enter");
  await isFolded(page, true);
  await expect.poll(() => inLine(page)).toBe(true);
  await page.keyboard.press("Escape");
  await isFolded(page, false);
});

for (const [width, height] of [[412, 839], [360, 740]] as const) {
  test(`the folded share of the viewport is at least 0.9 at ${width} × ${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.locator(HANDLE).tap();
    await isFolded(page, true);
    const share = (await screenHeight(page)) / height;
    console.log(`folded viewport share at ${width} × ${height}: ${share.toFixed(4)}`);
    expect(share).toBeGreaterThanOrEqual(0.9);
  });
}

test("every counter counts (uses: folds by the handle and by a swipe, picks, each action while folded), and Counters shows them", async ({ page }) => {
  await rows(page, 4);
  const act = async (name: string): Promise<void> => {
    await page.locator(HANDLE).tap();
    await results(page).first().tap();
    await bar(page).getByRole("button", { name }).tap();
    if (name === "Copy" || name === "Delete") await page.locator(SLICE).tap(); // these leave the keys down
    else await clearLine(page);
  };
  for (const name of ["Insert", "Recall", "Copy", "Store ▶", "Delete"]) await act(name); // 5 folds by the handle, 5 picks
  await isFolded(page, false);
  await swipe(page, LINE, 40);
  await isFolded(page, true);
  await results(page).first().tap();
  await expect(picked(page)).toHaveCount(1);
  await results(page).first().tap(); // the second tap: insert
  await isFolded(page, false);
  const counts = await page.evaluate(async () => ({ ...(await window.n62.session.uses()).state.counts }));
  expect(counts).toEqual({ "fold.handle": 5, "fold.swipe": 1, pick: 6, insert: 2, recall: 1, copy: 1, store: 1, delete: 1 });
  // the keys up: a tap picks and its actions run, uncounted
  await clearLine(page);
  await results(page).first().tap();
  await bar(page).getByRole("button", { name: "Copy" }).tap();
  expect(await page.evaluate(async () => (await window.n62.session.uses()).state.counts["copy"])).toBe(1);

  await tap(page, ["@mode", "d6"]); // Mode › Settings
  await sheet(page).locator('[data-id="counters"]').tap();
  const row = sheet(page).locator('[data-id="uses"]');
  await expect(row).toContainText("Results mode");
  await expect(row).toContainText("6 folds");
  await row.tap();
  await expect(page.getByTestId("sheet-title")).toContainText("Results mode");
  await expect(sheet(page).locator('[data-id="actions"]')).toContainText("6");
  await expect(sheet(page).locator('[data-id="pick"]')).toContainText("6");
});

test("the long press's list and ☰ count each action once, as the row buttons do", async ({ page }) => {
  await rows(page, 4);
  const longPress = async (id: string): Promise<void> => {
    await page.locator(HANDLE).tap();
    const f = await touch(page, '[data-testid="result"] .result[data-text="1"]');
    await page.waitForTimeout(700); // past the long press
    await f.end();
    await sheet(page).locator(`[data-id="${id}"]`).tap();
    await expect(sheet(page)).toBeHidden();
  };
  await longPress("copy");
  await isFolded(page, true);
  await page.locator(SLICE).tap();
  await longPress("insert");
  await isFolded(page, false);
  await clearLine(page);
  await longPress("recall");
  await isFolded(page, false);
  await clearLine(page);
  await longPress("store");
  await isFolded(page, false);
  await clearLine(page);
  await longPress("delete");
  await expect(page.locator('[data-status="done"]')).toHaveCount(3);
  await page.locator(SLICE).tap();
  await page.locator(HANDLE).tap(); // ☰ with no row: the same list, on the last result
  await page.getByTestId("menu-button").tap();
  await sheet(page).locator('[data-id="copy"]').tap();
  await expect(sheet(page)).toBeHidden();
  const counts = await page.evaluate(async () => ({ ...(await window.n62.session.uses()).state.counts }));
  expect(counts).toEqual({ "fold.handle": 6, insert: 1, recall: 1, copy: 2, store: 1, delete: 1 });
});
