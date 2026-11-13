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

  // R186 (docs/04 5.3): ⌫ in an empty last row or column takes it back; every other ⌫ is as before. A hardware Backspace
  // is the same key (R45). The cursor goes to the end of the cell before it (above it for a row).
  const M1 = "\\begin{pmatrix}1\\end{pmatrix}";
  const grown22 = ["shift", "d5", "d1", "right", "d2", "down", "d3", "right", "d4"];

  test("⌫ in the row ▼ just added takes it back: the 2×2 again, the cursor after the 4", async ({ page }) => {
    await tap(page, [...grown22, "down"]);
    expect(await entryValue(page)).toBe("\\begin{pmatrix}1 & 2\\\\ 3 & 4\\\\ \\placeholder{} & \\placeholder{}\\end{pmatrix}");
    await tap(page, ["right"]); // to the last row's second cell: still the row's empty cell
    await tap(page, ["bksp"]);
    expect(await entryValue(page)).toBe(M22);
    await tap(page, ["d5"]); // the cursor is in the 4's cell
    expect(await entryValue(page)).toBe("\\begin{pmatrix}1 & 2\\\\ 3 & 45\\end{pmatrix}");
  });

  test("⌫ in the column ▶ just added takes it back: the 2×2 again", async ({ page }) => {
    await tap(page, [...grown22, "right", "bksp"]);
    expect(await entryValue(page)).toBe(M22);
    await tap(page, ["d5"]);
    expect(await entryValue(page)).toBe("\\begin{pmatrix}1 & 2\\\\ 3 & 45\\end{pmatrix}");
  });

  test("a hardware Backspace takes the added row and the added column back", async ({ page }) => {
    await tap(page, [...grown22, "right"]);
    await page.keyboard.press("Backspace");
    expect(await entryValue(page)).toBe(M22);
    await tap(page, ["down"]);
    await page.keyboard.press("Backspace");
    expect(await entryValue(page)).toBe(M22);
  });

  test("⌫ in a filled cell deletes a digit; the emptied last column then goes on the next ⌫", async ({ page }) => {
    await tap(page, ["shift", "d5", "d1", "right", "d2", "d3", "bksp"]);
    expect(await entryValue(page)).toBe("\\begin{pmatrix}1 & 2\\end{pmatrix}");
    await tap(page, ["bksp"]); // the 2 goes: its cell is empty but the column is the matrix's last and holds nothing else
    expect(await entryValue(page)).toBe("\\begin{pmatrix}1 & \\placeholder{}\\end{pmatrix}");
    await tap(page, ["bksp"]);
    expect(await entryValue(page)).toBe(M1);
  });

  test("⌫ takes back the added row of a 1×2, and a row whose typed number was deleted again", async ({ page }) => {
    await tap(page, ["shift", "d5", "d1", "right", "d2", "down"]); // row 2 added under 1 & 2, its first cell
    await tap(page, ["bksp"]);
    expect(await entryValue(page)).toBe(M1.replace("1", "1 & 2"));
    await tap(page, ["down", "d3", "bksp", "bksp"]); // a row again, 3 typed and deleted (the cell is empty, its row too): the row goes
    expect(await entryValue(page)).toBe(M1.replace("1", "1 & 2"));
  });

  test("⌫ in a 1×1 empty matrix removes the matrix", async ({ page }) => {
    await tap(page, ["d7", "shift", "d5", "bksp"]);
    expect(await entryValue(page)).toBe("7");
  });

  test("a hardware Backspace in a 1×1 empty matrix removes the matrix", async ({ page }) => {
    await tap(page, ["shift", "d5"]);
    await page.keyboard.press("Backspace");
    expect(await entryValue(page)).toBe("");
  });

  // One drag step at the edge (12–23 px): a tap there would add a column (a row), so a lost `drag` mark fails here. A longer
  // drag cannot tell: its next step takes the empty column (row) back again.
  test("one drag step ▶ at the end of the row moves out of the matrix and adds no column", async ({ page }) => {
    await tap(page, ["shift", "d5", "d1"]);
    await drag(page, "right", 18, 0);
    expect(await entryValue(page)).toBe("\\begin{pmatrix}1\\end{pmatrix}");
    const c = await cursor(page);
    expect(c.pos).toBe(c.last);
  });

  test("one drag step ▼ in the last row adds no row", async ({ page }) => {
    await tap(page, ["shift", "d5", "d1"]);
    await drag(page, "down", 0, 18);
    expect(await entryValue(page)).toBe("\\begin{pmatrix}1\\end{pmatrix}");
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
