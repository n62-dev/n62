// SPDX-License-Identifier: GPL-3.0-or-later
// G276: a set's step as one closed expression over the inputs, on the real engine through buildJob and the worker's
// evaluator (EngineHost.units, as units/evaluate.test.ts; skipped without a build, see nodeGiac.ts), on a hand-made slice
// of Find's table. Expected values are derived: the first-order part from the derivatives in each row, the second-order
// part (GUM 5.1.2 note, as units/evaluate.ts computes it) worked out in the comment beside it.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { closedRequest, MAX_CLOSED, runStep, type Evaluate } from "./closed.ts";
import type { FormulaSet } from "./model.ts";
import { EngineHost } from "../engine/host.ts";
import { defaultHomeSettings } from "../engine/homeEval.ts";
import { giacAvailable, loadNodeGiac } from "../engine/nodeGiac.ts";
import type { IndexItem } from "../find/types.ts";
import { buildJob } from "../units/build.ts";
import { factorTable } from "../units/factors.ts";
import { isUnitError, type Quantity } from "../units/types.ts";

const item = (kind: string, id: string, x: Record<string, unknown>): IndexItem =>
  ({ id: `${kind}:${id}`, kind, names: [id], title: id, tier: 0, insert: "", ...x }) as unknown as IndexItem;
const TABLE = factorTable([
  item("unit", "K", { dim: "K1", si: "1" }), item("unit", "oC", { dim: "K1", si: "1+5463/20" }),
  item("unit", "m", { dim: "m1", si: "1" }), item("pfx", "c", { si: "1/100" }),
]);
const M = { tokens: [{ unit: "m" }] };
const C = { tokens: [{ unit: "oC" }] };
const CM2 = { tokens: [{ prefix: "c", unit: "m", power: "2" }] };

/** L = 2 ± 0.01 m, M = L², P = M·L, R = M/L: P and R share L with M. */
const CHAIN: FormulaSet = {
  name: "chain",
  inputs: [{ name: "L", value: "2", sigma: "0.01", slot: M }],
  steps: [{ name: "M", expr: "L^2" }, { name: "P", expr: "M*L" }, { name: "R", expr: "M/L" }],
};
/** A beam's bending stress, q·L²/8 over W; L has a unit, q and W none. */
const BEAM: FormulaSet = {
  name: "beam",
  inputs: [{ name: "q", value: "10", sigma: "0.1" }, { name: "L", value: "2", sigma: "0.01", slot: M }, { name: "W", value: "5", sigma: "0.05" }],
  steps: [{ name: "M", expr: "q*L^2/8" }, { name: "S", expr: "M/W" }],
};

describe("G276 closedRequest", () => {
  it("each step it reads in brackets, each input once by its key, the outer brackets dropped", () => {
    expect(closedRequest(CHAIN, "P")).toEqual({ formula: "((pasupm(2,0.01,pasr_1)*pasu1)^2)*(pasupm(2,0.01,pasr_1)*pasu1)", slots: [M] });
  });
  it("only the inputs the step reads get a slot; an input without σ is a number, one without a unit has no slot", () => {
    const set: FormulaSet = { name: "s", inputs: [{ name: "a", value: "3", slot: M }, { name: "b", value: "4", sigma: "0.1" }, { name: "c", value: "5", slot: M }], steps: [{ name: "X", expr: "b*c" }] };
    expect(closedRequest(set, "X")).toEqual({ formula: "(pasupm(4,0.1,pasr_2))*(5*pasu1)", slots: [M] });
  });
  it("a step not in the set, stepOrder's refusals and a text that doubles past MAX_CLOSED are refused", () => {
    expect(closedRequest(CHAIN, "Z")).toEqual({ error: "nostep", step: "Z" });
    const cycle: FormulaSet = { name: "c", inputs: [], steps: [{ name: "A", expr: "B" }, { name: "B", expr: "A" }] };
    expect(closedRequest(cycle, "A")).toEqual({ error: "cycle", steps: ["A", "B"] });
    const steps = [{ name: "S0", expr: "x" }, ...Array.from({ length: 40 }, (_, k) => ({ name: `S${k + 1}`, expr: `S${k}*S${k}` }))];
    const big: FormulaSet = { name: "b", inputs: [{ name: "x", value: "2" }], steps };
    expect(closedRequest(big, "S40")).toEqual({ error: "long", step: "S40" });
    // the steps the asked one does not read are not built
    expect(closedRequest(big, "S1")).toEqual({ formula: "((2))*((2))", slots: [] });
    expect(MAX_CLOSED).toBeGreaterThan(1000);
  });
  it("an input in °C with another input in the step: the builder's refusal, step and input named, no job runs", async () => {
    const set: FormulaSet = { name: "t", inputs: [{ name: "T", value: "20", sigma: "0.5", slot: C }, { name: "d", value: "3", slot: M }], steps: [{ name: "X", expr: "T*d" }] };
    const evaluate = vi.fn<Evaluate>();
    expect(await runStep(set, "X", TABLE, evaluate)).toEqual({ error: "temperature", unit: "oC", step: "X", input: "T" });
    expect(evaluate).not.toHaveBeenCalled();
  });
  it("an input in °C alone in a step, through two steps too: accepted by buildJob", () => {
    const set: FormulaSet = { name: "t", inputs: [{ name: "T", value: "20", sigma: "0.5", slot: C }, { name: "U", value: "-5", slot: C }], steps: [{ name: "A", expr: "T", end: { tokens: [{ unit: "K" }] } }, { name: "B", expr: "(A)" }, { name: "V", expr: "U" }] };
    for (const step of ["A", "B", "V"]) {
      const req = closedRequest(set, step);
      if ("error" in req) throw new Error(JSON.stringify(req));
      expect(isUnitError(buildJob(req, TABLE)), step).toBe(false);
    }
  });
});

describe.skipIf(!giacAvailable())("G276 runStep (real Giac)", () => {
  let host: EngineHost;
  beforeAll(async () => {
    const L = await loadNodeGiac();
    host = new EngineHost(L.giac, L.bridge);
  });
  const evaluate: Evaluate = (job) => host.units(job, defaultHomeSettings);
  const run = async (set: FormulaSet, step: string): Promise<Quantity> => {
    const q = await runStep(set, step, TABLE, evaluate);
    if ("error" in q) throw new Error(JSON.stringify(q));
    return q;
  };

  it("P = M·L with M = L²: L³, σ 0.12 (as a chip M would give 0.089), one term pasr_1", async () => {
    // f = L³ at 2: f′ = 12, so (12·0.01)² = 0.0144; second = (½·f″² + f′·f‴)·u⁴ = (½·12² + 12·6)·10⁻⁸ = 1.44·10⁻⁶;
    // σ = √0.01440144 = 0.12000600 (a chip M = 4 ± 0.04: √((2·0.04)² + (4·0.01)²) = 0.0894)
    const q = await run(CHAIN, "P");
    expect(q.value.display).toBe("8");
    expect(q.unc?.text).toBe("0.12");
    expect(q.unc?.terms?.map((t) => t.key)).toEqual(["pasr_1"]);
  });
  it("R = M/L with M = L²: L, σ 0.010 (as a chip M would give 0.022), one term", async () => {
    // f = L: f′ = 1, the rest 0: σ = 0.01 exactly (a chip M: √((0.04/2)² + (4/2²·0.01)²) = 0.0224)
    const q = await run(CHAIN, "R");
    expect(q.value.display).toBe("2");
    expect(q.unc?.text).toBe("0.010");
    expect(q.unc?.terms?.length).toBe(1);
  });
  it("M = L²: 4, σ 0.040", async () => {
    // f′ = 4: (4·0.01)² = 0.0016; second = ½·2²·10⁻⁸ = 2·10⁻⁸; σ = √0.00160002 = 0.04000025
    const q = await run(CHAIN, "M");
    expect(q.value.display).toBe("4");
    expect(q.unc?.text).toBe("0.040");
  });
  it("beam S = M/W with M = q·L²/8: 1, σ 0.017, three terms, one for L", async () => {
    // f = q·L²/(8W) at 10, 2, 5: ∂f/∂q = 0.1, ∂f/∂L = 1, ∂f/∂W = −0.2; each (∂f·u)² = 10⁻⁴, so 3·10⁻⁴; second, from the
    // second derivatives (qL 0.1, qW −0.02, LL 0.5, LW −0.04, WW 0.08) and the third f_ijj (qLL 0.05, qWW 0.008, LWW 0.08,
    // WLL −0.1, WWW −0.048): Σ (½·f_ij² + f_i·f_ijj)·u_i²·u_j² = 129/800000000; σ = √0.00030016125 = 0.0173252
    const q = await run(BEAM, "S");
    expect(q.value.display).toBe("1");
    expect(q.unc?.text).toBe("0.017");
    expect(q.unc?.terms?.map((t) => t.key)).toEqual(["pasr_1", "pasr_2", "pasr_3"]);
  });
  it("an input without σ stays a number: no term for it", async () => {
    const set: FormulaSet = { name: "n", inputs: [{ name: "a", value: "3" }, { name: "L", value: "2", sigma: "0.01", slot: M }], steps: [{ name: "X", expr: "a*L" }, { name: "Y", expr: "X*a" }] };
    // f = a²·L at a = 3: ∂f/∂L = 9, σ = 0.09
    const q = await run(set, "Y");
    expect(q.value.display).toBe("18");
    expect(q.unc?.terms?.map((t) => t.key)).toEqual(["pasr_2"]);
    expect(q.unc?.text).toBe("0.090");
  });
  it("a dimension mismatch in a step: the evaluator's refusal names the step", async () => {
    const set: FormulaSet = { name: "d", inputs: CHAIN.inputs, steps: [{ name: "M", expr: "L^2" }, { name: "S", expr: "M+L" }] };
    expect(await runStep(set, "S", TABLE, evaluate)).toMatchObject({ step: "S", error: "dimension" });
  });
  it("a step's end slot is applied to that step only, not to the steps it is built on", async () => {
    const set: FormulaSet = { ...CHAIN, steps: [{ name: "M", expr: "L^2", end: CM2 }, { name: "P", expr: "M*L" }] };
    const m = await run(set, "M");
    expect([m.value.display, m.unit, m.unc?.text]).toEqual(["40000", "cm²", "400"]);
    const p = await run(set, "P");
    expect([p.value.display, p.unc?.text]).toEqual(["8", "0.12"]);
    expect(p.unit).not.toBe("cm²");
  });
  it("an input in °C alone runs: 20 ± 0.5 °C is 293.15 K, σ 0.50", async () => {
    const set: FormulaSet = { name: "t", inputs: [{ name: "T", value: "20", sigma: "0.5", slot: C }], steps: [{ name: "A", expr: "T", end: { tokens: [{ unit: "K" }] } }] };
    const q = await run(set, "A");
    expect([q.value.display, q.unc?.text]).toEqual(["293.15", "0.50"]);
  });
});
