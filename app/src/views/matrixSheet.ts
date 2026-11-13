// SPDX-License-Identifier: GPL-3.0-or-later
// R187 (docs/04 5.3): Shift + 4, the matrix sheet. Its rows 1 to 8 are the matrix functions of G227, in this order and
// with a fixed digit each (docs/05 3.1; docs/06 section 3b: a fixed row keeps its digit). The rows are Find's items (their
// ids, syntax and preview), titled by the sheet; a pick goes in by Find's route (finder.ts putOnLine), not a second
// one. R188 adds the stored matrices after them. Part of Find's chunk (finder.ts showMatrix): no start-chunk code.
import type { MenuItem } from "../apps/types.ts";
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
