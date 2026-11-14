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
import { createMatrix, MatrixGrid, type CellLine } from "./matrixGrid.svelte.ts";
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

// R189: a cell is edited on the entry line and written back through the session's normal path as the line
// `M:=\begin{pmatrix}…\end{pmatrix}` (fix round 2): the typed cell as typed, the other elements as the bridge's LaTeX
// (engine/matrixRead.ts ElementTex, a float in approx()), the parser's store checked by the worker first (here a stand-in
// that answers as told). Expected texts by hand.
describe("the matrix grid's cell edit (R189)", () => {
  const key = (id: string) => keyboard.byId.get(id) ?? (() => { throw new Error(`no key ${id}`); })();
  const homeM = (): Promise<HomeOutcome> =>
    Promise.resolve({ ok: true, display: "", approximate: false, facts: { exact: true, reliableDigits: null }, full: "", shape: [2, 2], items: [exact(real(1n)), exact(real(2n)), exact(real(3n)), exact(real(4n))] });
  const TYPED = ["1", "2", "3", "evalf(1/10,15)"];
  /** The worker's answer to a check (`candidate`): by default a matrix of the same size whose other elements are as they were. */
  let answer: MatrixRead["candidate"];
  const checks: string[] = [];
  const typed = (cells: true | "typed", check?: string): Promise<MatrixRead> => {
    if (check !== undefined) checks.push(check);
    const candidate = answer ?? { ok: true as const, rows: 2, cols: 2, typed: ["1", "2", "?", TYPED[3] as string] };
    const latex = [{ tex: "1" }, { tex: "2" }, { tex: "3" }, { tex: "0.1", float: true as const }];
    return Promise.resolve(cells === "typed" ? { name: "M", rows: 2, cols: 2, typed: TYPED, latex, ...(check === undefined ? {} : { candidate }) } : { name: "M", rows: 2, cols: 2 });
  };
  async function at21(): Promise<{ g: MatrixGrid; line: CellLine; entry: { value: string }; sent: string[] }> {
    answer = undefined;
    checks.length = 0;
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
    // the row is LaTeX the line reads back (no override: the session parses it, as a recall does)
    expect(sent).toEqual(["M:=\\begin{pmatrix}1&2\\\\9&\\operatorname{approx}\\left(0.1\\right)\\end{pmatrix} | "]);
    expect(checks).toEqual(["M:=[[1,2],[9,approx(0.1)]]"]); // the parser's store, checked before it was sent
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
    answer = { ok: false, why: "shape" }; // the worker's check: its row spreads (engine/matrixRead.test.ts, R189f1)
    g.key(line, key("enter"), undefined);
    await g.loading();
    expect(checks).toEqual(["M:=[[1,2],[(1,2),approx(0.1)]]"]);
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
    expect(sent[0]).toContain("\\\\\\operatorname{max}\\left(1,2\\right)&");
    expect(checks).toEqual(["M:=[[1,2],[max(1,2),approx(0.1)]]"]);
  });

  it("the worker's refusals: not a matrix of this size, a store in the cell, another element changed; nothing is sent", async () => {
    for (const [a, why] of [
      [{ ok: false, why: "shape" }, "matrix.oneValue"],
      [{ ok: false, why: "store" }, "matrix.noStore"],
      [{ ok: true, rows: 2, cols: 2, typed: ["1", "5", "9", "evalf(1/10,15)"] }, "matrix.notKept"],
      [{ ok: true, rows: 1, cols: 4, typed: ["1", "2", "9", "evalf(1/10,15)"] }, "matrix.oneValue"], // R190: the size is the one the grid meant
    ] as const) {
      const { g, line, entry, sent } = await at21();
      answer = a;
      g.key(line, key("d9"), undefined);
      entry.value = "9";
      g.key(line, key("enter"), undefined);
      await g.loading();
      expect([g.refusal, sent, g.editing]).toEqual([findText(why), [], { row: 1, col: 0 }]);
    }
  });

  it("Enter on an empty line ends the edit and keeps the old value", async () => {
    const { g, line, entry, sent } = await at21();
    g.key(line, key("d9"), undefined);
    entry.value = "";
    g.key(line, key("enter"), undefined);
    expect([g.editing, entry.value, sent]).toEqual([null, "7", []]);
  });

  // R190: ☰ opens the grid's menu; a pick writes the matrix back as a cell does (the same store check, the same path).
  describe("the grid's menu (R190)", () => {
    const WAS = ["1", "2", "3", "evalf(1/10,15)"];
    const A = "\\operatorname{approx}\\left(0.1\\right)";
    it("☰ opens it on its first row; ▲ ▼ move; Esc and ☰ close it; other keys do nothing; the cell edit's keys are not used", async () => {
      const { g, line, sent } = await at21();
      expect(g.key(line, key("menu"), undefined)).toBe(true);
      expect(g.menu).toBe(0);
      expect(g.menuRows().map((r) => r.op)).toEqual(["addRow", "addCol", "delRow", "delCol"]);
      g.key(line, key("down"), undefined);
      g.key(line, key("down"), undefined);
      expect(g.menu).toBe(2);
      for (const id of ["d9", "left", "math", "bksp"]) expect(g.key(line, key(id), undefined)).toBe(true);
      expect([g.menu, g.editing, g.row, g.col, sent]).toEqual([2, null, 1, 0, []]);
      g.key(line, key("up"), undefined);
      g.key(line, key("up"), undefined);
      g.key(line, key("up"), undefined);
      expect(g.menu).toBe(0);
      g.key(line, key("esc"), undefined);
      expect(g.menu).toBeNull();
      g.key(line, key("menu"), undefined);
      g.key(line, key("menu"), undefined);
      expect(g.menu).toBeNull();
    });

    it("the delete rows name the row and column under the highlight; a 1 × 1 matrix keeps its cell", async () => {
      const { g, line } = await at21();
      expect(g.menuRows().map((r) => [r.label, r.reason])).toEqual([
        ["Add a row at the end", undefined],
        ["Add a column at the end", undefined],
        ["Delete row 2", undefined],
        ["Delete column 1", undefined],
      ]);
      const one = new MatrixGrid("O", () => SETTINGS, () => Promise.resolve({ ok: true, display: "", approximate: false, facts: { exact: true, reliableDigits: null }, full: "", shape: [1, 1], items: [exact(real(5n))] }), typed);
      one.open();
      await one.loading();
      expect(one.menuRows().map((r) => r.reason)).toEqual([undefined, undefined, findText("matrix.keepsCell"), findText("matrix.keepsCell")]);
      one.key(line, key("menu"), undefined);
      one.key(line, key("d3"), undefined);
      expect([one.refusal, one.menu]).toEqual([findText("matrix.keepsCell"), null]);
      one.key(line, key("menu"), undefined);
      one.key(line, key("d4"), undefined);
      expect(one.refusal).toBe(findText("matrix.keepsCell"));
    });

    it("1: a row of zeros at the end, written as the line of the whole matrix", async () => {
      const { g, line, sent } = await at21();
      answer = { ok: true, rows: 3, cols: 2, typed: [...WAS, "0", "0"] };
      g.key(line, key("menu"), undefined);
      g.key(line, key("d1"), undefined);
      await g.loading();
      expect(sent).toEqual([`M:=\\begin{pmatrix}1&2\\\\3&${A}\\\\0&0\\end{pmatrix} | `]);
      expect(checks).toEqual(["M:=[[1,2],[3,approx(0.1)],[0,0]]"]);
      expect([g.menu, g.refusal]).toEqual([null, null]);
    });

    it("2: a column of zeros at the end", async () => {
      const { g, line, sent } = await at21();
      answer = { ok: true, rows: 2, cols: 3, typed: ["1", "2", "0", "3", WAS[3] as string, "0"] };
      g.key(line, key("menu"), undefined);
      g.key(line, key("d2"), undefined);
      await g.loading();
      expect(sent).toEqual([`M:=\\begin{pmatrix}1&2&0\\\\3&${A}&0\\end{pmatrix} | `]);
    });

    it("3 and 4: the row and the column under the highlight go (a tap on the row picks it as Enter does)", async () => {
      const { g, line, sent } = await at21(); // the highlight is on row 2, column 1
      answer = { ok: true, rows: 1, cols: 2, typed: ["1", "2"] };
      g.key(line, key("menu"), undefined);
      g.choose(2);
      await g.loading();
      expect(sent).toEqual(["M:=\\begin{pmatrix}1&2\\end{pmatrix} | "]);
      const b = await at21();
      b.g.move(0, 1); // row 2, column 2
      answer = { ok: true, rows: 2, cols: 1, typed: ["1", "3"] };
      b.g.key(b.line, key("menu"), undefined);
      b.g.key(b.line, key("d4"), undefined);
      await b.g.loading();
      expect(b.sent).toEqual(["M:=\\begin{pmatrix}1\\\\3\\end{pmatrix} | "]);
    });

    it("a store that changes an element the pick keeps, or has the wrong size, is refused and nothing is sent", async () => {
      for (const a of [{ ok: true, rows: 3, cols: 2, typed: ["1", "9", "3", WAS[3] as string, "0", "0"] }, { ok: true, rows: 2, cols: 3, typed: [...WAS, "0", "0"] }, { ok: false, why: "shape" }] as const) {
        const { g, line, sent } = await at21();
        answer = a;
        g.key(line, key("menu"), undefined);
        g.key(line, key("d1"), undefined);
        await g.loading();
        expect([g.refusal === null, sent]).toEqual([false, []]);
      }
    });
  });
});

describe("New (R190)", () => {
  const take = (taken: string[]): { line: Parameters<typeof createMatrix>[0]; sent: string[] } => {
    const sent: string[] = [];
    return { sent, line: { userNames: taken.map((name) => ({ name, kind: "var", time: 1 })), submit: (l: string) => (sent.push(l), Promise.resolve()) } as unknown as Parameters<typeof createMatrix>[0] };
  };
  it("a 2 × 2 of zeros under the first letter no name holds", async () => {
    for (const [taken, name] of [[[], "A"], [["A", "B", "x"], "C"], [["B"], "A"], [["A", "B", "C", "D", "E", "F", "G", "H"], "J"]] as const) {
      const { line, sent } = take([...taken]);
      expect(await createMatrix(line)).toBe(name);
      expect(sent).toEqual([`${name}:=\\begin{pmatrix}0&0\\\\0&0\\end{pmatrix}`]);
    }
  });
  it("every letter taken: no name, nothing sent", async () => {
    const { line, sent } = take([..."ABCDEFGHJKLMNOPQRSTUVWXYZ"]);
    expect([await createMatrix(line), sent]).toEqual([null, []]);
  });
});
