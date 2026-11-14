// SPDX-License-Identifier: GPL-3.0-or-later
// R187: Shift + 4's sheet: the eight matrix functions as its fixed rows 1 to 8, in this order, from G227's Find items.
// The generated index is needed (skipped like finder.test.ts when it is missing).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { itemRow } from "../find/finder.ts";
import { makeIndex } from "../find/testIndex.ts";
import type { FindItem, IndexItem } from "../find/types.ts";
import { MATRIX_NEW, matrixItems, matrixRows, showMatrix, type MatrixCtx, type StoredMatrix } from "./matrixSheet.ts";
import { Sheet } from "./sheet.svelte.ts";

vi.mock("../calc/matrices.ts", () => ({
  readMatrices: (_e: unknown, names: readonly string[]) => Promise.resolve(names.map((name) => ({ name, rows: 2, cols: 2 }))),
}));

const file = join(dirname(fileURLToPath(import.meta.url)), "../find/_gen/find-index.json");
const raw = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as IndexItem[]) : [];

describe.skipIf(!raw.some((it) => it.kind === "unit"))("the matrix sheet (R187)", () => {
  const index = makeIndex(raw);
  const picked: FindItem[] = [];
  const items = matrixItems(index.byId, (it) => itemRow(it, (p) => void picked.push(p)));

  it("rows 1 to 8, in this order, with the sheet's own titles and the Find items' ids", () => {
    expect(items.map((i) => [i.id, i.label])).toEqual([
      ["fn:tran", "Transpose"],
      ["fn:dot", "Dot"],
      ["fn:cross", "Cross"],
      ["fn:norm", "Norm"],
      ["fn:rref", "Reduced row echelon"],
      ["fn:eigenvals", "Eigenvalues"],
      ["fn:det", "Determinant"],
      ["fn:inv", "Inverse"],
    ]);
  });

  it("the digit keys pick rows 1 to 8 and the pick is Find's (the item itself)", () => {
    const sheet = new Sheet("matrix", "Matrix", () => items, { remember: false });
    expect(sheet.level.rows.map((r) => r.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const p = sheet.pickNumber(1);
    expect(p.kind).toBe("run");
    if (p.kind === "run") p.item.run?.();
    expect(picked.map((x) => x.id)).toEqual(["fn:tran"]);
  });
});

describe.skipIf(!raw.some((it) => it.kind === "unit"))("the matrix sheet's order (R188)", () => {
  const index = makeIndex(raw);
  const FNS = ["fn:tran", "fn:dot", "fn:cross", "fn:norm", "fn:rref", "fn:eigenvals", "fn:det", "fn:inv"];
  const opened: string[] = [];
  let made = 0;
  const sheetOf = (stored: StoredMatrix[]): Sheet =>
    new Sheet("matrix", "Matrix", () => matrixRows(index.byId, (it) => itemRow(it, () => {}), stored, (m) => (opened.push(m.name), { title: m.name, items: [] }), () => void made++), { remember: false });

  for (const stored of [[], [{ name: "M", rows: 2, cols: 2 }], [{ name: "M", rows: 2, cols: 2 }, { name: "A", rows: 1, cols: 3 }, { name: "rot", rows: 3, cols: 3 }]] as StoredMatrix[][]) {
    it(`${stored.length} stored: the functions at rows 1 to 8, New at 9, the matrices from row 10`, () => {
      const sheet = sheetOf(stored);
      const rows = sheet.level.rows;
      expect(rows.slice(0, 8).map((r) => [r.n, r.item.id])).toEqual(FNS.map((id, i) => [i + 1, id]));
      expect([rows[8]?.n, rows[8]?.item.id, rows[8]?.item.label, rows[8]?.item.disabled]).toEqual([9, MATRIX_NEW, "New", undefined]); // R190: live in its place
      expect(rows[8]?.item.reason).toBeUndefined();
      expect(rows.slice(9).map((r) => [r.item.id, r.item.label, r.item.value])).toEqual(stored.map((m) => [`matrix:${m.name}`, m.name, `${m.rows}×${m.cols}`]));
      expect(rows.slice(9).map((r) => r.n)).toEqual(stored.map((_, i) => (i === 0 ? 10 : undefined)));
      // key 9 (New) makes the matrix and the sheet stays (it opens again with the new one); key 0 opens the first matrix's grid
      made = 0;
      expect(sheet.pickNumber(9).kind).toBe("stay");
      expect([made, sheet.depth]).toEqual([1, 1]);
      opened.length = 0;
      sheet.pickNumber(10);
      expect(sheet.depth).toBe(stored.length > 0 ? 2 : 1);
      if (stored[0]) expect(sheet.level.title).toBe(stored[0].name);
    });
  }
});

describe("New while the store runs (R190f1)", () => {
  // (no Find items: New is the sheet's first row here)
  const index = { byId: new Map() } as unknown as Parameters<typeof showMatrix>[1];
  /** A shell that keeps the sheet showMenu builds; the store of `createMatrix` is `done`, resolved by the test. */
  const setup = (): { c: MatrixCtx; shell: { sheet: Sheet | null }; menus: number; picks: string[]; submits: number; done: () => Promise<void> } => {
    let release: () => void = () => {};
    // (createMatrix loads the parser before it submits: `done` waits for the submit, then resolves the store)
    const state = { c: null as unknown as MatrixCtx, shell: { sheet: null as Sheet | null }, menus: 0, picks: [] as string[], submits: 0, done: () => vi.waitFor(() => expect(state.submits).toBe(1)).then(() => release()) };
    const names: { name: string; kind: "var"; time: number }[] = [];
    const session = {
      userNames: names,
      submit: () => new Promise<void>((res) => (state.submits++, (release = () => (names.push({ name: "A", kind: "var", time: 1 }), res())))),
    };
    const shell = {
      get sheet() { return state.shell.sheet; },
      userNames: () => names,
      settings: () => ({}),
      calc: { engine: {}, home: () => Promise.resolve({}) },
      showMenu: (title: string, items: Parameters<typeof matrixRows>[0] extends never ? never : unknown, opts: { loading?: () => Promise<void> | null; remember: boolean }) => {
        state.menus++;
        state.shell.sheet = new Sheet("list:matrix", title, () => items as never, opts);
      },
      picked: (p: { kind: string; sub?: unknown }) => void state.picks.push(String(state.shell.sheet?.level.title) + ":" + p.kind),
    };
    state.c = { shell, entry: {}, session } as unknown as MatrixCtx;
    return state;
  };
  const rowsOf = (s: Sheet): string[] => s.level.rows.map((r) => r.item.id);

  it("Esc before the store resolves: nothing reopens, nothing takes the keys", async () => {
    const st = setup();
    await showMatrix(st.c, index);
    const sheet = st.shell.sheet as Sheet;
    expect(rowsOf(sheet)).toEqual([MATRIX_NEW]);
    sheet.pickNumber(1);
    expect(sheet.level.loading()).not.toBeNull(); // keys wait while the store runs
    const menus = st.menus;
    st.shell.sheet = null; // Esc
    await st.done();
    await sheet.level.loading();
    await Promise.resolve();
    expect([st.shell.sheet, st.menus, st.picks]).toEqual([null, menus, []]);
  });

  it("New stored with the sheet still up: it opens again and the new matrix's own grid is picked", async () => {
    const st = setup();
    await showMatrix(st.c, index);
    const sheet = st.shell.sheet as Sheet;
    sheet.pickNumber(1);
    const hold = sheet.level.loading();
    await st.done();
    await hold;
    const now = st.shell.sheet as Sheet;
    expect([st.menus, now.depth, now.level.title]).toEqual([3, 2, "A"]); // the sheet opened again (empty, then with A), on A's grid
    expect(st.picks).toHaveLength(1);
  });

  it("a second New while the store runs does not store again", async () => {
    const st = setup();
    await showMatrix(st.c, index);
    const sheet = st.shell.sheet as Sheet;
    sheet.pickNumber(1);
    sheet.pickNumber(1);
    await st.done();
    await sheet.level.loading();
    expect(st.submits).toBe(1);
  });
});
