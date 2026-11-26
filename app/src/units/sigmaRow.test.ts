// SPDX-License-Identifier: GPL-3.0-or-later
// R885: the Home row a unit result files draws its value and σ by one rule (render/sigmaForm.ts): never cut above σ, σ in
// the value's form; its text is Copy as shown's. Real Giac. Expected values: derived from the rule (docs/04 2.6) on the
// hunt's inputs (h3 #4, #5, #12, #13); controls: Copy keeps every digit, a row without σ is drawn as before.
import { beforeAll, describe, expect, it } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import type { NumberFormat } from "../calc/port.ts";
import { copyFull, copyShownText } from "../clipboard/text.ts";
import { EngineHost } from "../engine/host.ts";
import { defaultHomeSettings } from "../engine/homeEval.ts";
import { giacAvailable, loadNodeGiac } from "../engine/nodeGiac.ts";
import type { IndexItem } from "../find/types.ts";
import { fakeKv } from "../state/fakeKv.ts";
import { Session, type HistoryItem } from "../state/session.svelte.ts";
import { loadTidy } from "../state/tidyLoad.ts";
import { buildJob } from "./build.ts";
import { factorTable } from "./factors.ts";
import { putRow, unitRow } from "./row.ts";
import { isUnitError, type Quantity } from "./types.ts";
import { shownOf, type UnitShown } from "./result.ts";

const item = (kind: string, id: string, x: Record<string, string>): IndexItem =>
  ({ id: `${kind}:${id}`, kind, names: [id], title: id, tier: 0, insert: "", ...x }) as unknown as IndexItem;
const TABLE = factorTable([item("unit", "m", { dim: "m1", si: "1" })]);
const M = { tokens: [{ unit: "m" }] };
const ts = " ";

describe.skipIf(!giacAvailable())("a unit row's value ± σ (R885, real Giac)", () => {
  let host: EngineHost;
  beforeAll(async () => {
    const L = await loadNodeGiac();
    host = new EngineHost(L.giac, L.bridge);
    await loadTidy(); // the σ rule rides in the tidy chunk, as on the screen (the session's sigmaCode)
  });
  const units = (formula: string, digits: number): Quantity => {
    const job = buildJob({ formula, slots: [M] }, TABLE);
    if (isUnitError(job)) throw new Error(JSON.stringify(job));
    const q = host.units(job, { ...defaultHomeSettings, digits });
    if (isUnitError(q)) throw new Error(JSON.stringify(q));
    return q;
  };
  /** The row of `formula` (in m) worked out and drawn at `format`, `digits`: its text, and Copy as shown's. */
  const drawn = async (formula: string, format: NumberFormat, digits: number) => {
    const s = new Session(new FakeCalc(), fakeKv([], { cloneReads: true }));
    await s.restoreHistory();
    s.settings.format = format;
    s.settings.digits = digits;
    const q = units(formula, digits);
    putRow(s, unitRow({ line: "", chips: {}, q, slots: { u1: M }, input: "", digits }));
    const it = s.home.at(-1) as HistoryItem;
    const d = s.display(it, true);
    return { s, it, q, text: s.display(it).text, latex: d.latex, shown: copyShownText(s.display(it).text) };
  };

  it.each([
    // h3 #4: never cut above σ
    ["pasupm(1234567890.12345,0.0001)*pasu1", "std", 12, "1234567890.12345 ± 0.00010 m"],
    ["pasupm(12345.678,0.001)*pasu1", "std", 4, "12345.6780 ± 0.0010 m"],
    ["pasupm(2.5,0.1)*pasu1", "std", 1, "2.50 ± 0.10 m"],
    // h3 #5: PFX, σ in the value's prefix
    ["pasupm(4.7,0.1)*10^3*pasu1", "pfx", 12, `4.70${ts}k ± 0.10${ts}k m`],
    ["pasupm(9.81,0.05)*10^(-6)*pasu1", "pfx", 12, `9.810${ts}µ ± 0.050${ts}µ m`],
    // h3 #12: SCI pads no zeros past σ; #13: the row as the view's headline (9.810 ± 0.050)
    ["pasupm(9.81,0.05)*pasu1", "sci", 12, "9.810E0 ± 0.050 m"],
    ["pasupm(9.81,0.05)*pasu1", "std", 12, "9.810 ± 0.050 m"],
  ] as [string, NumberFormat, number, string][])("%s in %s at %i digits: %s, and Copy as shown the same", async (f, format, digits, want) => {
    const r = await drawn(f, format, digits);
    expect(r.text).toBe(want);
    expect(r.shown).toBe(want);
  });

  it("σ in the value's exponent in the drawing too; the muted digits past σ stay (R883)", async () => {
    const sci = await drawn("pasupm(9.81,0.05)*10^(-6)*pasu1", "sci", 12);
    expect(sci.text).toBe("9.810E-6 ± 0.050E-6 m");
    expect(sci.latex).toMatch(/^9\.8\\class\{unc\}\{10\}\\times10\^\{-6\}\\pm0\.050\\times10\^\{-6\}/);
    const pend = await drawn("pasupm(9.81065219207,0.0526983)*pasu1", "std", 12);
    expect(pend.text).toBe("9.81065219207 ± 0.053 m");
    expect(pend.latex).toContain("\\class{unc}{");
  });

  it("control (R885 FIX 1): 10²⁰·π ± 3 worked out to its 22 confirmed digits is drawn to σ's place", async () => {
    const r = await drawn("pasupm(10^20*pi,3)*pasu1", "std", 12);
    expect(r.text).toBe("314159265358979323846.3 ± 3.0 m");
    expect(r.shown).toBe("314159265358979323846.3 ± 3.0 m");
  });

  it("controls: Copy keeps every digit; a row without σ is drawn by the digits setting", async () => {
    const r = await drawn("pasupm(2.5,0.1)*pasu1", "std", 1);
    expect(copyFull(r.it)).toBe("2.5 ± 0.10 m");
    const plain = await drawn("2.5*pasu1", "sci", 12);
    expect(plain.text).toBe("2.50000000000E0 m");
  });

  // R885 FIX round 2: the view's headline (UnitShown.text) is drawn by the row's function (sigmaDrawn), cut at σ's last
  // digit (the row's digits past it are muted, R883): the same form, the same σ. Bug list 4's G·5.972ᴇ24 kg
  // (6.67430ᴇ-11 · 5.972ᴇ24 = 3.98589196ᴇ14, σ 1.5ᴇ-15 · 5.972ᴇ24 = 8.958ᴇ9: σ's last digit at 10⁸) read
  // ≈ 3.985892E14 ± 9000000000 in the view, the value in E form and σ not
  it.each([
    ["pasupm(6.67430e-11,1.5e-15)*5.972e24*pasu1", "std", 12, "3.985892E14 ± 0.000090E14", "3.98589196E14 ± 0.000090E14"],
    ["pasupm(6.67430e-11,1.5e-15)*5.972e24*pasu1", "std", 7, "3.985892E14 ± 0.000090E14", "3.985892E14 ± 0.000090E14"],
    ["pasupm(4.7,0.1)*10^3*pasu1", "pfx", 12, `4.70${ts}k ± 0.10${ts}k`, `4.70${ts}k ± 0.10${ts}k`],
    ["pasupm(9.81,0.05)*10^(-6)*pasu1", "pfx", 12, `9.810${ts}µ ± 0.050${ts}µ`, `9.810${ts}µ ± 0.050${ts}µ`],
    ["pasupm(1234567890.12345,0.0001)*pasu1", "std", 12, "1234567890.12345 ± 0.00010", "1234567890.12345 ± 0.00010"],
    ["pasupm(2.5,0.1)*pasu1", "std", 1, "2.50 ± 0.10", "2.50 ± 0.10"],
    ["pasupm(9.81,0.05)*pasu1", "sci", 12, "9.810E0 ± 0.050", "9.810E0 ± 0.050"],
    ["pasupm(9.81065219207,0.0526983)*pasu1", "std", 12, "9.811 ± 0.053", "9.81065219207 ± 0.053"],
  ] as [string, NumberFormat, number, string, string][])("the view's headline of %s in %s at %i: %s, the row %s", async (f, format, digits, head, rowText) => {
    const r = await drawn(f, format, digits);
    const v = shownOf(r.q, { format: format.toUpperCase() as "STD", digits }) as UnitShown;
    expect(v.text).toBe(head);
    expect(v.sigma && v.sigma.head + v.sigma.tail).toBe(head);
    expect(r.text).toBe(`${rowText} m`);
  });

  it("the headline of (1000 ± 100) − (997 ± 50) m, 3 ± 111.8, reads 0 ± 110, not 00 ± 110 (R885f1); the row 3 ± 110", async () => {
    const f = "(pasupm(1000,100)-pasupm(997,50))*pasu1";
    const r = await drawn(f, "std", 12);
    const v = shownOf(r.q, { format: "STD", digits: 12 }) as UnitShown;
    expect(v.text).toBe("0 ± 110");
    expect(v.sigma && v.sigma.head + v.sigma.tail).toBe("0 ± 110");
    expect(r.text).toBe("3 ± 110 m");
  });

  it("the second line of G·M writes σ in E form, as its value (bug list 4): σ 9.0E9, not 9000000000", async () => {
    const q = units("pasupm(6.67430e-11,1.5e-15)*5.972e24*pasu1", 12);
    expect((shownOf(q, { format: "STD", digits: 12 }) as UnitShown).sub).toBe("3.98589196E14 · σ 9.0E9");
  });

  it("the unit view's second line writes σ at 2 significant digits in the format's form (h3 #12)", async () => {
    const q = units("pasupm(9.81,0.05)*pasu1", 12);
    const sub = (format: "SCI" | "STD" | "PFX") => (shownOf(q, { format, digits: 12 }) as UnitShown).sub;
    expect(sub("SCI")).toMatch(/· σ 5\.0E-2$/);
    expect(sub("STD")).toMatch(/· σ 0\.050$/);
    expect(sub("PFX")).toMatch(new RegExp(`· σ 50${ts}m$`));
  });
});
