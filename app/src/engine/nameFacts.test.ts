// SPDX-License-Identifier: GPL-3.0-or-later
// G371: a name stored from a result keeps its σ and its unit (engine/nameSigma.ts), against the real Giac build (skipped
// when no build is found; see nodeGiac.ts). Expected values: G·5.972ᴇ24·70/6371000² is ≈ 687.398139836, σ 0.015448769,
// uncDigits 4; twice it is 1374.79627967 with σ 0.030897539 (oracle, mpmath: tools/probes/review-1114/vlo-oracle.py;
// tests/golden/home.yaml g355-seq-chip-sigma-G-x2), uncDigits 5 (derived, constUnc.ts uncDigitsOf: exponent 3 minus σ's
// −2). The unit chip's σ 3.5 N is 0.05 m/s² × 70 kg (derived).
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { defaultHomeSettings, precisionFacts } from "./homeEval.ts";
import { markOf } from "./format.ts";
import { applyDefChanges, type DefEntry } from "./defs.ts";
import { validDefs } from "./defsCheck.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";
import { chipOf } from "../state/results.ts";
import { chipFactsOf, homeItem } from "../state/resultItem.ts";
import type { ChipTable } from "../input/chips.ts";

describe.skipIf(!giacAvailable())("a stored name keeps its σ and unit (G371)", () => {
  let host: EngineHost;
  let log: DefEntry[] = [];
  beforeAll(async () => {
    const L = await loadNodeGiac();
    host = new EngineHost(L.giac, L.bridge);
  });
  const G = { value: "6.67430E-11", unc: "0.00015E-11" };
  const ROW = "pasc_G*5.972E24*70/6371000^2";
  const home = (i: string, consts?: Parameters<EngineHost["home"]>[2], chips?: ChipTable) => {
    const out = host.home(i, defaultHomeSettings, consts, chips && chipFactsOf(chips));
    log = applyDefChanges(log, out.defs);
    return out.result;
  };
  const entry = (name: string) => log.find((e) => e.name === name);
  const sigma8 = (t: string | undefined) => (t === undefined ? undefined : Number(t).toPrecision(8));
  const mark = (r: ReturnType<typeof home>) => markOf(precisionFacts(r), { format: "STD", digits: 12 })?.mark;

  it("a row with σ, its chip ▶ W: W holds the row's σ, and W × 2 shows twice it with the digits past it muted", () => {
    const row = home(ROW, { G });
    expect(row.facts.uncDigits).toBe(4);
    const chip = chipOf({ status: "done", ...homeItem(row, true) })!;
    home("W:=pasr_1", undefined, { "1": chip });
    expect(sigma8(entry("W")?.facts?.uncSigma)).toBe("0.015448769");
    expect(entry("W")?.facts?.uncDigits).toBe(4);
    const r = home("W*2");
    expect(r.display).toBe("1374.79627967");
    expect(sigma8(r.facts.uncSigma)).toBe("0.030897539");
    expect(r.facts.uncDigits).toBe(5);
    expect(mark(r)).toBe("≈");
  });

  it("the row stored by name (G·…▶V) keeps σ too, and a chain step from it (V·2 ▶ M) carries σ on", () => {
    home(`V:=${ROW}`, { G });
    expect(sigma8(entry("V")?.facts?.uncSigma)).toBe("0.015448769");
    home("M:=V*2");
    expect(sigma8(entry("M")?.facts?.uncSigma)).toBe("0.030897539");
    expect(entry("M")?.facts?.uncDigits).toBe(5);
  });

  it("a store to a name its right side reads keeps σ (W:=W·2 is twice W's), taken at the value read", () => {
    home(`W:=${ROW}`, { G });
    expect(sigma8(entry("W")?.facts?.uncSigma)).toBe("0.015448769");
    home("W:=W*2");
    expect(sigma8(entry("W")?.facts?.uncSigma)).toBe("0.030897539");
    expect(entry("W")?.facts?.uncDigits).toBe(5);
  });

  it("a name a called program sets again (p() stores W, A:=p()·W) gives a result, and W's old σ is not claimed", () => {
    home(`W:=${ROW}`, { G });
    expect(home("p():={W:=1;return 2;}").ok).toBe(true);
    const r = home("A:=p()*W");
    expect(r.ok).toBe(true);
    expect(r.facts.uncSigma).toBeUndefined();
    expect(entry("A")?.facts?.uncSigma).toBeUndefined();
  });

  it("a unit result's chip ▶ F: F holds its unit (dimension, slot) and σ; a stored log keeps them", () => {
    const unit = { text: "N", dim: "kg1m1s-2", slot: { tokens: [{ unit: "N" }] } };
    home("F:=pasr_1", undefined, { "1": { value: "68670/100", exact: false, reliableDigits: null, unc: "3.5", unit } });
    expect(entry("F")?.unit).toEqual(unit);
    expect(Number(entry("F")?.facts?.uncSigma)).toBe(3.5);
    const back = validDefs(JSON.parse(JSON.stringify(log))).find((e) => e.name === "F");
    expect(back?.unit).toEqual(unit);
    expect(Number(back?.facts?.uncSigma)).toBe(3.5);
    // a unit chip without σ (9.81 m/s² × 70 kg): the unit alone
    home("F0:=pasr_1", undefined, { "1": { value: "68670/100", exact: true, reliableDigits: null, unit } });
    expect(entry("F0")?.unit).toEqual(unit);
    // Home has no units: a product of the chip is a number, and a copy of F keeps F's unit
    home("F2:=pasr_1*2", undefined, { "1": { value: "68670/100", exact: true, reliableDigits: null, unit } });
    expect(entry("F2")?.unit).toBeUndefined();
    home("F3:=F");
    expect(entry("F3")?.unit).toEqual(unit);
  });

  it("controls: an exact value stores no facts; a typed number stores no σ, and a read of it has none", () => {
    home("A:=5");
    expect(entry("A")?.facts).toBeUndefined();
    home("B:=2.5");
    expect(entry("B")?.facts?.uncSigma).toBeUndefined();
    expect(home("B*2").facts.uncSigma).toBeUndefined();
  });
});
