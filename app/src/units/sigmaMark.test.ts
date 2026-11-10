// SPDX-License-Identifier: GPL-3.0-or-later
// R271f1: σ's mark is decided once (units/sigmaFacts.ts, evaluate.ts done) and read by the unit view, the Home row (saved
// and read back), the chip and the chip used again, under every setting. The case: 10.1 ± a chip of 0.0707106781187
// shown with 3 confirmed digits, in m (audit round 3 of R271). The chain is the unit view's own: the parser in units mode,
// the request (view.ts request), the builder and the evaluator (real Giac; skipped without a build, see nodeGiac.ts) on a
// hand-made slice of Find's factor table. Expected values derived: 2 × 0.0707 = 0.1414 (σ cut to its 3 digits).
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
import { latexToGiacInfo } from "../input/latex-to-giac.ts";
import { fakeKv } from "../state/fakeKv.ts";
import { chipFactsOf } from "../state/results.ts";
import { Session, type HistoryItem } from "../state/session.svelte.ts";
import { buildJob } from "./build.ts";
import { quantityChip } from "./chip.ts";
import { factorTable } from "./factors.ts";
import { shownOf, type UnitShown } from "./result.ts";
import { putRow, rowSigma, unitRow } from "./row.ts";
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

  it("⚠ 3 in the unit view, the value's facts holding σ's limit", () => {
    const q = units(LINE, { "res:3": FEW });
    expect(q.value.facts.reliableDigits).toBe(3);
    const s = shown(q);
    expect([s.mark, s.markText, s.text, s.warn]).toEqual(["⚠", "⚠ 3", "10.100 ± 0.071", true]);
  });

  it("⚠ in its history row, and after the row is saved and read back, the same mark as the view under every setting", async () => {
    const q = units(LINE, { "res:3": FEW });
    const r = row(q, LINE, { "res:3": FEW });
    expect(r.facts?.reliableDigits).toBe(3);
    expect(r.units?.unc).toEqual({ text: "0.071", shown: "10.100 ± 0.071", reliableDigits: 3 });
    const kv = fakeKv([], { cloneReads: true });
    const s = await session(kv);
    putRow(s, r);
    expect(s.mark(s.home[0] as HistoryItem)).toEqual({ mark: "⚠", n: 3 });
    s.flushHistory();
    const back = await session(kv);
    const item = back.home[0] as HistoryItem;
    expect(rowSigma(item)).toEqual({ reliableDigits: 3 });
    const marks = SETTINGS.map((t) => {
      back.setFormat(t.format);
      back.setDigits(t.digits);
      return [t.format, t.digits, back.mark(item)?.mark];
    });
    expect(marks).toEqual(SETTINGS.map((t) => [t.format, t.digits, shown(q, t.o).mark]));
    // ⚠ where more digits are shown than σ's 3 confirmed, ≈ at 3 digits or fewer, in the row as in the view
    expect(marks.map((m) => m[2])).toEqual(["⚠", "≈", "≈", "⚠", "≈"]);
    back.setFormat("std");
    back.setDigits(12);
    expect(back.mark(item)?.mark).toBe("⚠");
    expect(back.chipFor(item)).toEqual(quantityChip(q));
  });

  it("its chip keeps σ's limit and σ cut to its 3 digits; used again it is ⚠ in Home and in the unit view, σ 0.1414", () => {
    const q = units(LINE, { "res:3": FEW });
    const chip = quantityChip(q);
    expect(chip).toMatchObject({ exact: false, reliableDigits: 3, unc: "0.707e-1", uncFacts: { reliableDigits: 3 } });
    // Home: the chip times 2
    const home = host.home("pasr_7*2", defaultHomeSettings, undefined, chipFactsOf({ "7": chip! })).result;
    expect(markOf(precisionFacts(home), SETTINGS[0]!.o)).toEqual({ mark: "⚠", n: 3 });
    expect(decimalFromString(home.facts.uncSigma ?? "")).toEqual(decimalFromString("0.1414"));
    // the unit view: 2 × the chip, in m
    const again = units("2\\times\\res{7}{10.1}\\placeholder[u1]{}", { "res:7": chip! });
    expect(again.unc?.text).toBe("0.14");
    expect(again.unc?.value.display).toBe("0.1414");
    const s = shown(again);
    expect([s.mark, s.markText, s.warn]).toEqual(["⚠", "⚠ 3", true]);
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
    expect(rowSigma(item)).toBeUndefined();
    expect(quantityChip(q)).not.toHaveProperty("uncFacts");
  });
});
