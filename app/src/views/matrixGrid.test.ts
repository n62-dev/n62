// SPDX-License-Identifier: GPL-3.0-or-later
// R188: the matrix grid's model: the read (Home's elements, else the engine's texts), the highlight's moves (they stop
// at the edges), and the level it makes in a sheet (▲ ▼ ◀ ▶ move it, a digit or Enter picks nothing, Esc goes back).
import { describe, expect, it } from "vitest";
import type { AppHost } from "../apps/types.ts";
import type { HomeOutcome } from "../calc/port.ts";
import { MatrixGrid, readTexts, textsQuery } from "./matrixGrid.svelte.ts";
import { Sheet } from "./sheet.svelte.ts";

const SETTINGS: AppHost["settings"] = { digits: 12, angle: "rad", format: "std" };
const none = (): Promise<HomeOutcome> => Promise.resolve({ ok: false, display: "", approximate: false, facts: { exact: false, reliableDigits: null }, full: "" });

describe("the matrix grid (R188)", () => {
  it("a matrix Home gives no elements for is read as the engine's texts; the highlight stops at the edges", async () => {
    const g = new MatrixGrid("S", () => SETTINGS, none, () => Promise.resolve('[["a","1"],["2","b"],["c","d"]]'));
    g.open();
    await g.loading();
    expect([g.rows, g.cols]).toEqual([3, 2]);
    expect(Array.isArray(g.cells) ? g.cells.map((c) => g.text(c)) : g.cells).toEqual(["a", "1", "2", "b", "c", "d"]);
    g.move(-1, -1);
    expect([g.row, g.col]).toEqual([0, 0]);
    g.move(5, 5);
    expect([g.row, g.col]).toEqual([2, 1]);
  });

  it("an answer that is no matrix fails the read", async () => {
    const g = new MatrixGrid("S", () => SETTINGS, none, () => Promise.resolve('[["a","1"],["2"]]'));
    g.open();
    await g.loading();
    expect(g.cells).toBe("failed");
    expect(readTexts("GIAC_ERROR")).toBeNull();
    expect(textsQuery("M")).toBe("map(M,r->map(r,x->string(x)))");
  });

  it("in a sheet, the grid's level takes the arrows, picks nothing and goes back on Esc", async () => {
    const g = new MatrixGrid("S", () => SETTINGS, none, () => Promise.resolve('[["a","1"],["2","b"]]'));
    const sheet = new Sheet("matrix", "Matrix", () => [{ id: "matrix:S", label: "S", submenu: { title: "S", items: [], grid: g } }], { remember: false });
    expect(sheet.letters).toBe(false);
    sheet.pickNumber(1);
    expect(sheet.level.grid).toBe(g);
    expect(sheet.letters).toBe(true); // drawn over the view: the keypad's arrows reach it
    expect(sheet.level.loading()).not.toBeNull(); // keys wait while it reads
    await g.loading();
    sheet.level.move(1);
    sheet.right();
    expect([g.row, g.col]).toEqual([1, 1]);
    expect(sheet.left()).toBe(true);
    expect([g.row, g.col]).toEqual([1, 0]);
    expect(sheet.enter().kind).toBe("stay");
    expect(sheet.pickNumber(1).kind).toBe("stay");
    expect(sheet.back()).toBe(true);
    expect(sheet.depth).toBe(1);
  });
});
