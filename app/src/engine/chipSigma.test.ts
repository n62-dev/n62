// SPDX-License-Identifier: GPL-3.0-or-later
// R61: EngineHost against the real Giac build (skipped when no build is found; see nodeGiac.ts): a chip with σ in Home.
// Its own file because host.test.ts is at its line in tools/line-baseline.yaml.
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { defaultHomeSettings, precisionFacts } from "./homeEval.ts";
import { decimalFromString, markOf, type FormatOptions } from "./format.ts";
import { uncDigitsOf } from "./constUnc.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";
import { chipOf } from "../state/results.ts";
import { chipFactsOf, homeItem } from "../state/resultItem.ts";

describe.skipIf(!giacAvailable())("EngineHost (real Giac)", () => {
  let host: EngineHost;
  beforeAll(async () => {
    const L = await loadNodeGiac();
    host = new EngineHost(L.giac, L.bridge);
  });

// R61 (r17 section 2): a unit result's chip with σ is an independent input of σ, as a constant (G26). t10's chip:
// 4936/125 m² with σ 1.24432953835 (tasks.yaml t10, first order, derived).
describe("a chip with σ (R61)", () => {
  const t10 = { value: "4936/125", reliableDigits: null, exact: false, unc: "1.24432953835" };
  const { unc: _u, ...plain } = t10;
  const G = { value: "6.67430E-11", unc: "0.00015E-11" };
  const home = (i: string, chips: Parameters<EngineHost["home"]>[3], consts?: Parameters<EngineHost["home"]>[2]) => host.home(i, defaultHomeSettings, consts, chips).result;
  const dec = (t: string) => decimalFromString(t)!;
  const o: FormatOptions = { format: "STD", digits: 12 };

  it("chip × 2: 78.976 ± 2.4886590767 (linear, derived), ≈ with uncDigits, never =", () => {
    const r = home("pasr_1*2", { "1": t10 });
    expect(r.display).toBe("78.976");
    expect(r.facts.uncDigits).toBe(uncDigitsOf(dec("78.976"), dec("2.4886590767"), 12));
    expect(markOf(precisionFacts(r), o)?.mark).toBe("≈");
  });

  it("chip + G·6.65E15: both σ counted in quadrature (derived)", () => {
    // 39.488 + 443840.95 = 443880.438; σ = sqrt(1.24432953835² + (1.5E-15·6.65E15)²) = sqrt(1.5483560 + 99.500625)
    // = 10.0523 (exponent 1), where either σ alone is below 10 (exponent 0): 4 digits hold, 5 with either alone
    const r = home("pasr_1+pasc_G*6.65E15", { "1": t10 }, { G });
    expect(r.display).toBe("443880.438");
    expect(r.facts.uncDigits).toBe(uncDigitsOf(dec("443880.438"), dec("10.0523"), 12));
    expect(r.facts.uncDigits).toBe(4);
    expect(home("pasr_1+pasc_G*6.65E15", { "1": plain }, { G }).facts.uncDigits).toBe(5);
  });

  it("a chip without unc keeps G49's path: the same result and facts, without uncDigits", () => {
    const same = (r: ReturnType<typeof home>) => ({ ...r, exactMs: 0, totalMs: 0 });
    const a = home("pasr_1*2", { "1": plain });
    expect("uncDigits" in a.facts).toBe(false);
    const b = home("pasr_1*2", { "1": t10 });
    const { uncDigits: d, uncSigma: _s, ...withoutUnc } = b.facts;
    expect(d).toBe(1); // a stub that drops unc fails here
    expect(same(a)).toEqual(same({ ...b, facts: withoutUnc }));
    // a σ of 0 is no uncertain input, as a constant's (G26)
    expect("uncDigits" in home("pasr_1*2", { "1": { ...t10, unc: "0" } }).facts).toBe(false);
  });

  // G355 (night review 2026-11-14, lo-1): a Home row's chip by the session's rule (state/results.ts chipOf) keeps the
  // row's σ. G·5.972ᴇ24·70/6371000² is 687.398139836 with σ 0.015448769; twice it is 1374.79627967 with σ 0.030897539
  // (oracle, mpmath: tools/probes/review-1114/vlo-oracle.py); uncDigits 5 (uncDigitsOf: exponent 3 minus σ's −2).
  it("a Home row's chip with σ, × 2: twice its σ, and the digits past it muted", () => {
    const row = home("pasc_G*5.972E24*70/6371000^2", undefined, { G });
    expect(row.display).toBe("687.398139836");
    expect(row.facts.uncDigits).toBe(4);
    const chip = chipOf({ status: "done", ...homeItem(row, true) })!;
    expect(chip.exact).toBe(false);
    const r = home("pasr_1*2", chipFactsOf({ "1": chip }));
    expect(r.display).toBe("1374.79627967");
    expect(Number(r.facts.uncSigma).toPrecision(8)).toBe("0.030897539");
    expect(r.facts.uncDigits).toBe(5);
    expect(markOf(precisionFacts(r), o)?.mark).toBe("≈");
  });

  it("an exact chip that says it has σ is still not exact: never =", () => {
    const r = home("pasr_1*2", { "1": { ...t10, exact: true } });
    expect(markOf(precisionFacts(r), o)?.mark).not.toBe("=");
    expect(r.facts.uncDigits).toBe(1);
  });
  // G274: a result from two or more uncertain inputs keeps each input's share of σ² (Home's budget). Derived: A·B,
  // A = 2 ± 0.1, B = 3 ± 0.2: ∂/∂A = B = 3 and ∂/∂B = A = 2, so uy = 0.3 and 0.4, t = 0.09 and 0.16.
  describe("σ's terms (G274)", () => {
    const chip = (v: string, u: string) => ({ value: v, reliableDigits: null, exact: false, unc: u });
    const near = (a: string | undefined, b: number) => expect(Number(a)).toBeCloseTo(b, 25);
    it("two σ chips: one term each, in input order, keyed by the chip's name", () => {
      const r = home("pasr_1*pasr_2", { "1": chip("2", "0.1"), "2": chip("3", "0.2") });
      expect(r.uncTerms?.map((t) => t.key)).toEqual(["pasr_1", "pasr_2"]);
      near(r.uncTerms?.[0]?.t, 0.09);
      near(r.uncTerms?.[0]?.uy, 0.3);
      near(r.uncTerms?.[1]?.t, 0.16);
      near(r.uncTerms?.[1]?.uy, 0.4);
      expect("uncTerms" in r.facts).toBe(false); // never in ValueFacts (the start chunk reads those)
      near(r.facts.uncSigma, 0.5);
      // input order, not name order
      expect(home("pasr_2*pasr_1", { "1": chip("2", "0.1"), "2": chip("3", "0.2") }).uncTerms?.map((t) => t.key)).toEqual(["pasr_2", "pasr_1"]);
    });
    it("one input alone: no terms (one row says nothing)", () => {
      expect(home("pasr_1*2", { "1": chip("2", "0.1") }).uncTerms).toBeUndefined();
    });
    it("a constant's key is its id, without pasc_ (as in the unit view)", () => {
      const r = home("pasc_a*pasr_1", { "1": chip("3", "0.2") }, { a: { value: "2", unc: "0.1" } });
      expect(r.uncTerms?.map((t) => t.key)).toEqual(["a", "pasr_1"]);
      near(r.uncTerms?.[0]?.t, 0.09);
    });
  });
});
});
