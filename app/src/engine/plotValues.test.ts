// SPDX-License-Identifier: GPL-3.0-or-later
// R361: the Plot's read of the stored names a definition uses (host.ts plotValues, plotValues.ts), against the real Giac
// build (skipped when none is found; nodeGiac.ts): each name's kind from the log and a variable's value from bridge-3's
// parts, with the σ and unit G371 keeps. R361f1: the names come from Giac's tree of each slot's text (bridge-2, G99),
// so a bound name (the sum's k, the integral's t) is no read. Expected values derived (the values stored).
import { beforeAll, describe, expect, it } from "vitest";
import { compileDefinition } from "../apps/function/compile.ts";
import { drawValues, nameRead, noteOf, usesOf } from "../apps/function/stored.ts";
import { EngineHost } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";

describe.skipIf(!giacAvailable())("the Plot's read of stored names (R361)", () => {
  let host: EngineHost;
  beforeAll(async () => {
    const L = await loadNodeGiac();
    host = new EngineHost(L.giac, L.bridge);
  });
  /** Each name as a text of its own (a slot's Giac text that reads it alone). */
  const read = (...names: string[]) => host.plotValues(names, defaultHomeSettings).flat();

  it("A = 3: kind var and the number 3 from the bridge's parts", () => {
    host.home("A:=3", defaultHomeSettings);
    expect(read("A")).toEqual([{ name: "A", kind: "var", re: 3, im: 0 }]);
  });
  it("R = 4700 and a rational 1/3: their numbers", () => {
    host.home("R:=4700", defaultHomeSettings);
    host.home("Q:=1/3", defaultHomeSettings);
    const [r, q] = read("R", "Q");
    expect(r).toMatchObject({ kind: "var", re: 4700, im: 0 });
    expect(q?.re).toBeCloseTo(1 / 3, 15);
  });
  it("A stored as 3 ± 0.1 (G371, a constant with σ): 3 and its σ", () => {
    host.home("A:=pasc_K", defaultHomeSettings, { K: { value: "3", unc: "0.1" } });
    const [a] = read("A");
    expect(a).toMatchObject({ name: "A", kind: "var", re: 3, im: 0 });
    expect(Number(a?.sigma)).toBeCloseTo(0.1, 12);
  });
  it("a complex, a list and a matrix: no real number (a complex has its imaginary part, the others no parts)", () => {
    host.home("B:=1+2*i", defaultHomeSettings);
    host.home("L:=[1,2]", defaultHomeSettings);
    host.home("M:=[[1,2],[3,4]]", defaultHomeSettings);
    const [b, l, m] = read("B", "L", "M");
    expect(b).toMatchObject({ kind: "var", re: 1, im: 2 });
    expect(l).toEqual({ name: "L", kind: "var" });
    expect(m).toEqual({ name: "M", kind: "var" });
  });
  it("a user function is kind fn with no value; a name never stored is none", () => {
    host.home("g(x):=x+1", defaultHomeSettings);
    expect(read("g", "W")).toEqual([
      { name: "g", kind: "fn" },
      { name: "W", kind: "none" },
    ]);
  });
});

describe.skipIf(!giacAvailable())("R361f1: the names a slot reads, from Giac's tree of its text", () => {
  let host: EngineHost;
  beforeAll(async () => {
    const L = await loadNodeGiac();
    host = new EngineHost(L.giac, L.bridge);
  });
  /** What the Plot does with a slot: its Giac text to the host, compiled again with the answer; its notes. */
  const plot = (latex: string) => {
    const giac = compileDefinition(latex).giac;
    const answer = host.plotValues([giac], defaultHomeSettings);
    expect(answer).toHaveLength(1);
    const reads = new Map((answer[0] ?? []).map((v) => [v.name, nameRead(v)]));
    const c = compileDefinition(latex, "rad", drawValues(reads), usesOf(answer[0] ?? []));
    const notes = (c.uses ?? []).flatMap((n) => noteOf("F1", n, reads.get(n)!, c.fn !== undefined, String, String) ?? []);
    return { names: (answer[0] ?? []).map((v) => v.name), c, notes };
  };
  const BOUND = ["\\sum_{k=1}^{5}x^{k}", "\\int_0^x t\\,dt", "\\frac{d}{dt}(t^2 x)", "\\lim_{t\\to 0}\\frac{\\sin(tx)}{t}"];

  it("the sum in k, the integral in t, d/dt and the limit in t read no stored name and give no note", () => {
    for (const l of BOUND) {
      const p = plot(l);
      expect(p.names, l).toEqual([]);
      expect(p.c.uses, l).toBeUndefined();
      expect(p.notes, l).toEqual([]);
    }
  });
  it("control: k and t stored as 3 change nothing", () => {
    host.home("k:=3", defaultHomeSettings);
    host.home("t:=3", defaultHomeSettings);
    for (const l of BOUND) expect(plot(l), l).toMatchObject({ names: [], notes: [] });
  });
  it("A·x² with A = 3 still draws at 3, with no note", () => {
    host.home("A:=3", defaultHomeSettings);
    const p = plot("A\\cdot x^{2}");
    expect(p.names).toEqual(["A"]);
    expect(p.c.fn?.(1)).toBe(3);
    expect(p.notes).toEqual([]);
  });
  it("a stored theta and a stored e: read by their engine names (theta, e_), drawn at their values", () => {
    host.home("theta:=2", defaultHomeSettings);
    host.home("e_:=5", defaultHomeSettings);
    const th = plot("\\theta x");
    expect(th.names).toEqual(["theta"]);
    expect(th.c.fn?.(1)).toBe(2);
    const e = plot("e x");
    expect(e.names).toEqual(["e_"]);
    expect(e.c.fn?.(1)).toBe(5);
  });
  it("Giac's own constants and the degree factor are no read: π·sin(x) reads nothing", () => {
    expect(plot("\\pi\\sin\\left(x\\right)").names).toEqual([]);
  });
});
