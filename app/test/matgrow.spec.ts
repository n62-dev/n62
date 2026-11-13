// SPDX-License-Identifier: GPL-3.0-or-later
// R185 (docs/04 5.3): Shift + 5 inserts a 1×1 matrix that grows as you type: a tapped ▶ at the end of a row's last cell
// adds a column, a tapped ▼ in the last row adds a row (MathLive's addColumnAfter, addRowAfter), and ▶ (▼) on a column
// (row) that is still all empty takes it back and leaves the matrix. Only a tap or a hardware arrow grows: a drag on the
// pad steps as before, and the Tmpl palette's matrices (2×2, 1×2, 2×1) stop where they always stopped. MathLive writes
// a row break as `\\ ` (with a space), as in the Tmpl samples. Values derived by hand.
import { expect, test, type Page } from "@playwright/test";
import { drag, entryValue, lastResult, open, sheet, tap } from "./helpers.ts";

const M22 = "\\begin{pmatrix}1 & 2\\\\ 3 & 4\\end{pmatrix}";

const cursor = (page: Page) =>
  page.evaluate(() => {
    const mf = window.n62.entry.field;
    if (!mf) throw new Error("no field");
    return { pos: mf.position, last: mf.lastOffset };
  });
/** The cursor at offset `o` (the end of the atom there), as a tap on the line puts it. */
const at = (page: Page, o: number) =>
  page.evaluate((o) => {
    const mf = window.n62.entry.field;
    if (!mf) throw new Error("no field");
    mf.position = o;
  }, o);

test.describe("Shift + 5 (fake engine)", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
  });

  test("1 ▶ 2 ▼ 3 ▶ 4 grows a 2×2", async ({ page }) => {
    await tap(page, ["shift", "d5"]);
    expect(await entryValue(page)).toBe("\\begin{pmatrix}\\placeholder{}\\end{pmatrix}");
    await tap(page, ["d1", "right", "d2", "down", "d3", "right", "d4"]);
    expect(await entryValue(page)).toBe(M22);
  });

  test("a third column from either row's end; a third row from the last row", async ({ page }) => {
    await tap(page, ["shift", "d5", "d1", "right", "d2", "down", "d3", "right", "d4", "right", "d6"]);
    expect(await entryValue(page)).toBe("\\begin{pmatrix}1 & 2 & \\\\ 3 & 4 & 6\\end{pmatrix}");
    await tap(page, ["esc", "shift", "d5", "d1", "right", "d2", "down", "d3", "right", "d4"]);
    await at(page, 4); // after the 2: the end of row 1
    await tap(page, ["right", "d5"]);
    expect(await entryValue(page)).toBe("\\begin{pmatrix}1 & 2 & 5\\\\ 3 & 4 & \\end{pmatrix}");
    await tap(page, ["esc", "shift", "d5", "d1", "right", "d2", "down", "d3", "right", "d4", "down", "d7"]);
    expect(await entryValue(page)).toBe("\\begin{pmatrix}1 & 2\\\\ 3 & 4\\\\ 7 & \\placeholder{}\\end{pmatrix}");
  });

  test("leaving: ▶ on the column just added and still empty takes it back and goes after the matrix", async ({ page }) => {
    await tap(page, ["shift", "d5", "d1", "right", "right", "add"]);
    expect(await entryValue(page)).toBe("\\begin{pmatrix}1\\end{pmatrix}+");
  });

  test("leaving: ▼ on the row just added and still empty takes it back and goes after the matrix", async ({ page }) => {
    await tap(page, ["shift", "d5", "d1", "down", "down", "add"]);
    expect(await entryValue(page)).toBe("\\begin{pmatrix}1\\end{pmatrix}+");
  });

  test("a drag on the pad through the matrix and out of it adds no column and no row", async ({ page }) => {
    await tap(page, ["shift", "d5", "d1"]);
    await drag(page, "right", 70, 0); // five steps right: out of the matrix, then the line's end
    expect(await entryValue(page)).toBe("\\begin{pmatrix}1\\end{pmatrix}");
    let c = await cursor(page);
    expect(c.pos).toBe(c.last);
    await tap(page, ["left"]); // back into the cell, after the 1
    await drag(page, "down", 0, 70); // five steps down
    expect(await entryValue(page)).toBe("\\begin{pmatrix}1\\end{pmatrix}");
    // the same matrix still grows on a tap
    await at(page, 2);
    await tap(page, ["right", "d2"]);
    expect(await entryValue(page)).toBe("\\begin{pmatrix}1 & 2\\end{pmatrix}");
    c = await cursor(page);
    expect(c.pos).toBeLessThan(c.last);
  });

  test("a hardware ▶ and ▼ grow as the keys' taps do", async ({ page }) => {
    await tap(page, ["shift", "d5", "d1"]);
    await page.keyboard.press("ArrowRight");
    await tap(page, ["d2"]);
    await page.keyboard.press("ArrowDown");
    await tap(page, ["d3"]);
    await page.keyboard.press("ArrowRight");
    await tap(page, ["d4"]);
    expect(await entryValue(page)).toBe(M22);
  });

  test("a matrix typed before it or text after it does not stop it growing", async ({ page }) => {
    await tap(page, ["shift", "d5", "d1", "right", "right", "add", "d2"]);
    await page.evaluate(() => {
      const mf = window.n62.entry.field;
      if (!mf) throw new Error("no field");
      mf.position = 0;
    });
    // a Tmpl 1×2 before it: the grown matrix is now the second one on the line
    await tap(page, ["tmpl"]);
    await sheet(page).locator('[data-id="rowvec"]').tap();
    await tap(page, ["d8", "right", "d9", "right", "mul"]);
    expect(await entryValue(page)).toBe("\\begin{pmatrix}8 & 9\\end{pmatrix}\\times\\begin{pmatrix}1\\end{pmatrix}+2");
    await at(page, 8); // after the 1 of the grown matrix
    await tap(page, ["right", "d3"]);
    expect(await entryValue(page)).toBe("\\begin{pmatrix}8 & 9\\end{pmatrix}\\times\\begin{pmatrix}1 & 3\\end{pmatrix}+2");
    // and the Tmpl one still does not grow
    await at(page, 4); // after its 9
    await tap(page, ["right"]);
    expect(await entryValue(page)).toBe("\\begin{pmatrix}8 & 9\\end{pmatrix}\\times\\begin{pmatrix}1 & 3\\end{pmatrix}+2");
  });

  test("a recalled line's matrix does not grow (the default)", async ({ page }) => {
    await page.evaluate(() => window.n62.entry.set("\\begin{pmatrix}1\\end{pmatrix}"));
    await at(page, 2);
    await tap(page, ["right", "d5"]);
    expect(await entryValue(page)).toBe("\\begin{pmatrix}1\\end{pmatrix}5");
  });
});

// The Tmpl palette's matrices: ▶ at the last cell leaves the matrix, a second ▶ stays at the line's end, ▼ in the last row
// stays where it is; nothing is added (as on phase-1 before R185, measured 2026-11-13).
for (const [id, keys, filled] of [
  ["matrix22", ["d1", "right", "d2", "right", "d3", "right", "d4"], M22],
  ["rowvec", ["d1", "right", "d2"], "\\begin{pmatrix}1 & 2\\end{pmatrix}"],
  ["colvec", ["d1", "right", "d2"], "\\begin{pmatrix}1\\\\ 2\\end{pmatrix}"],
] as const) {
  test(`Tmpl's ${id}: ▶ and ▼ at its last cell add nothing`, async ({ page }) => {
    await open(page);
    await tap(page, ["tmpl"]);
    await sheet(page).locator(`[data-id="${id}"]`).tap();
    await tap(page, [...keys]);
    expect(await entryValue(page)).toBe(filled);
    const end = await cursor(page);
    expect(end.pos).toBe(end.last - 1);
    await tap(page, ["down"]);
    expect(await cursor(page)).toEqual(end);
    await tap(page, ["right"]);
    expect(await cursor(page)).toEqual({ pos: end.last, last: end.last });
    await tap(page, ["right"]);
    expect(await entryValue(page)).toBe(filled);
    expect(await cursor(page)).toEqual({ pos: end.last, last: end.last });
  });
}

test.describe("Shift + 5 (real engine)", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "");
    await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
  });

  test("the grown 2×2 is [[1,2],[3,4]]", async ({ page }) => {
    await tap(page, ["shift", "d5", "d1", "right", "d2", "down", "d3", "right", "d4", "enter"]);
    await expect(lastResult(page)).toHaveAttribute("data-text", "[[1,2],[3,4]]");
  });

  test("a chip in a cell survives the growth: Ans ▶ 2 is [[7,2]]", async ({ page }) => {
    await tap(page, ["d7", "enter"]);
    await expect(lastResult(page)).toHaveAttribute("data-text", "7");
    await tap(page, ["shift", "d5", "shift", "add", "right", "d2"]);
    expect(await entryValue(page)).toBe("\\begin{pmatrix}\\ans & 2\\end{pmatrix}");
    await tap(page, ["enter"]);
    await expect(lastResult(page)).toHaveAttribute("data-text", "[[7,2]]");
  });
});
