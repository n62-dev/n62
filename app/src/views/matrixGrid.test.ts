// SPDX-License-Identifier: GPL-3.0-or-later
// R188: the matrix grid's model: the read (Home's elements, else the bridge's, engine/matrixRead.ts), each cell drawn
// by the Home formatter with Home's mark (≈ or ⚠; fix round 1: 1/3 showed 0.333333333333 with none), the highlight's
// moves (they stop at the edges), and the level it makes in a sheet (▲ ▼ ◀ ▶ move it, a digit or Enter picks nothing,
// Esc goes back). Expected values by hand: 1/3 at 12 digits is 0.333333333333, at 4 digits 0.3333; sqrt(2) at 4 is 1.414.
import { describe, expect, it } from "vitest";
import type { AppHost } from "../apps/types.ts";
import type { MatrixRead } from "../calc/matrices.ts";
import type { HomeOutcome } from "../calc/port.ts";
import { decimalFromRational, decimalFromString, ZERO_VALUE, type ComplexValue } from "../engine/format.ts";
import type { HomeResult } from "../engine/homeEval.ts";
import { keyboard } from "../keyboard/keyboard.ts";
import { findText } from "../i18n/enFind.ts";
import { MatrixGrid, type CellLine } from "./matrixGrid.svelte.ts";
import { Sheet } from "./sheet.svelte.ts";

const SETTINGS: AppHost["settings"] = { digits: 12, angle: "rad", format: "std" };
const none = (): Promise<HomeOutcome> => Promise.resolve({ ok: false, display: "", approximate: false, facts: { exact: false, reliableDigits: null }, full: "" });
const real = (p: bigint, q = 1n): ComplexValue => ({ re: decimalFromRational(p, q), im: ZERO_VALUE });
const read = (rows: number, cols: number, cells: MatrixRead["cells"]): (() => Promise<MatrixRead>) => () => Promise.resolve({ name: "S", rows, cols, ...(cells ? { cells } : {}) });
const symbols = read(3, 2, ["a", "1", "2", "b", "c", "d"].map((text) => ({ text })));
const exact = (v: ComplexValue): HomeResult => ({ ok: true, display: "", approximate: false, value: v, facts: { exact: true, reliableDigits: null } }) as HomeResult;

describe("the matrix grid (R188)", () => {
  it("a matrix Home gives no elements for is read through the bridge; the highlight stops at the edges", async () => {
    const g = new MatrixGrid("S", () => SETTINGS, none, symbols);
    g.open();
    await g.loading();
    expect([g.rows, g.cols]).toEqual([3, 2]);
    expect(Array.isArray(g.cells) ? g.cells.map((c) => g.text(c)) : g.cells).toEqual(["a", "1", "2", "b", "c", "d"]);
    g.move(-1, -1);
    expect([g.row, g.col]).toEqual([0, 0]);
    g.move(5, 5);
    expect([g.row, g.col]).toEqual([2, 1]);
  });

  it("a read with no matrix, or with cells that do not fill its size, fails", async () => {
    for (const r of [() => Promise.resolve(null), read(2, 2, [{ text: "a" }]), read(2, 2, undefined)]) {
      const g = new MatrixGrid("S", () => SETTINGS, none, r);
      g.open();
      await g.loading();
      expect(g.cells).toBe("failed");
    }
  });

  it("Home's elements carry Home's mark: 1/3 shows rounded with ≈, an exact integer with none", async () => {
    const home = (): Promise<HomeOutcome> =>
      Promise.resolve({ ok: true, display: "", approximate: false, facts: { exact: true, reliableDigits: null }, full: "", shape: [2, 2], items: [exact(real(1n, 3n)), exact(real(2n)), exact(real(3n)), exact(real(4n))] });
    const g = new MatrixGrid("M", () => SETTINGS, home, () => Promise.resolve(null));
    g.open();
    await g.loading();
    const cells = Array.isArray(g.cells) ? g.cells : [];
    expect(cells.map((c) => [g.text(c), g.mark(c)])).toEqual([
      ["0.333333333333", "≈"],
      ["2", null],
      ["3", null],
      ["4", null],
    ]);
  });

  it("a symbol beside numbers under Digits 4: each number in the app's digits with its mark", async () => {
    const sqrt2 = { re: decimalFromString("1.4142135623730950488")!, im: ZERO_VALUE };
    const r = read(1, 4, [
      { text: "x" },
      { value: real(1n, 3n), facts: { exact: true, reliableDigits: null } },
      { value: sqrt2, facts: { exact: false, reliableDigits: null, warn: "unchecked" } },
      { text: "x+1.414", unchecked: true },
    ]);
    const g = new MatrixGrid("S", () => ({ ...SETTINGS, digits: 4, decimalMark: "comma" }), none, r);
    g.open();
    await g.loading();
    const cells = Array.isArray(g.cells) ? g.cells : [];
    expect(cells.map((c) => [g.text(c), g.mark(c)])).toEqual([
      ["x", null],
      ["0,3333", "≈"],
      ["1,414", "⚠"],
      ["x+1,414", "⚠"],
    ]);
  });

  it("in a sheet, the grid's level takes the arrows, picks nothing and goes back on Esc", async () => {
    const g = new MatrixGrid("S", () => SETTINGS, none, read(2, 2, ["a", "1", "2", "b"].map((text) => ({ text }))));
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

// R189: a cell is edited on the entry line and written back with `M:=[[…]]` through the session's store path; the other
// elements as the log types them (the bridge's `typed`, engine/matrixRead.ts). Expected texts by hand.
describe("the matrix grid's cell edit (R189)", () => {
  const key = (id: string) => keyboard.byId.get(id) ?? (() => { throw new Error(`no key ${id}`); })();
  const homeM = (): Promise<HomeOutcome> =>
    Promise.resolve({ ok: true, display: "", approximate: false, facts: { exact: true, reliableDigits: null }, full: "", shape: [2, 2], items: [exact(real(1n)), exact(real(2n)), exact(real(3n)), exact(real(4n))] });
  const typed = (cells: true | "typed"): Promise<MatrixRead> =>
    Promise.resolve(cells === "typed" ? { name: "M", rows: 2, cols: 2, typed: ["1", "2", "3", "evalf(1/10,15)"] } : { name: "M", rows: 2, cols: 2 });
  async function at21(): Promise<{ g: MatrixGrid; line: CellLine; entry: { value: string }; sent: string[] }> {
    const sent: string[] = [];
    const entry = { value: "7", chips: {}, clear: () => void (entry.value = ""), set: (l: string) => void (entry.value = l) };
    const session = { shift: false, alpha: false, userNames: [], submit: (l: string, g?: string) => (sent.push(`${l} | ${g ?? ""}`), Promise.resolve()) };
    const g = new MatrixGrid("M", () => SETTINGS, homeM, typed);
    g.open();
    await g.loading();
    g.move(1, 0);
    return { g, line: { entry, session } as unknown as CellLine, entry, sent };
  }

  it("a key that types starts the edit on a cleared line; the grid's keys and a control keep the sheet's job", async () => {
    const { g, line, entry } = await at21();
    for (const id of ["up", "down", "left", "right", "enter", "esc", "bksp", "math"]) expect(g.key(line, key(id), undefined)).toBeUndefined();
    expect(g.editing).toBeNull();
    expect(g.key(line, key("d9"), undefined)).toBe(false); // route.ts then runs it on the line
    expect(g.editing).toEqual({ row: 1, col: 0 });
    expect(entry.value).toBe("");
  });

  it("Enter writes the cell with the other elements as typed, in one store; the line that was there comes back", async () => {
    const { g, line, entry, sent } = await at21();
    g.key(line, key("d9"), undefined);
    entry.value = "9";
    expect(g.key(line, key("math"), undefined)).toBe(true); // a key that opens a sheet does nothing during the edit
    expect(g.key(line, key("enter"), undefined)).toBe(true);
    await g.loading();
    expect(sent).toEqual(["M:=[[1,2],[9,evalf(1/10,15)]] | M:=[[1,2],[9,evalf(1/10,15)]]"]);
    expect(g.editing).toBeNull();
    expect(entry.value).toBe("7");
  });

  it("a refused cell sends nothing and the edit stays; Esc then ends it and the old line comes back", async () => {
    const { g, line, entry, sent } = await at21();
    g.key(line, key("d1"), undefined);
    entry.value = "1+";
    g.key(line, key("enter"), undefined);
    await g.loading();
    expect(g.refusal).toBeTruthy();
    entry.value = "\\left(1,2\\right)"; // two values in one cell (the parser gives the sequence (1,2))
    g.key(line, key("enter"), undefined);
    await g.loading();
    expect(g.refusal).toBe(findText("matrix.oneValue"));
    expect(sent).toEqual([]);
    expect(g.editing).toEqual({ row: 1, col: 0 });
    expect(g.key(line, key("esc"), undefined)).toBe(true);
    expect([g.editing, g.refusal, entry.value]).toEqual([null, null, "7"]);
  });

  it("a call's arguments are one value: f(1,2) is written as typed", async () => {
    const { g, line, entry, sent } = await at21();
    g.key(line, key("d9"), undefined);
    entry.value = "\\operatorname{max}\\left(1,2\\right)";
    g.key(line, key("enter"), undefined);
    await g.loading();
    expect([g.refusal, sent.length]).toEqual([null, 1]);
    expect(sent[0]).toMatch(/^M:=\[\[1,2\],\[max\(1,2\),evalf\(1\/10,15\)\]\] \| /);
  });

  it("Enter on an empty line ends the edit and keeps the old value", async () => {
    const { g, line, entry, sent } = await at21();
    g.key(line, key("d9"), undefined);
    entry.value = "";
    g.key(line, key("enter"), undefined);
    expect([g.editing, entry.value, sent]).toEqual([null, "7", []]);
  });
});
