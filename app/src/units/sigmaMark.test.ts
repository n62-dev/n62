// SPDX-License-Identifier: GPL-3.0-or-later
// R271f1: σ's mark is decided once (units/sigmaFacts.ts, evaluate.ts done) and read by the unit view, the Home row (saved
// and read back), the chip and the chip used again, under every setting. The case: 10.1 ± a chip of 0.0707106781187
// shown with 3 confirmed digits, in m (audit round 3 of R271). The chain is the unit view's own: the parser in units mode,
// the request (view.ts request), the builder and the evaluator (real Giac; skipped without a build, see nodeGiac.ts) on a
// hand-made slice of Find's factor table. Expected values derived: 2 × 0.0707 = 0.1414 (σ cut to its 3 digits).
// R286: σ's n confirmed digits end at the decade σ.exp − n + 1 (0.0707 with 3: 10^-4), and the value is known to that
// decade: n + value.exp − σ.exp significant digits (sigmaFacts.ts limitDigits), never more than the value's own.
import { beforeAll, describe, expect, it } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import type { NumberFormat } from "../calc/port.ts";
import { decimalFromString, markOf, type FormatOptions } from "../engine/format.ts";
import { defaultHomeSettings, precisionFacts } from "../engine/homeEval.ts";
import { EngineHost } from "../engine/host.ts";
import { giacAvailable, loadNodeGiac } from "../engine/nodeGiac.ts";
import type { IndexItem } from "../find/types.ts";
import type { Chip, ChipTable } from "../input/chips.ts";
import { sigmaChipOf, uncChipsIn } from "../input/chipUnit.ts";
import { validChips } from "../input/chips.ts";
import { latexToGiacInfo } from "../input/latex-to-giac.ts";
import { fakeKv } from "../state/fakeKv.ts";
import { chipFactsOf } from "../state/results.ts";
import { Session, type HistoryItem } from "../state/session.svelte.ts";
import { buildJob } from "./build.ts";
import { quantityChip } from "./chip.ts";
import { factorTable } from "./factors.ts";
import { shownOf, type UnitShown } from "./result.ts";
import { putRow, unitRow } from "./row.ts";
import { isUnitError, type Quantity, type UnitRequest, type UnitSlot } from "./types.ts";

const M: UnitSlot = { tokens: [{ unit: "m" }] };
const TABLE = factorTable([{ id: "unit:m", kind: "unit", names: ["m"], title: "m", si: "1", dim: "m1", tier: 0, insert: "" } as IndexItem]);
/** σ as Home showed it with 3 confirmed digits (⚠ 3 at 12 digits). */
const FEW: Chip = { value: "0.0707106781187", exact: false, reliableDigits: 3 };
const LINE = "10.1\\pm\\res{3}{0.0707}\\placeholder[u1]{}";
const TYPED = "10.1\\pm0.07\\placeholder[u1]{}";

/** The request the unit view sends for `latex` (view.ts request). */
function request(latex: string, chips: ChipTable, slots: UnitSlot[]): UnitRequest {
  const r = latexToGiacInfo(latex, { units: true, chips });
  const sigmas = r.units?.sigmas?.map((c) => sigmaChipOf(chips[c.key], c.slot));
  const uncChips = uncChipsIn(latex, chips);
  return { formula: r.giac, slots, ...(sigmas ? { sigmas } : {}), ...(uncChips.length ? { uncChips } : {}) };
}

/** Each global setting (the Format key's FIX is a row's own mode, which the unit view has not) as the session takes it
 *  and as the view's FormatOptions. */
const SETTINGS: { format: NumberFormat; digits: number; o: FormatOptions }[] = [
  { format: "std", digits: 12, o: { format: "STD", digits: 12 } },
  { format: "std", digits: 3, o: { format: "STD", digits: 3 } },
  { format: "std", digits: 2, o: { format: "STD", digits: 2 } },
  { format: "sci", digits: 5, o: { format: "SCI", digits: 5 } },
  { format: "eng", digits: 3, o: { format: "ENG", digits: 3 } },
];

describe("R271f1: a stored chip's σ facts, checked where the builder reads them (no engine)", () => {
  it("only a chip with σ limits the unit view's σ; only a whole count from 0 and a known ⚠ reason count", () => {
    const stored = validChips({
      "res:1": { value: "10.1", exact: false, unc: "0.0707", uncFacts: { reliableDigits: 3 } },
      "res:2": { value: "2", exact: false, uncFacts: { reliableDigits: 1 } },
      "res:3": { value: "1", exact: false, unc: "0.1", uncFacts: { reliableDigits: "x", warn: "x" } },
      "res:4": { value: "1", exact: false, unc: "0.1", uncFacts: { reliableDigits: 2.5, warn: "unchecked" } },
    })!;
    expect(stored["res:1"]?.uncFacts).toEqual({ reliableDigits: 3 });
    expect(stored["res:2"]).not.toHaveProperty("uncFacts");
    expect(uncChipsIn("\\res{2}{2}", stored)).toEqual([]);
    const facts = (latex: string) => {
      const job = buildJob(request(`${latex}\\placeholder[u1]{}`, stored, [M]), TABLE);
      return isUnitError(job) ? job : job.unc?.chip;
    };
    expect(facts("\\res{1}{10.1}+\\res{2}{2}")).toEqual({ reliableDigits: 3 });
    expect(facts("\\res{3}{1}")).toEqual({ reliableDigits: null });
    expect(facts("\\res{4}{1}+\\res{1}{10.1}")).toEqual({ reliableDigits: 3, warn: "unchecked" });
  });
});

describe.skipIf(!giacAvailable())("R271f1: a σ chip's mark in the view, the row and the chip (real Giac)", () => {
  let host: EngineHost;
  beforeAll(async () => {
    const L = await loadNodeGiac();
    host = new EngineHost(L.giac, L.bridge);
  });
  const units = (latex: string, chips: ChipTable): Quantity => {
    const job = buildJob(request(latex, chips, [M]), TABLE);
    if (isUnitError(job)) throw new Error(JSON.stringify(job));
    const q = host.units(job, defaultHomeSettings);
    if (isUnitError(q)) throw new Error(JSON.stringify(q));
    return q;
  };
  const shown = (q: Quantity, o: FormatOptions = SETTINGS[0]!.o): UnitShown => {
    const s = shownOf(q, o);
    if (s.kind !== "result") throw new Error(JSON.stringify(s));
    return s;
  };
  const row = (q: Quantity, line: string, chips: ChipTable) => unitRow({ line, chips, q, slots: { u1: M }, input: line, digits: 12 });
  const session = async (kv = fakeKv([], { cloneReads: true })): Promise<Session> => {
    const s = new Session(new FakeCalc(), kv);
    await s.restoreHistory();
    return s;
  };

  it("⚠ 6 in the unit view, the value's facts holding σ's limit at σ's decade", () => {
    // R286: 10.1 (exp 1) ± 0.0707 (exp -2) with 3: 3 + 1 + 2 = 6 digits, to 10^-4; STD 12 shows 12 > 6: ⚠ 6
    const q = units(LINE, { "res:3": FEW });
    expect(q.value.facts.reliableDigits).toBe(6);
    const s = shown(q);
    expect([s.mark, s.markText, s.text, s.warn]).toEqual(["⚠", "⚠ 6", "10.100 ± 0.071", true]);
  });

  it("⚠ in its history row, and after the row is saved and read back, the same mark as the view under every setting", async () => {
    const q = units(LINE, { "res:3": FEW });
    const r = row(q, LINE, { "res:3": FEW });
    expect(r.facts?.reliableDigits).toBe(6);
    // σ's own facts stay its 3 digits (a σ chip used again scales them anew)
    expect(r.units?.unc).toEqual({ text: "0.071", shown: "10.100 ± 0.071", reliableDigits: 3 });
    const kv = fakeKv([], { cloneReads: true });
    const s = await session(kv);
    putRow(s, r);
    expect(s.mark(s.home[0] as HistoryItem)).toEqual({ mark: "⚠", n: 6 });
    s.flushHistory();
    const back = await session(kv);
    const item = back.home[0] as HistoryItem;
    expect(item.units?.unc).toEqual(r.units?.unc);
    const marks = SETTINGS.map((t) => {
      back.setFormat(t.format);
      back.setDigits(t.digits);
      return [t.format, t.digits, back.mark(item)?.mark];
    });
    expect(marks).toEqual(SETTINGS.map((t) => [t.format, t.digits, shown(q, t.o).mark]));
    // R286: ⚠ where more digits are shown than the 6 σ's limit gives (STD 12), ≈ at 6 digits or fewer (STD 3, STD 2,
    // SCI 5, ENG 3; SCI 5 was ⚠ under the count of 3), in the row as in the view
    expect(marks.map((m) => m[2])).toEqual(["⚠", "≈", "≈", "≈", "≈"]);
    back.setFormat("std");
    back.setDigits(12);
    expect(back.mark(item)?.mark).toBe("⚠");
    expect(back.chipFor(item)).toEqual(quantityChip(q));
  });

  it("its chip keeps σ's limit and σ cut to its 3 digits; used again it is ⚠ in Home and in the unit view, σ 0.1414", () => {
    const q = units(LINE, { "res:3": FEW });
    const chip = quantityChip(q);
    expect(chip).toMatchObject({ exact: false, reliableDigits: 6, unc: "0.707e-1", uncFacts: { reliableDigits: 3 } });
    // Home: the chip times 2 (the chip's 6 digits; 20.2 is Giac's exact 101/5)
    const home = host.home("pasr_7*2", defaultHomeSettings, undefined, chipFactsOf({ "7": chip! })).result;
    expect(markOf(precisionFacts(home), SETTINGS[0]!.o)).toEqual({ mark: "⚠", n: 6 });
    expect(decimalFromString(home.facts.uncSigma ?? "")).toEqual(decimalFromString("0.1414"));
    // the unit view: 2 × the chip, in m
    const again = units("2\\times\\res{7}{10.1}\\placeholder[u1]{}", { "res:7": chip! });
    expect(again.unc?.text).toBe("0.14");
    expect(again.unc?.value.display).toBe("0.1414");
    // σ 0.1414 (exp -1) with the chip's σ's 3 digits, 20.2 (exp 1): 3 + 1 + 1 = 5
    const s = shown(again);
    expect([s.mark, s.markText, s.warn]).toEqual(["⚠", "⚠ 5", true]);
  });

  it("R286: 1000.5 ± a 3-digit σ chip is known to σ's 10^-4: 8 digits, in the view, its chip and the chip used again", () => {
    // 1000.5 (exp 3) ± 0.0707 (exp -2) with 3: 3 + 3 + 2 = 8 (phase-1 held 3: `2E3` in Home)
    const line = "1000.5\\pm\\res{3}{0.0707}\\placeholder[u1]{}";
    const q = units(line, { "res:3": FEW });
    expect(q.value.facts.reliableDigits).toBe(8);
    expect(q.unc?.limit).toBe(8);
    // STD 12 shows 12 digits (format.ts digitsShown), 8 confirmed: ⚠ 8 before σ; STD 8 shows 8: ≈
    const s = shown(q);
    expect([s.mark, s.markText, s.text, s.warn]).toEqual(["⚠", "⚠ 8", "1000.500 ± 0.071", true]);
    expect(shown(q, { format: "STD", digits: 8 }).mark).toBe("≈");
    const chip = quantityChip(q);
    expect(chip).toMatchObject({ value: "2001/2", reliableDigits: 8, unc: "0.707e-1", uncFacts: { reliableDigits: 3 } });
    // Home: 2 × 2001/2 = 2001 to 8 digits, σ 2 × 0.0707 = 0.1414
    const home = host.home("pasr_7*2", defaultHomeSettings, undefined, chipFactsOf({ "7": chip! })).result;
    expect(home.display).toBe("2001");
    expect(decimalFromString(home.facts.uncSigma ?? "")).toEqual(decimalFromString("0.1414"));
    expect(markOf(precisionFacts(home), SETTINGS[0]!.o)).toEqual({ mark: "⚠", n: 8 });
    expect(markOf(precisionFacts(home), { format: "STD", digits: 8 })?.mark).toBe("≈");
    // the unit view: 2 × the chip in m; σ 0.1414 (exp -1) with 3, 2001 (exp 3): 3 + 3 + 1 = 7, 2001.00 shows 6 of them
    const again = units("2\\times\\res{7}{1000.5}\\placeholder[u1]{}", { "res:7": chip! });
    expect(again.value.facts.reliableDigits).toBe(7);
    expect(shown(again).text).toBe("2001.00 ± 0.14");
    expect(shown(again, { format: "STD", digits: 7 }).mark).toBe("≈");
  });

  it("R286: 123456.25 ± a 3-digit σ chip, its chip × 2 in Home is 246912.5 (phase-1: 2.47E5)", () => {
    // 123456.25 (exp 5) ± 0.0707 (exp -2) with 3: 3 + 5 + 2 = 10 digits; 2 × 493825/4 = 246912.5, 7 digits
    const q = units("123456.25\\pm\\res{3}{0.0707}\\placeholder[u1]{}", { "res:3": FEW });
    const chip = quantityChip(q);
    expect(chip?.reliableDigits).toBe(10);
    const home = host.home("pasr_7*2", defaultHomeSettings, undefined, chipFactsOf({ "7": chip! })).result;
    expect(home.display).toBe("246912.5");
    expect(markOf(precisionFacts(home), { format: "STD", digits: 10 })?.mark).toBe("≈");
  });

  it("R286: a σ chip with 1 confirmed digit on a value shown past σ's decade keeps the ⚠ before σ, at the scaled count", () => {
    // 10.123456 (exp 1) ± 0.0707 (exp -2) with 1: 1 + 1 + 2 = 4 digits, to 10^-2; `10.123 ± 0.071` shows 5: ⚠ 4
    const one: Chip = { ...FEW, reliableDigits: 1 };
    const q = units("10.123456\\pm\\res{3}{0.0707}\\placeholder[u1]{}", { "res:3": one });
    expect(q.value.facts.reliableDigits).toBe(4);
    const s = shown(q, { format: "STD", digits: 5 });
    expect([s.mark, s.markText, s.warn]).toEqual(["⚠", "⚠ 4", true]);
    expect(s.sigma?.tail).toBe("0.071");
  });

  it("a σ chip with a ⚠ reason carries it to the value, whatever the digits (control)", () => {
    const q = units(LINE, { "res:3": { ...FEW, warn: "unchecked" } });
    expect(q.value.facts.warn).toBe("unchecked");
    const s = shown(q, { format: "STD", digits: 3 });
    expect([s.mark, s.warn]).toEqual(["⚠", true]);
  });

  it("a typed σ stays ≈: no σ facts on the row or the chip, the view and the row ≈", async () => {
    const q = units(TYPED, {});
    expect(shown(q).mark).toBe("≈");
    const r = row(q, TYPED, {});
    expect(r.units?.unc).toEqual({ text: "0.070", shown: "10.100 ± 0.070" });
    const s = await session();
    putRow(s, r);
    const item = s.home[0] as HistoryItem;
    expect(s.mark(item)?.mark).toBe("≈");
    expect(item.units?.unc).not.toHaveProperty("reliableDigits");
    expect(quantityChip(q)).not.toHaveProperty("uncFacts");
  });
});
