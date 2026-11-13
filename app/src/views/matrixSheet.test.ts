// SPDX-License-Identifier: GPL-3.0-or-later
// R187: Shift + 4's sheet: the eight matrix functions as its fixed rows 1 to 8, in this order, from G227's Find items.
// The generated index is needed (skipped like finder.test.ts when it is missing).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { itemRow } from "../find/finder.ts";
import { makeIndex } from "../find/testIndex.ts";
import type { FindItem, IndexItem } from "../find/types.ts";
import { matrixItems } from "./matrixSheet.ts";
import { Sheet } from "./sheet.svelte.ts";

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
