// SPDX-License-Identifier: GPL-3.0-or-later
// R361: the Plot's read of the stored names a definition uses (host.ts plotValues, plotValues.ts), against the real Giac
// build (skipped when none is found; nodeGiac.ts): each name's kind from the log and a variable's value from bridge-3's
// parts, with the σ and unit G371 keeps. Expected values derived (the values stored).
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";

describe.skipIf(!giacAvailable())("the Plot's read of stored names (R361)", () => {
  let host: EngineHost;
  beforeAll(async () => {
    const L = await loadNodeGiac();
    host = new EngineHost(L.giac, L.bridge);
  });
  const read = (...names: string[]) => host.plotValues(names, defaultHomeSettings);

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
