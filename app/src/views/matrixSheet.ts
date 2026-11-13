// SPDX-License-Identifier: GPL-3.0-or-later
// R187 (docs/04 5.3): Shift + 4, the matrix sheet. Its rows 1 to 8 are the matrix functions of G227, in this order and
// with a fixed digit each (docs/05 3.1; docs/06 section 3b: a fixed row keeps its digit). The rows are Find's items (their
// ids, syntax and preview), titled by the sheet; a pick goes in by Find's route (finder.ts putOnLine), not a second
// one. R188: row 9 is New (R190's, disabled here with its reason, so no digit moves when it lands), and the stored
// matrices follow from row 10: their list changes, so they come last (key 0 picks the first). A chunk of its own, loaded
// by finder.ts showMatrix on the first Shift + 4 (the Find chunk and the start chunk carry none of it).
import type { AppShell } from "../apps/shell.svelte.ts";
import type { MenuItem, SubMenu } from "../apps/types.ts";
import type { EntryController } from "../entry/controller.ts";
import { itemRow, putOnLine, type FindIndex } from "../find/finder.ts";
import { MatrixGrid, textsQuery } from "./matrixGrid.svelte.ts";
import { findText as t, type FindMessageKey } from "../i18n/enFind.ts";
import type { FindItem } from "../find/types.ts";

/** The fixed rows: the Find item ids and the sheet's title of each (i18n/enFind.ts `matrix.<name>`). */
export const MATRIX_ROWS: readonly { readonly id: string; readonly title: FindMessageKey }[] = [
  { id: "fn:tran", title: "matrix.tran" },
  { id: "fn:dot", title: "matrix.dot" },
  { id: "fn:cross", title: "matrix.cross" },
  { id: "fn:norm", title: "matrix.norm" },
  { id: "fn:rref", title: "matrix.rref" },
  { id: "fn:eigenvals", title: "matrix.eigenvals" },
  { id: "fn:det", title: "matrix.det" },
  { id: "fn:inv", title: "matrix.inv" },
];

/** The sheet's function rows. `row` makes the sheet row of a Find item (finder.ts itemRow with the pick). An id missing
 *  from the index leaves its row out (a functions-only or old index never loses the others). */
export function matrixItems(byId: ReadonlyMap<string, FindItem>, row: (it: FindItem) => MenuItem): MenuItem[] {
  return MATRIX_ROWS.flatMap(({ id, title }) => {
    const it = byId.get(id);
    return it === undefined ? [] : [{ ...row(it), label: t(title) }];
  });
}

/** Row 9's id: New (R190); drawn disabled with its reason until then. */
export const MATRIX_NEW = "matrix:new";

/** A variable that holds a matrix, as the engine sized it. */
export interface StoredMatrix {
  readonly name: string;
  readonly rows: number;
  readonly cols: number;
}

/** The whole sheet: the function rows (1 to 8), New (9), then the stored matrices in the order given, each a level
 *  of its own (`grid`: the matrix grid, views/matrixGrid.svelte.ts). */
export function matrixRows(byId: ReadonlyMap<string, FindItem>, row: (it: FindItem) => MenuItem, stored: readonly StoredMatrix[], grid: (m: StoredMatrix) => SubMenu): MenuItem[] {
  return [
    ...matrixItems(byId, row),
    { id: MATRIX_NEW, label: t("matrix.new"), disabled: true, reason: t("matrix.newLater") },
    ...stored.map((m) => ({ id: `matrix:${m.name}`, label: m.name, value: `${m.rows}×${m.cols}`, submenu: grid(m) })),
  ];
}

/** One engine call for the variables `names`: the size of each that holds a matrix, else 0. */
export function shapesQuery(names: readonly string[]): string {
  return `[${names.map((n) => `when(is_matrix(${n}),dim(${n}),0)`).join(",")}]`;
}

/** The engine's answer to shapesQuery: the names that hold a matrix, in the order asked. An answer that is not one
 *  entry per name (an error, a fake engine's echo) lists none. */
export function storedMatrices(names: readonly string[], answer: string): StoredMatrix[] {
  let read: unknown;
  try {
    read = JSON.parse(answer);
  } catch {
    return [];
  }
  if (!Array.isArray(read) || read.length !== names.length) return [];
  return names.flatMap((name, i) => {
    const d: unknown = read[i];
    if (!Array.isArray(d) || d.length !== 2) return [];
    const [rows, cols] = d as unknown[];
    return typeof rows === "number" && typeof cols === "number" && rows > 0 && cols > 0 ? [{ name, rows, cols }] : [];
  });
}

/** Shift + 4 (finder.ts showMatrix): the sheet, with the stored matrices the one stored last first: the variables of the
 *  definitions log, of which one engine call keeps those that hold a matrix (none stored: no call). The sheet opens at
 *  once with its fixed rows, and keys wait while the call runs (Level.loading); with matrices, the full sheet then takes
 *  its place; the promise resolves then. Each matrix's row opens its grid (matrixGrid.svelte.ts). */
export function showMatrix(shell: AppShell, entry: EntryController, index: FindIndex): Promise<void> {
  const names = shell.userNames().filter((n) => n.kind === "var").sort((a, b) => b.time - a.time).map((n) => n.name);
  const row = (it: FindItem): MenuItem => itemRow(it, (p) => putOnLine(entry, p));
  const grid = (m: StoredMatrix): SubMenu => ({
    title: m.name,
    items: [],
    grid: new MatrixGrid(m.name, shell.settings, () => shell.calc.home(m.name, shell.settings()), async () => {
      const r = await shell.calc.cas(textsQuery(m.name), shell.settings());
      return r.ok ? r.text : "";
    }),
  });
  const open = (stored: readonly StoredMatrix[], loading?: () => Promise<void> | null): void =>
    shell.showMenu(t("matrix.title"), matrixRows(index.byId, row, stored, grid), { remember: false, ...(loading ? { loading } : {}) });
  if (names.length === 0) return Promise.resolve(open([]));
  let pending: Promise<void> | null = null;
  open([], () => pending);
  const first = shell.sheet;
  return (pending = shell.calc
    .cas(shapesQuery(names), shell.settings())
    .then((r) => (r.ok ? storedMatrices(names, r.text) : []), () => [])
    .then((stored) => {
      pending = null;
      if (stored.length > 0 && shell.sheet === first) open(stored); // (not when Esc closed it meanwhile)
    }));
}
