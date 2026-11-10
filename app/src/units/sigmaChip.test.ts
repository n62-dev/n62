// SPDX-License-Identifier: GPL-3.0-or-later
// R271: a result chip after ± is the σ of the typed value, with its value, its digits and its facts, through the chain
// the unit view runs: the parser (units mode), the request (input/chipUnit.ts sigmaChipOf), the builder, the evaluator
// (real Giac) and the shown result. Expected values: sem of 10.1, 10.3, 9.9, 10.0 and 10.2 is
// 0.07071067811865475244… (source: oracle, mpmath at 30 digits: sqrt(Σ(x−x̄)²/4/5)); the rest derived.
import { beforeAll, describe, expect, it } from "vitest";
import type { FormatOptions } from "../engine/format.ts";
import { defaultHomeSettings } from "../engine/homeEval.ts";
import { EngineHost } from "../engine/host.ts";
import { engineGiac, giacAvailable, loadNodeGiac, type EngineGiac } from "../engine/nodeGiac.ts";
import type { IndexItem } from "../find/types.ts";
import type { Chip, ChipTable } from "../input/chips.ts";
import { sigmaChipOf } from "../input/chipUnit.ts";
import { latexToGiacInfo } from "../input/latex-to-giac.ts";
import { slotFormula } from "../input/unitFormula.ts";
import { buildJob } from "./build.ts";
import { factorTable } from "./factors.ts";
import { unitErrorMessage } from "./messages.ts";
import { shownOf, type UnitShown } from "./result.ts";
import { isUnitError, type Quantity, type UnitError, type UnitRequest, type UnitSlot } from "./types.ts";

const unit = (id: string, si: string, dim: string): IndexItem => ({ id: `unit:${id}`, kind: "unit", names: [id], title: id, si, dim, tier: 0, insert: `\\unit{${id}}{\\mathrm{${id}}}` });
const table = factorTable([
  unit("m", "1", "m1"), unit("s", "1", "s1"), unit("oC", "1+5463/20", "K1"), unit("K", "1", "K1"),
  { id: "pfx:k", kind: "pfx", names: ["k"], title: "k", si: "1000", tier: 0, insert: "\\pfx{k}{\\mathrm{k}}" },
]);
const M: UnitSlot = { tokens: [{ unit: "m" }] };
const S: UnitSlot = { tokens: [{ unit: "s" }] };
const KM: UnitSlot = { tokens: [{ prefix: "k", unit: "m" }] };
const STD: FormatOptions = { format: "STD", digits: 12 };
/** sem(L) as Home shows it and its chip keeps it (R65: the confirmed decimal, its digits). */
const SEM: Chip = { value: "0.0707106781187", exact: false, reliableDigits: 12 };

/** The request the unit view sends for `latex` (its slots in order), as view.ts request() builds it. */
function request(latex: string, chips: ChipTable, slots: UnitSlot[]): UnitRequest {
  const r = latexToGiacInfo(latex, { units: true, chips });
  const sigmas = r.units?.sigmas?.map((c) => sigmaChipOf(chips[c.key], c.slot));
  return { formula: r.giac, slots, ...(sigmas ? { sigmas } : {}) };
}

describe("R271: a σ chip in the builder (no engine)", () => {
  it("σ is the chip's whole value, an input of its own; its digits and ⚠ go with the job", () => {
    const job = buildJob(request("10.1\\pm\\res{3}{0.0707106781187}\\placeholder[u1]{}", { "res:3": SEM }, [M]), table);
    if (isUnitError(job)) throw new Error(job.error);
    expect(job.unc).toEqual({ expr: "pasv1*(((1)*pasdimL^(1)))", vars: [{ name: "pasv1", value: "10.1", sigma: "(707106781187/10^13)", chip: true }], chip: { reliableDigits: 12 } });
    const two = buildJob(request("3\\pm\\res{3}{0.07}\\placeholder[u1]{}+4\\pm\\res{4}{0.1}\\placeholder[u2]{}", { "res:3": SEM, "res:4": { value: "0.1", exact: false, reliableDigits: 4, warn: "unaudited" } }, [M, M]), table);
    expect(isUnitError(two) ? two : two.unc?.chip).toEqual({ reliableDigits: 4, warn: "unaudited" });
  });
  it("a chip with a unit of the value's dimension is converted to the value's unit; another dimension is refused", () => {
    const km: Chip = { value: "0.002", exact: false, reliableDigits: 12, unit: { text: "km", dim: "m1", slot: KM } };
    const job = buildJob(request("10.1\\pm\\res{5}{0.002}\\placeholder[u1]{}", { "res:5": km }, [M]), table);
    expect(isUnitError(job) ? job : job.unc?.vars[0]?.sigma).toBe("((2/10^3))*(((1000)*(1)*1^(1)))/(((1)*1^(1)))");
    const sec: Chip = { ...km, unit: { text: "s", dim: "s1", slot: S } };
    const bad = buildJob(request("10.1\\pm\\res{5}{0.002}\\placeholder[u1]{}", { "res:5": sec }, [M]), table);
    expect(bad).toEqual({ error: "sigmadim", dims: ["s1", "m1"] });
    expect(unitErrorMessage(bad as UnitError)).toBe("The result after ± doesn't fit the value's unit: T vs L");
    // no slot: the value is a pure number, so a σ with a dimension does not fit it
    expect(buildJob(request("10.1\\pm\\res{5}{0.002}", { "res:5": km }, []), table)).toEqual({ error: "sigmadim", dims: ["m1", ""] });
    // °C as σ is an interval (1 °C = 1 K): no offset
    const degC: Chip = { value: "0.5", exact: false, reliableDigits: 12, unit: { text: "°C", dim: "K1", slot: { tokens: [{ unit: "oC" }] } } };
    const t = buildJob(request("300\\pm\\res{6}{0.5}\\placeholder[u1]{}", { "res:6": degC }, [{ tokens: [{ unit: "K" }] }]), table);
    expect(isUnitError(t) ? t : t.unc?.vars[0]?.sigma).toBe("((5/10^1))*(((1)*1^(1)))/(((1)*1^(1)))");
  });
  it("10 ± <chip> %, from the entry line through the slot formula to the request, is refused, never 0.1 ± 0.004 m", () => {
    const f = slotFormula("10\\pm\\res{3}{0.4}\\%");
    const latex = f.latex.replace("\\to\\placeholder[end]{}", "");
    expect(() => request(latex, { "res:3": { value: "0.4", exact: false, reliableDigits: 12 } }, [M])).toThrow("% after a result chip as σ");
    // a typed 0.4 there is R104's σ = 10·0.4/100 = 0.04 in the value's unit
    const typed = buildJob(request("10\\pm0.4\\%\\placeholder[u1]{}", {}, [M]), table);
    expect(isUnitError(typed) ? typed : typed.unc?.vars[0]?.sigma).toBe("0.04");
  });
});

describe.skipIf(!giacAvailable())("R271: a σ chip evaluated (real Giac)", () => {
  let host: EngineHost;
  let giac: EngineGiac;
  beforeAll(async () => {
    const L = await loadNodeGiac();
    giac = engineGiac(L);
    host = new EngineHost(giac, L.bridge);
  });
  const run = (latex: string, chips: ChipTable, slots: UnitSlot[]): Quantity | UnitError => {
    const job = buildJob(request(latex, chips, slots), table);
    return isUnitError(job) ? job : host.units(job, defaultHomeSettings);
  };
  const shown = (q: Quantity | UnitError): UnitShown => {
    const s = shownOf(q, STD);
    if (s.kind !== "result") throw new Error(JSON.stringify(s));
    return s;
  };

  it("10.1 ± sem chip m: σ is the chip's full value (oracle to its 12 digits), ≈, σ at the chip's digits", () => {
    const q = run("10.1\\pm\\res{3}{0.0707106781187}\\placeholder[u1]{}", { "res:3": SEM }, [M]);
    if (isUnitError(q) || !q.unc) throw new Error(JSON.stringify(q));
    const sigma = Number(giac.eval(`evalf(${q.unc.value.exact ?? q.unc.value.full},20)`));
    expect(sigma).toBe(0.0707106781187);
    expect(Math.abs(sigma / 0.07071067811865475244 - 1)).toBeLessThan(1e-12);
    expect(q.unc.shown).toBe("10.100 ± 0.071");
    expect(q.unc.value.facts.reliableDigits).toBe(12);
    const s = shown(q);
    expect([s.mark, s.text, s.warn]).toEqual(["≈", "10.100 ± 0.071", false]);
    expect(s.sub).toBe("10.1 · σ 0.0707106781187");
  });

  it("a σ chip marked ⚠ makes the result ⚠: one shown as ⚠ 3 (3 confirmed digits of 12, σ at its 3), one with a reason", () => {
    const few = shown(run("10.1\\pm\\res{3}{0.0707}\\placeholder[u1]{}", { "res:3": { value: "0.0707", exact: false, reliableDigits: 3 } }, [M]));
    expect([few.mark, few.markText, few.text, few.warn, few.sub]).toEqual(["⚠", "⚠", "10.100 ± 0.071", true, "10.1 · σ 0.0707"]);
    const q = run("10.1\\pm\\res{3}{0.0707106781187}\\placeholder[u1]{}", { "res:3": { ...SEM, warn: "unaudited" } }, [M]);
    if (isUnitError(q)) throw new Error(q.error);
    expect(q.value.facts.warn).toBe("unaudited");
    const s = shown(q);
    expect([s.mark, s.warn]).toEqual(["⚠", true]);
    // the same value with a typed σ is ≈, the mark this changes
    expect(shown(run("10.1\\pm0.07\\placeholder[u1]{}", {}, [M])).mark).toBe("≈");
  });

  it("a km chip as σ of a value in m is 2 m; a negative or complex chip is refused with its own message", () => {
    const km: Chip = { value: "0.002", exact: false, reliableDigits: 12, unit: { text: "km", dim: "m1", slot: KM } };
    const q = run("10.1\\pm\\res{5}{0.002}\\placeholder[u1]{}", { "res:5": km }, [M]);
    expect(isUnitError(q) ? q : q.unc?.text).toBe("2.0");
    for (const value of ["-0.0707", "3+4*i", "-sqrt(2)/20"]) {
      const r = run("10.1\\pm\\res{3}{x}\\placeholder[u1]{}", { "res:3": { value, exact: false, reliableDigits: 12 } }, [M]);
      expect(r).toEqual({ error: "sigma" });
      expect(unitErrorMessage(r as UnitError)).toBe("The result after ± must be a real number, 0 or more");
    }
    // an exact chip below 0 by less than a double can hold: as a float it is -0, which >= 0 accepts
    expect(run("10.1\\pm\\res{6}{x}\\placeholder[u1]{}", { "res:6": { value: "-1/10^500", exact: true } }, [M])).toEqual({ error: "sigma" });
    // an exact chip of 0 is a σ of 0
    expect(shown(run("10.1\\pm\\res{4}{0}\\placeholder[u1]{}", { "res:4": { value: "0", exact: true } }, [M])).text).toBe("10.1 ± 0");
  });
});
