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
import { floatPathFacts } from "./numeric.ts";
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
});
