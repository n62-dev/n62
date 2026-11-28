// SPDX-License-Identifier: GPL-3.0-or-later
// R815 (owner, 2026-11-20 walk point C6, and 2026-11-23 hunt h2 #8): in Memory a tap, Enter or a hold on a name's row copies the
// name's full value (as the history's Full value copies a result: 1/3 gives 40 digits, a list `{1,2}`, a name stored from the unit view
// `v ± σ unit`) and the name stays; the Copy key (Shift + Select) copies the highlighted row the same way. A hold copies in every
// sheet: a Vars row (its tap still inserts the name, the sheet stays open on a hold) and a constant's row in Find. The delete has its
// swipe (R813) and Shift + ⌫ (R814). The real engine; expected values derived: 1/3 = 0.333… (40 digits), A = 7.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { entryValue, flick, KEYCOPY, open, setClipboard, tap } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

const find = (page: Page) => page.getByTestId("find");
const row = (page: Page, id: string) => find(page).locator(`[role="menuitem"][data-id="${id}"]`);
const names = (page: Page) => page.evaluate(() => window.n62.session.userNames.map((u) => u.name).sort());
const clipboard = (page: Page): Promise<string> => page.evaluate(() => navigator.clipboard.readText());
const done = (page: Page, n: number) => expect(page.locator('[data-status="done"]')).toHaveCount(n);
const THIRD = "0." + "3".repeat(40);

async function start(page: Page): Promise<void> {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
}
/** `tokens ▶ name`: Shift + the exponent key is Sto▶; Alpha + Vars is A, Alpha + Tmpl is C. */
async function store(page: Page, tokens: string[], letterKey: "vars" | "tmpl", count: number): Promise<void> {
  await tap(page, [...tokens, "shift", "emark", "alpha", letterKey, "enter"]);
  await done(page, count);
}
/** A mouse held 900 ms on the middle of `target` (the sheet's rows take the press, not a finger's tap). */
async function hold(page: Page, target: Locator): Promise<void> {
  const box = await target.boundingBox();
  if (!box) throw new Error("not visible");
  await page.mouse.move(box.x + Math.min(box.width / 2, 30), box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(900);
  await page.mouse.up();
}
/** The gestures' chunk is in (the history's rows carry the swipe strip once it is). */
const gestures = (page: Page) => expect(page.locator('[data-testid="swipe-del"]').first()).toBeAttached({ timeout: 15_000 });

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.emulateMedia({ reducedMotion: "reduce" });
});

/** 1/3 stored in A, Memory open, the clipboard holding a sentinel. */
async function third(page: Page): Promise<void> {
  await start(page);
  await store(page, ["d1", "div", "d3", "right"], "vars", 1);
  await gestures(page);
  await setClipboard(page, "sentinel");
  await tap(page, ["shift", "math"]);
  await expect(row(page, "var:A")).toBeVisible();
}

test.describe("Memory copies", () => {
  test("a tap on A copies the 40-digit value and A stays stored", async ({ page }) => {
    await third(page);
    await row(page, "var:A").tap();
    await expect.poll(() => clipboard(page)).toBe(THIRD);
    await expect(page.getByTestId("notice")).toContainText("Copied 40 digits: 0.333 333 333 333…");
    await expect(row(page, "var:A")).toBeVisible();
    await expect(row(page, "undo")).toHaveCount(0);
    expect(await names(page)).toEqual(["A"]);
  });

  test("Enter on the highlighted A copies the same and A stays stored", async ({ page }) => {
    await third(page);
    await tap(page, ["enter"]);
    await expect.poll(() => clipboard(page)).toBe(THIRD);
    await expect(find(page)).toBeVisible();
    expect(await names(page)).toEqual(["A"]);
  });

  test("a hold on A copies the same and A stays stored", async ({ page }) => {
    await third(page);
    await hold(page, row(page, "var:A"));
    await expect.poll(() => clipboard(page)).toBe(THIRD);
    await expect(find(page)).toBeVisible();
    expect(await names(page)).toEqual(["A"]);
  });

  test("the Copy key (Shift + Select) copies the highlighted row; a dead press on Clear all", async ({ page }) => {
    await start(page);
    await store(page, ["d1", "div", "d3", "right"], "vars", 1);
    await store(page, ["d7"], "tmpl", 2);
    await setClipboard(page, "sentinel");
    await tap(page, ["shift", "math"]);
    await expect(row(page, "var:C")).toHaveAttribute("data-active", "true"); // the newest first
    await tap(page, KEYCOPY);
    await expect.poll(() => clipboard(page)).toBe("7");
    await tap(page, ["down", ...KEYCOPY]);
    await expect.poll(() => clipboard(page)).toBe(THIRD);
    await setClipboard(page, "sentinel");
    await tap(page, ["down", ...KEYCOPY]); // Clear all: nothing to copy
    expect(await clipboard(page)).toBe("sentinel");
    await expect(find(page)).toBeVisible();
    expect(await names(page)).toEqual(["A", "C"]);
  });

  test("a list {1,2} copies as {1,2}", async ({ page }) => {
    await start(page);
    await store(page, ["shift", "d8", "d1", "comma", "d2", "right"], "tmpl", 1);
    await setClipboard(page, "sentinel");
    await tap(page, ["shift", "math"]);
    await row(page, "var:C").tap();
    await expect.poll(() => clipboard(page)).toBe("{1,2}");
    expect(await names(page)).toEqual(["C"]);
  });

  test("a name stored from the unit view copies as `v ± σ unit`, as its history row does", async ({ page }) => {
    await start(page);
    await tap(page, ["d9", "dot", "d8", "d1", "shift", "comma", "d0", "dot", "d0", "d1"]);
    await flick(page, "tmpl", "up");
    await page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element && document.querySelector('[data-pad="unit"]') !== null);
    await tap(page, ["d9", "div", "d3", "sq"]); // m ÷ s²
    await flick(page, "enter", "up");
    await expect(page.getByTestId("unit-result").locator(".value")).toHaveText("9.810 ± 0.010");
    await tap(page, ["shift", "emark"]);
    await page.getByTestId("store").locator('[data-id="name:G"]').tap();
    await expect(page.getByTestId("store")).toBeHidden();
    await expect.poll(() => names(page)).toEqual(["G"]);
    await gestures(page);
    // what a hold on the unit row's result copies (the history's Full value), then what Memory copies
    await hold(page, page.locator('[data-status="done"]').first().locator("button.result"));
    await expect.poll(() => clipboard(page)).toBe("9.81 ± 0.010 m/s²");
    const history = await clipboard(page);
    await setClipboard(page, "sentinel");
    await tap(page, ["shift", "math"]);
    await row(page, "var:G").tap();
    await expect.poll(() => clipboard(page)).toBe(history);
  });

  test("controls: a swipe still deletes (R813), Shift + ⌫ too (R814); a tap on Clear all arms it, a second clears", async ({ page }) => {
    await start(page);
    await store(page, ["d5"], "vars", 1);
    await store(page, ["d7"], "tmpl", 2);
    await tap(page, ["shift", "math"]);
    await tap(page, ["shift", "bksp"]); // C, the newest
    await expect(row(page, "var:C")).toHaveCount(0);
    await expect.poll(() => names(page)).toEqual(["A"]);
    await row(page, "clearall").tap();
    await expect(row(page, "clearall")).toContainText("again");
    expect(await names(page)).toEqual(["A"]);
    await row(page, "clearall").tap();
    await expect.poll(() => names(page)).toEqual([]);
  });
});

test.describe("a hold copies in every sheet", () => {
  test("Vars: a hold on A = 7 copies 7, the sheet stays open and the line stays empty; a tap still inserts the name", async ({ page }) => {
    await start(page);
    await store(page, ["d7"], "vars", 1);
    await gestures(page);
    await setClipboard(page, "sentinel");
    await tap(page, ["vars"]);
    await expect(row(page, "var:A")).toBeVisible();
    await hold(page, row(page, "var:A"));
    await expect.poll(() => clipboard(page)).toBe("7");
    await expect(find(page)).toBeVisible();
    expect(await entryValue(page)).toBe("");
    await row(page, "var:A").tap();
    await expect(find(page)).toBeHidden();
    expect(await entryValue(page)).toBe("A");
  });

  test("Find: a hold on the constant c copies 299792458, the sheet stays open and the line stays empty; a tap still inserts it", async ({ page }) => {
    await start(page);
    await tap(page, ["d1", "enter"]); // a history row: its swipe strip shows the gestures' chunk is in
    await done(page, 1);
    await gestures(page);
    await setClipboard(page, "sentinel");
    await tap(page, ["math", "tmpl"]); // c
    await expect(row(page, "const:c")).toBeVisible();
    await hold(page, row(page, "const:c"));
    await expect.poll(() => clipboard(page)).toBe("299792458");
    await expect(find(page)).toBeVisible();
    expect(await entryValue(page)).toBe("");
    await row(page, "const:c").tap();
    await expect(find(page)).toBeHidden();
    expect(await entryValue(page)).toBe("\\const{c}{c}");
  });
});
