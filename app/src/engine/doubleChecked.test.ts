// SPDX-License-Identifier: GPL-3.0-or-later
// G782 fix round 2 (G140): the double fallbacks of a Home input (the float path after a time-out, G71's decision at the
// double) against the real Giac build. student_icdf(i,0.5) is Giac's own double (ν = i is no distribution, the polish
// refuses it): -1.8888…E-19 at Digits 14, -1.9042…E-19 at 30, noise from the 10th digit on each call. The exact path
// confirms 2 digits (D at 14 against M at P, floatFacts); under load the clock sent one angle mode down the float path,
// which showed 12 digits of noise (the gate's invariant (a), runs 1274 and 1475). Derived: the two agree in "1.9" and
// differ at the 3rd digit (1.89 against 1.90), so 2 digits, the exact path's count.
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { decidedAtDouble } from "./decisions.ts";
import { floatFacts, floatPathFacts, type Giac } from "./numeric.ts";
import { formatComplex } from "./format.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";

describe.skipIf(!giacAvailable())("a double that differs from Giac's own double confirms their shared digits (real Giac)", () => {
  let host: EngineHost;
  beforeAll(async () => {
    const L = await loadNodeGiac();
    host = new EngineHost(L.giac, L.bridge);
  });
  const INPUT = "student_icdf(i,0.5)";
  const shown = (f: { value: Parameters<typeof formatComplex>[0]; reliableDigits: number | null }) =>
    formatComplex(f.value, { format: "STD", digits: f.reliableDigits !== null && f.reliableDigits < 12 ? f.reliableDigits : 12 }).text;

  it("the exact path: ⚠2 -1.9E-19 (the count both fallbacks must give)", () => {
    const r = host.home(INPUT, defaultHomeSettings).result;
    expect([r.display, r.facts.reliableDigits, r.facts.warn]).toEqual(["-1.9E-19", 2, "unaudited"]);
  });

  it("the float path (a time-out): 2 digits, -1.9E-19, not 13 of noise", () => {
    const f = floatPathFacts(host.giac, "pasg782", INPUT, false, 30, 12);
    host.giac.eval("purge(pasg782)");
    if ("error" in f) throw new Error(f.error);
    expect(f.facts.map((x) => [x.reliableDigits, x.warn, shown(x)])).toEqual([[2, "unaudited", "-1.9E-19"]]);
  });

  it("G71's decision at the double, with a number at P after all: 2 digits, not 12", () => {
    const d = decidedAtDouble(host.giac, "pasg782", INPUT, 12);
    host.giac.eval("purge(pasg782)");
    expect(d && "facts" in d ? d.facts.map((x) => [x.reliableDigits, x.warn, shown(x)]) : d).toEqual([[2, "unaudited", "-1.9E-19"]]);
  });

  it("a double Giac gives at every precision keeps its count (BesselJ: an error at P, round's 12 digits stay)", () => {
    const d = decidedAtDouble(host.giac, "pasg782", "round(BesselJ(1,2)*10^12)", 12);
    host.giac.eval("purge(pasg782)");
    expect(d && "facts" in d ? d.facts.map((x) => x.reliableDigits) : d).toEqual([12]);
  });

  // G783 fix round 1 (run 1494, invariant (a): RAD ⚠ -1.8888430502E-19, DEG ⚠2 -1.9E-19): on the exact path the unaudited
  // branch reads the double D and the value M at P; when Giac's interrupt stopped one of them (its clock: a host stall
  // under load), the other was taken alone with min(digits, 14) digits, 12 of noise. A stopped read is read once more.
  // The stop is Giac's own (a step budget of 3 for that one call); a budget that stops it again keeps the lone value.
  const stopOnce = (prefix: string, times = 1): Giac => {
    const g = host.giac;
    let left = times;
    return {
      eval: (s) => g.eval(s),
      digits: g.digits?.bind(g),
      value: (t, p, tree) => {
        if (left <= 0 || !t.startsWith(prefix)) return g.value(t, p, tree);
        left--;
        g.eval("ckbudget 3");
        try {
          return g.value(t, p, tree);
        } finally {
          g.eval("ckbudget 0");
        }
      },
    };
  };
  const exactPath = (giac: Giac) => {
    host.home(INPUT, defaultHomeSettings);
    const f = floatFacts(giac, "pasans", INPUT, { kind: "scalar" }, 12, 12, INPUT);
    return f?.map((x) => [x.reliableDigits, x.warn, shown(x)]);
  };

  it("the exact path with its read at P stopped once: 2 digits, -1.9E-19, not the double's 12", () => {
    expect(exactPath(stopOnce("pasm:=(student_icdf("))).toEqual([[2, "unaudited", "-1.9E-19"]]);
  });

  it("the exact path with its double read stopped once: 2 digits, -1.9E-19, not 12 at P", () => {
    expect(exactPath(stopOnce("pasd:=(student_icdf("))).toEqual([[2, "unaudited", "-1.9E-19"]]);
  });

  it("a stop that repeats (the step budget) keeps the lone value, as before", () => {
    expect(exactPath(stopOnce("pasd:=(student_icdf(", 2))?.map((x) => x[0])).toEqual([12]);
  });
});
