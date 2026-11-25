// SPDX-License-Identifier: GPL-3.0-or-later
// G805: casback's readers of Giac (tools/probes/casback/engine.ts) on the real engine: `phaseReader` reads a periodic function's argument
// as Giac's part `(expr)[i]…[1]` at the place the value's tree has it, so the tree's child order and Giac's indexing must agree.
import { beforeAll, describe, expect, it } from "vitest";
import { giacAvailable, loadNodeGiac } from "../src/engine/nodeGiac.ts";
import { phaseReader, realAt } from "../../tools/probes/casback/engine.ts";
import { checkSimplification, type At, type Phase, type Probe } from "../../tools/probes/casback/check.ts";

describe.skipIf(!giacAvailable())("casback's phase on the real engine (G805)", () => {
  let at: At;
  let phase: Phase;
  let probe: Probe;
  beforeAll(async () => {
    const loaded = await loadNodeGiac();
    at = realAt(loaded.bridge);
    phase = phaseReader(loaded.bridge, at);
    probe = (text) => ({ kind: loaded.bridge.value(text, []).kind, unresolved: false });
  });
  const rel = (got: number | null, want: number): number => (got === null ? NaN : got / want);

  it("reads the argument at the tree's place: a quotient, a sum, a negation inside a product", () => {
    expect(rel(phase("tan(x/6.02e-15)", "0.55"), 0.55 / 6.02e-15)).toBeCloseTo(1, 9); // about 9.1e13
    expect(rel(phase("sin(x)+tan(2*x)", "0.55"), 1.1)).toBeCloseTo(1, 9);
    expect(rel(phase("cos(-3*x)/x", "0.8"), 2.4)).toBeCloseTo(1, 9);
  });
  it("reads it under neg and inv, in a nested call and past the first part of a sum", () => {
    expect(rel(phase("-sin(x*1e9)", "0.55"), 5.5e8)).toBeCloseTo(1, 9);
    expect(rel(phase("1/tan(x/1e-9)", "0.55"), 5.5e8)).toBeCloseTo(1, 9);
    expect(rel(phase("x^2+3-cos(x*2e9)", "0.3"), 6e8)).toBeCloseTo(1, 9);
    expect(rel(phase("sin(cos(x)*1e9)", "0.55"), Math.cos(0.55) * 1e9)).toBeCloseTo(1, 9);
    expect(phase("x^2+exp(x)", "0.55")).toBe(0);
  });
  it("the nightly's tan(x/6.02e-15) is not checkable; a simplification that is wrong under 10^8 still fails", () => {
    const v = checkSimplification("tan(x/6.02e-15)", "tan(50000000000000000/301*x)", at, probe, phase);
    expect(v.status).toBe("skip");
    expect(v.detail).toMatch(/^a periodic function's argument is 9\.1\de\+13 at x=/);
    expect(checkSimplification("tan(x)", "tan(2*x)", at, probe, phase).status).toBe("wrong");
    expect(checkSimplification("sin(x)+tan(2*x)", "sin(x)+tan(2*x)+1e-3", at, probe, phase).status).toBe("wrong");
  });
});
