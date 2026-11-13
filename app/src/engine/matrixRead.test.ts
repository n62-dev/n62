// SPDX-License-Identifier: GPL-3.0-or-later
// R188 fix round 1: the matrix sheet reads the user's matrices through the bridge (matrixRead.ts), not from a printed
// text: which names hold one and their sizes, and the elements of one that holds a symbol, each number with Home's facts
// so the grid draws it with the Home formatter and its mark. Expected values (by hand): 1.23456789012 at 4 digits is
// 1.235, and Home reads that typed decimal as the exact 30864197253/25000000000 (G14), so it is exact, shown rounded (≈);
// sqrt(2) at 4 digits is 1.414, and evalf's float in a matrix that holds a symbol is unchecked (⚠, as Home marks the
// whole matrix [[x,1.414]], G27), so is a symbolic element that holds one (x+1.414); 1/3 is exact, shown rounded (≈).
import { beforeAll, describe, expect, it } from "vitest";
import type { EngineHost } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { formatComplex, markOf, type FormatOptions } from "./format.ts";
import type { MatrixCell } from "./matrixRead.ts";
import { giacAvailable, nodeHost } from "./nodeGiac.ts";

const shown = (c: MatrixCell | undefined, o: FormatOptions): [string, string | undefined] =>
  c === undefined ? ["", undefined] : "text" in c ? [c.text, c.unchecked ? "⚠" : undefined] : [formatComplex(c.value, o).text, markOf({ ...c.facts, value: c.value }, o)?.mark];

describe.skipIf(!giacAvailable())("R188: the stored matrices through the bridge", () => {
  let host: EngineHost;
  beforeAll(async () => {
    host = await nodeHost();
    for (const input of ["M:=[[1/3,2],[3,4]]", "k:=5", "S:=[[x,1.23456789012]]", "A:=[[1,2,3]]", "v:=[1,2]", "T:=[[x,evalf(sqrt(2))],[x+evalf(sqrt(2)),y]]"]) host.home(input, defaultHomeSettings);
  });

  it("lists the names that hold a matrix, in the order asked, with their sizes (a number, a vector: none)", () => {
    expect(host.matrices(["S", "k", "M", "v", "A", "nothere"], defaultHomeSettings, false)).toEqual([
      { name: "S", rows: 1, cols: 2 },
      { name: "M", rows: 2, cols: 2 },
      { name: "A", rows: 1, cols: 3 },
    ]);
  });

  it("a symbol and a float under Digits 4: the float in the app's digits, marked ⚠; the symbol as Giac prints it", () => {
    const s = { ...defaultHomeSettings, digits: 4 };
    const [m] = host.matrices(["S"], s, true);
    expect([m?.rows, m?.cols]).toEqual([1, 2]);
    const o: FormatOptions = { format: "STD", digits: 4 };
    expect(m?.cells?.map((c) => shown(c, o))).toEqual([
      ["x", undefined],
      ["1.235", "≈"],
    ]);
    const [t] = host.matrices(["T"], s, true);
    expect(t?.cells?.map((c) => shown(c, o))).toEqual([
      ["x", undefined],
      ["1.414", "⚠"],
      ["x+1.414", "⚠"],
      ["y", undefined],
    ]);
  });

  it("exact elements are exact: 1/3 shows rounded with ≈, the integers with =", () => {
    const [m] = host.matrices(["M"], defaultHomeSettings, true);
    const o: FormatOptions = { format: "STD", digits: 12 };
    expect(m?.cells?.map((c) => shown(c, o))).toEqual([
      ["0.333333333333", "≈"],
      ["2", "="],
      ["3", "="],
      ["4", "="],
    ]);
  });
});
