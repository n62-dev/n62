// SPDX-License-Identifier: GPL-3.0-or-later
// R727: Shift + Select copies the entry line's selection when there is one (before R723's picked or last row), and
// the Select chain stays, so Deselect still walks back. The expected clipboard text is what a hold on an input copies
// (entryText of the selection's LaTeX).
import { expect, test, type Page } from "@playwright/test";
import { finger } from "./core-lib.ts";
import { KEYCOPY, entryValue, flick, open, setClipboard, tap, useClipboardLock } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
useClipboardLock();

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
});

const clipboard = (page: Page): Promise<string> => page.evaluate(() => navigator.clipboard.readText());
const done = (page: Page, n: number) => expect(page.locator('[data-status="done"]')).toHaveCount(n);
const notice = (page: Page) => page.getByTestId("notice");

/** The line's selection as LaTeX ("" when collapsed). */
const selected = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const mf = window.n62.entry.field;
    if (!mf) throw new Error("no field");
    return mf.selectionIsCollapsed ? "" : mf.getValue(mf.selection, "latex");
  });

/** Put `latex` on the line, the cursor at its end. */
const line = (page: Page, latex: string): Promise<void> =>
  page.evaluate((l) => {
    const mf = window.n62.entry.field;
    if (!mf) throw new Error("no field");
    mf.value = l;
    mf.focus();
    mf.position = mf.lastOffset;
  }, latex);

/** Press Select until the selection is `want` (at most 6 presses). */
async function selectUntil(page: Page, want: string): Promise<void> {
  for (let i = 0; i < 6 && (await selected(page)) !== want; i++) await tap(page, ["select"]);
  expect(await selected(page)).toBe(want);
}

test("12+34, Select until 34, Shift + Select: the clipboard holds 34, the line and the selection stay, Copied", async ({ page }) => {
  await tap(page, ["d1", "d2", "add", "d3", "d4"]);
  await selectUntil(page, "34");
  await setClipboard(page, "untouched");
  await tap(page, KEYCOPY);
  await expect(notice(page)).toHaveText("Copied: 34");
  await expect.poll(() => clipboard(page)).toBe("34");
  expect(await entryValue(page)).toBe("12+34");
  expect(await selected(page)).toBe("34");
});

test("Select, Select, Copy, Deselect: the selection walks back one step as without the Copy", async ({ page }) => {
  await tap(page, ["d2", "add", "d3", "mul", "d4"]);
  await tap(page, ["select", "select"]);
  expect(await selected(page)).toBe("3\\times4");
  await setClipboard(page, "untouched");
  await tap(page, KEYCOPY);
  await expect.poll(() => clipboard(page)).toBe("3×4");
  await tap(page, ["deselect"]);
  expect(await selected(page)).toBe("4");
  await tap(page, ["deselect"]);
  expect(await selected(page)).toBe("");
});

test("sin(2) selected whole: Shift + Select copies what a hold on that input copies after Enter", async ({ page }) => {
  await line(page, "\\sin\\left(2\\right)");
  await selectUntil(page, "\\sin\\left(2\\right)");
  await setClipboard(page, "untouched");
  await tap(page, KEYCOPY);
  await expect.poll(() => clipboard(page)).toBe("sin(2)");
  await tap(page, ["enter"]);
  await done(page, 1);
  await setClipboard(page, "");
  await finger(page, "input:last", { ms: 700 });
  await expect.poll(() => clipboard(page)).toBe("sin(2)");
});

test("1÷3 Enter, 5 on the line, tap the row to pick it, select 5, Shift + Select: the clipboard holds 5 and the pick stays", async ({ page }) => {
  await tap(page, ["d1", "div", "d3", "enter"]);
  await done(page, 1);
  await tap(page, ["d5"]);
  await page.locator('[data-status="done"]').last().locator(".result").tap(); // a first tap picks the row (R147), the text stays
  await expect(page.locator('[data-selected="true"]')).toHaveCount(1);
  // (Select does nothing on a pick, R279: the line's selection is made the way a drag in the line makes it)
  await page.evaluate(() => {
    const mf = window.n62.entry.field;
    if (!mf) throw new Error("no field");
    mf.selection = { ranges: [[0, mf.lastOffset]] };
  });
  expect(await selected(page)).toBe("5");
  await setClipboard(page, "untouched");
  await tap(page, KEYCOPY);
  await expect.poll(() => clipboard(page)).toBe("5");
  expect(await entryValue(page)).toBe("5");
  await expect(page.locator('[data-selected="true"]')).toHaveCount(1);
});

test("no selection: the last row's full value; with a pick, the picked row's (R723 as before)", async ({ page }) => {
  await tap(page, ["d1", "div", "d3", "enter"]);
  await done(page, 1);
  await tap(page, ["d2", "div", "d3", "enter"]);
  await done(page, 2);
  await setClipboard(page, "untouched");
  await tap(page, KEYCOPY);
  await expect.poll(() => clipboard(page)).toBe("0." + "6".repeat(39) + "7");
  await setClipboard(page, "untouched");
  await tap(page, ["up", "up", ...KEYCOPY]);
  await expect.poll(() => clipboard(page)).toBe("0." + "3".repeat(40));
});

test("a pick with nothing selected: Shift + Select copies the picked row and lets the pick go (R723); Enter then acts on the empty line", async ({ page }) => {
  await tap(page, ["d1", "div", "d3", "enter"]);
  await done(page, 1);
  await tap(page, ["d2", "div", "d3", "enter"]);
  await done(page, 2);
  await tap(page, ["up", "up"]); // picks the 1÷3 row
  await expect(page.locator('[data-selected="true"]')).toHaveCount(1);
  await setClipboard(page, "untouched");
  await tap(page, KEYCOPY);
  await expect.poll(() => clipboard(page)).toBe("0." + "3".repeat(40));
  await expect(page.locator('[data-selected="true"]')).toHaveCount(0);
});

test("a flick up on Select with a selection copies the selection", async ({ page }) => {
  await tap(page, ["d1", "d2", "add", "d3", "d4"]);
  await selectUntil(page, "34");
  await setClipboard(page, "untouched");
  await flick(page, "select", "up");
  await expect.poll(() => clipboard(page)).toBe("34");
  expect(await selected(page)).toBe("34");
});

test("Function, Symb line: x^2 selected, Shift + Select copies x^2; with nothing selected it is a dead press", async ({ page }) => {
  await tap(page, ["@symb"]);
  await expect(page.locator('[data-app="function"]')).toBeVisible();
  await tap(page, ["x", "pow", "d2"]);
  expect(await entryValue(page)).toBe("x^2");
  await setClipboard(page, "untouched");
  await tap(page, KEYCOPY);
  await page.waitForTimeout(300);
  expect(await clipboard(page)).toBe("untouched");
  await expect(notice(page)).toHaveCount(0);
  await selectUntil(page, "x^2");
  await tap(page, KEYCOPY);
  await expect.poll(() => clipboard(page)).toBe("x^2");
  await expect(notice(page)).toHaveText("Copied: x^2");
});

test("Function: a selection on the field while Plot hides the line (no entry line): Shift + Select is a dead press", async ({ page }) => {
  await tap(page, ["@symb"]);
  await expect(page.locator('[data-app="function"]')).toBeVisible();
  await tap(page, ["@plot"]);
  await expect(page.getByTestId("entry")).toBeHidden();
  // (the view change clears the line, so the selection is put on the hidden field by hand)
  await page.evaluate(() => {
    const mf = window.n62.entry.field;
    if (!mf) throw new Error("no field");
    mf.value = "x^2";
    mf.selection = { ranges: [[0, mf.lastOffset]] };
  });
  expect(await selected(page)).toBe("x^2");
  await setClipboard(page, "untouched");
  await tap(page, KEYCOPY);
  await page.waitForTimeout(300);
  expect(await clipboard(page)).toBe("untouched");
  await expect(notice(page)).toHaveCount(0);
});

test("a hold on a row still copies as before", async ({ page }) => {
  await tap(page, ["d1", "div", "d3", "enter"]);
  await done(page, 1);
  await setClipboard(page, "");
  await finger(page, "input:last", { ms: 700 });
  await expect.poll(() => clipboard(page)).toBe("1/3");
});
