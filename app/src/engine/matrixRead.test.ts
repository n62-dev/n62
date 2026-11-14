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
    for (const input of ["M:=[[1/3,2],[3,4]]", "N:=[[-3,-9/2],[evalf(15/10^21),evalf(-9/2)]]", "k:=5", "S:=[[x,1.23456789012]]", "A:=[[1,2,3]]", "v:=[1,2]", "T:=[[x,evalf(sqrt(2))],[x+evalf(sqrt(2)),y]]"]) host.home(input, defaultHomeSettings);
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

  // R189: the grid's write-back reads each element as the log types a stored value (host.ts snapshot). By hand: Home
  // stores 1.23456789012 as the exact 30864197253/25000000000 (G14, above); a float as evalf(<exact>,k), k its digits.
  it("R189: the elements as typed text: exact ones exact, a float as evalf, and a matrix written from them reads back the same", () => {
    expect(host.matrices(["M"], defaultHomeSettings, "typed")[0]?.typed).toEqual(["1/3", "2", "3", "4"]);
    expect(host.matrices(["S"], defaultHomeSettings, "typed")[0]?.typed).toEqual(["x", "30864197253/25000000000"]);
    const t = host.matrices(["T"], defaultHomeSettings, "typed")[0]?.typed ?? [];
    expect(t).toHaveLength(4);
    expect(t[0]).toBe("x");
    expect(t[1]).toMatch(/^evalf\(.+,\d+\)$/); // (Home keeps that float at its P = 40 digits)
    host.home(`U:=[[${t[0]},${t[1]}],[${t[2]},${t[3]}]]`, defaultHomeSettings);
    expect(host.matrices(["U"], defaultHomeSettings, "typed")[0]?.typed).toEqual(t);
  });

  // R189 fix round 2: each element as LaTeX the line reads back (a number our own: Giac's latex() writes \mathrm{-3} and
  // 1.5e-20; a float marked, which the grid writes in approx()), and the check of the grid's store. By hand: -9/2 is
  // -\frac{9}{2}; 15/10^21 is 1.5·10⁻²⁰, which Giac prints 0.15e-19, written 0.15ᴇ-19 (Home keeps evalf's floats at
  // its P = 40 digits).
  it("R189: the elements as LaTeX: a number as the line types it, any other element by Giac, a float marked", () => {
    const m = host.matrices(["M"], defaultHomeSettings, "typed")[0];
    expect(m?.latex).toEqual([{ tex: "\\frac{1}{3}" }, { tex: "2" }, { tex: "3" }, { tex: "4" }]);
    const n = host.matrices(["N"], defaultHomeSettings, "typed")[0]?.latex ?? [];
    expect(n.slice(0, 2)).toEqual([{ tex: "-3" }, { tex: "-\\frac{9}{2}" }]);
    expect(n[2]).toMatchObject({ float: true });
    expect(n[2]?.tex).toMatch(/^0\.150*\\emark-19$/);
    expect(n[3]).toMatchObject({ float: true });
    expect(n[3]?.tex).toMatch(/^-4\.50*$/);
    const t = host.matrices(["T"], defaultHomeSettings, "typed")[0]?.latex ?? [];
    expect(t[0]).toEqual({ tex: "x", giac: true });
    expect(t[1]).toMatchObject({ float: true });
    expect(t[1]?.tex).toMatch(/^1\.41421356237309504880\d*$/);
    expect(t[2]).toMatchObject({ giac: true, float: true });
  });

  it("R189: the grid's store is checked, not run: a matrix of the same size passes with its elements typed; a ragged list, another size, a store or purge in a cell do not", () => {
    const check = (store: string) => host.matrices(["M"], defaultHomeSettings, "typed", store)[0]?.candidate;
    expect(check("M:=[[1/3,2],[9,4]]")).toEqual({ ok: true, typed: ["1/3", "2", "9", "4"] });
    for (const store of ["M:=[[1/3,2],[M,4]]", "M:=[[1/3,2],[[1,2],4]]", "M:=[[1,2,3]]", "M:=5"]) expect(check(store), store).toEqual({ ok: false, why: "shape" });
    for (const store of ["M:=[[1/3,2],[a:=5,4]]", "M:=[[1/3,2],[purge(k),4]]", "A:=[[1/3,2],[9,4]]"]) expect(check(store), store).toEqual({ ok: false, why: "store" });
    expect(host.home("a", defaultHomeSettings).result.display).toBe("a"); // nothing was stored
    expect(host.home("k", defaultHomeSettings).result.display).toBe("5"); // nor purged
    expect(host.matrices(["M"], defaultHomeSettings, "typed")[0]?.typed).toEqual(["1/3", "2", "3", "4"]); // M as it was
  });
});
