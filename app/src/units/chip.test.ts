// SPDX-License-Identifier: GPL-3.0-or-later
// R61 (r17 section 2): the chip a unit result gives, from the evaluator's own Quantity (real Giac; skipped without a
// build, see nodeGiac.ts). The factor table is a hand-made slice of Find's (the index's ids, dimension keys and
// CODATA 2018's G), so the test needs no index.
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "../engine/host.ts";
import { defaultHomeSettings } from "../engine/homeEval.ts";
import { giacAvailable, loadNodeGiac } from "../engine/nodeGiac.ts";
import type { IndexItem } from "../find/types.ts";
import type { Chip } from "../input/chips.ts";
import { latexToGiacInfo } from "../input/latex-to-giac.ts";
import { buildJob } from "./build.ts";
import { quantityChip, storeChip } from "./chip.ts";
import { factorTable } from "./factors.ts";
import { slotCatalogue } from "./slot.ts";
import { UnitView, type ViewHost } from "./view.ts";
import { isUnitError, type Quantity, type UnitError, type UnitRequest } from "./types.ts";

const item = (kind: string, id: string, x: Record<string, string>): IndexItem =>
  ({ id: `${kind}:${id}`, kind, names: [id], title: id, tier: 0, insert: "", ...x }) as unknown as IndexItem;
const ITEMS = [
  item("unit", "m", { dim: "m1", si: "1" }),
  item("unit", "s", { dim: "s1", si: "1" }),
  item("unit", "h", { dim: "s1", si: "3600" }),
  item("unit", "kg", { dim: "kg1", si: "1" }),
  { ...item("unit", "percent", { dim: "", si: "1/100", insert: "\\unit{percent}{\\mathrm{\\%}}" }), ratio: true } as IndexItem,
  item("unit", "rev", { dim: "", si: "1" }),
  item("pfx", "k", { si: "1000" }),
  item("pfx", "m", { si: "1/1000" }),
  item("const", "G", { value: "6.67430E-11", unc: "0.00015E-11", dim: "kg-1m3s-2" }),
  { ...item("unit", "ppm", { dim: "", si: "1/1000000" }), ratio: true } as IndexItem,
];
const TABLE = factorTable(ITEMS);
const KMH = { tokens: [{ prefix: "k", unit: "m" }, { unit: "h" }], per: 1 };

describe.skipIf(!giacAvailable())("quantityChip (R61, real Giac)", () => {
  let host: EngineHost;
  beforeAll(async () => {
    const L = await loadNodeGiac();
    host = new EngineHost(L.giac, L.bridge);
  });
  const units = (req: UnitRequest): Quantity | UnitError => {
    const job = buildJob(req, TABLE);
    return isUnitError(job) ? job : host.units(job, defaultHomeSettings);
  };

  it("72 km/h: the number in the unit shown, exact, with the unit as label and slot (t02)", () => {
    const q = units({ formula: "72*pasu1", slots: [KMH] });
    expect(quantityChip(q)).toEqual({ value: "72", exact: true, unit: { text: "km/h", dim: "m1s-1", slot: KMH } });
  });

  it("≈ 157.079632679 mm carries its exact text 50*pi and is exact, as Home's ≈ 157.079632679 (t04)", () => {
    const q = units({ formula: "2*pi*25*pasu1", slots: [{ tokens: [{ prefix: "m", unit: "m" }] }] }) as Quantity;
    expect(q.value.display).toBe("157.079632679");
    expect(quantityChip(q)).toEqual({ value: "50*pi", exact: true, unit: { text: "mm", dim: "m1", slot: { tokens: [{ prefix: "m", unit: "m" }] } } });
  });

  it("t10: not exact, the value 4936/125 and σ in m² (derived)", () => {
    const q = units({ formula: "pasupm(12.34,0.05)*pasu1*pasupm(3.2,0.1)*pasu2", slots: [{ tokens: [{ unit: "m" }] }, { tokens: [{ unit: "m" }] }] }) as Quantity;
    const c = quantityChip(q)!;
    expect(c).toMatchObject({ value: "4936/125", exact: false, unit: { text: "m²", dim: "m2", slot: { tokens: [{ unit: "m", power: "2" }] } } });
    // σ as the evaluator gives it (G18, G41: first and second order), in the same unit: σ² = (3.2·0.05)² + (12.34·0.1)²
    // + (0.05·0.1)² = 1.548381 (derived by hand), σ = 1.24433958388…, tasks.yaml t10's since R63 (decisions.md R61); the
    // first order alone is 1.244329538345…; both give "39.5 ± 1.2".
    expect(c.unc).toBe(q.unc!.value.full);
    expect(c.unc).toBe("sqrt(1548381)/1000");
  });

  it("a constant with σ ({=G}) gives a chip that is not exact, with G's σ", () => {
    const q = units({ formula: "pask1*1*pasu1", slots: [{ tokens: [{ unit: "kg" }] }], consts: ["G"] }) as Quantity;
    // G·1 kg = 6.6743E-11 m³/s² ± 1.5E-15 (CODATA 2018, derived)
    expect(quantityChip(q)).toMatchObject({ value: "66743/1000000000000000", exact: false, unc: "3/2000000000000000" });
  });

  it("a refusal gives no chip", () => {
    const q = units({ formula: "1*pasu1+1*pasu2", slots: [{ tokens: [{ unit: "m" }] }, { tokens: [{ unit: "s" }] }] });
    expect(isUnitError(q)).toBe(true);
    expect(quantityChip(q)).toBeUndefined();
  });

  // R115 (night review 2026-11-02 be-1): R63 puts a σ chip on the unit view's line as an uncertain value; one chip used
  // twice is one input (decisions R61), a typed ± one input each (G18). Expected (derived): x − x and x/x have σ 0;
  // x·x is x², σ² = (2·12.34·0.05)² + 2·0.05⁴ (G41), σ = 1.23400506482 (mpmath); two inputs give √2·0.05 = 0.0707.
  describe("one chip used twice is one input (R115)", () => {
    const chips = { "res:1": { value: "12.34", unc: "0.05", exact: true }, "res:2": { value: "12.34", unc: "0.05", exact: true } };
    const shown = (latex: string): string => {
      const r = latexToGiacInfo(latex, { units: true, chips });
      const q = units({ formula: r.giac, slots: [] });
      if (isUnitError(q)) throw new Error(q.error);
      return q.unc?.shown ?? "no σ";
    };
    const chip = "\\res{1}{12.34}";
    it("chip − chip is 0 ± 0, chip / chip 1 ± 0", () => {
      expect(shown(`${chip}-${chip}`)).toBe("0 ± 0");
      expect(shown(`\\frac{${chip}}{${chip}}`)).toBe("1 ± 0");
    });
    it("chip · chip shows what (chip)² shows, σ 1.2", () => {
      expect(shown(`\\left(${chip}\\right)^2`)).toBe("152.3 ± 1.2");
      expect(shown(`${chip}\\cdot${chip}`)).toBe("152.3 ± 1.2");
    });
    it("−chip + chip is 0 ± 0: the minus stays outside the chip's input", () => {
      expect(shown(`-${chip}+${chip}`)).toBe("0 ± 0");
    });
    it("controls: two chips are two inputs, and so are two typed ± values", () => {
      expect(shown(`${chip}-\\res{2}{12.34}`)).toBe("0.000 ± 0.071");
      expect(shown("12.34\\pm0.05-\\left(12.34\\pm0.05\\right)")).toBe("0.000 ± 0.071");
    });
  });

  it("a pure number carries no unit", () => {
    const q = units({ formula: "pasu1/pasu2*3", slots: [{ tokens: [{ unit: "m" }] }, { tokens: [{ unit: "m" }] }] }) as Quantity;
    expect(q.unit).toBe("");
    expect(quantityChip(q)).toEqual({ value: "3", exact: true });
  });

  // G782: a pure number in a unit keeps it (dimension key ""), so Home takes a ratio's pure number (input/ratioChip.ts)
  // and says rev was dropped; Store ▶ stays off for rev (a stored name's unit needs a dimension key, G371) and, since
  // G782f1, stores the % one's pure number (derived: 0.42 % = 0.0042)
  it("0.0042 ▶ %: 0.42 with the unit %; 3 rev with rev", () => {
    const q = units({ formula: "0.0042", slots: [], end: { tokens: [{ unit: "percent" }] } }) as Quantity;
    expect(q.unit).toBe("%");
    expect(quantityChip(q)).toEqual({ value: "21/50", exact: true, unit: { text: "%", dim: "", slot: { tokens: [{ unit: "percent" }] } } });
    expect(storeChip(quantityChip(q), q.unit, q.unc)).toEqual({ value: "(21/50)/10^2", exact: true }); // G782f1: its pure number
    const rev = units({ formula: "3*pasu1", slots: [{ tokens: [{ unit: "rev" }] }], end: { tokens: [{ unit: "rev" }] } }) as Quantity;
    expect(rev.unit).toBe("rev");
    expect(quantityChip(rev)).toEqual({ value: "3", exact: true, unit: { text: "rev", dim: "", slot: { tokens: [{ unit: "rev" }] } } });
    expect(storeChip(quantityChip(rev), rev.unit, rev.unc)).toBeUndefined();
  });

  // G782f1: in the unit view the slot after a ratio chip starts with its unit, so chip × 200 m keeps the factor and G369
  // drops the ratio beside m. Derived: 0.42 % × 200 m = 0.0042 · 200 m = 0.84 m; 35 ppm × 200 m = 0.007 m; (0.42 ± 0.01) %
  // × 200 m = 0.84 ± 0.02 m (σ scales with the value). Before G782f1 the slot started empty: 84 m, 7000 m, 84 ± 2 m.
  describe("a ratio chip × 200 m in the unit view (G782f1)", () => {
    const CAT = slotCatalogue(ITEMS);
    const M = { tokens: [{ unit: "m" }] };
    /** The view on `chip × 200` with the 200's slot (u2) filled with m, its chip's slot (u1) as the view starts it. */
    const times200 = (c: Chip) => {
      const view = new UnitView(CAT, "\\res{1}{x}\\times200", { "res:1": c }, {} as ViewHost, { u2: M });
      return { view, q: units(view.request()) as Quantity };
    };
    const pct = (): Chip => quantityChip(units({ formula: "0.0042", slots: [], end: { tokens: [{ unit: "percent" }] } }) as Quantity)!;
    it("0.0042 ▶ %, its chip × 200 m: 0.84 m (exact 21/25); the chip's slot holds %", () => {
      const { view, q } = times200(pct());
      expect(view.model("u1")?.slot).toEqual({ tokens: [{ unit: "percent" }] });
      expect(q.unit).toBe("m");
      expect(q.value.display).toBe("0.84");
      expect(quantityChip(q)).toEqual({ value: "21/25", exact: true, unit: { text: "m", dim: "m1", slot: M } });
    });
    it("35 ppm × 200 m: 0.007 m", () => {
      const ppm = quantityChip(units({ formula: "35*pasu1", slots: [{ tokens: [{ unit: "ppm" }] }] }) as Quantity)!;
      expect(ppm.unit?.text).toBe("ppm");
      const { q } = times200(ppm);
      expect(q.unit).toBe("m");
      expect(quantityChip(q)).toMatchObject({ value: "7/1000", exact: true });
    });
    it("(0.42 ± 0.01) % × 200 m: 0.84 ± 0.02 m", () => {
      const c = quantityChip(units({ formula: "pasupm(0.42,0.01)*pasu1", slots: [{ tokens: [{ unit: "percent" }] }] }) as Quantity)!;
      expect(c).toMatchObject({ exact: false, unit: { text: "%" } });
      const { q } = times200(c);
      expect(q.unit).toBe("m");
      expect(q.unc?.shown).toBe("0.840 ± 0.020");
      expect(quantityChip(q)).toEqual({ value: "21/25", exact: false, reliableDigits: null, unc: "1/50", unit: { text: "m", dim: "m1", slot: M } });
    });
    it("Store ▶ on (0.42 ± 0.01) %: the pure number 0.0042 with σ 0.0001", () => {
      const q = units({ formula: "pasupm(0.42,0.01)*pasu1", slots: [{ tokens: [{ unit: "percent" }] }] }) as Quantity;
      const s = storeChip(quantityChip(q), q.unit, q.unc);
      expect(s).toEqual({ value: "(21/50)/10^2", exact: false, reliableDigits: null, unc: "(1/100)/10^2" }); // 0.0042 ± 0.0001, no unit
    });
    it("controls: a rev chip's slot starts empty (3 rev × 200 m is 600 m, the rev dropped as before)", () => {
      const rev = quantityChip(units({ formula: "3*pasu1", slots: [{ tokens: [{ unit: "rev" }] }], end: { tokens: [{ unit: "rev" }] } }) as Quantity)!;
      const { view, q } = times200(rev);
      expect(view.model("u1")?.empty).toBe(true);
      expect(quantityChip(q)).toMatchObject({ value: "600", unit: { text: "m" } });
    });
  });

  // R353: Store ▶ in the unit view stores the chip only when it carries the unit and σ the view shows; the bare number never
  describe("storeChip (R353)", () => {
    const store = (q: Quantity) => storeChip(quantityChip(q), q.unit, q.unc);
    const kmh = (): Quantity => units({ formula: "72*pasu1", slots: [KMH] }) as Quantity;
    const t10 = (): Quantity => units({ formula: "pasupm(12.34,0.05)*pasu1*pasupm(3.2,0.1)*pasu2", slots: [{ tokens: [{ unit: "m" }] }, { tokens: [{ unit: "m" }] }] }) as Quantity;
    it("72 km/h and t10's 39.488 ± 1.2 m²: the chip with its unit (and σ)", () => {
      expect(store(kmh())).toEqual(quantityChip(kmh()));
      expect(store(t10())).toMatchObject({ unc: "sqrt(1548381)/1000", unit: { text: "m²" } });
    });
    it("a pure number stores without a unit", () => {
      const q = units({ formula: "pasu1/pasu2*3", slots: [{ tokens: [{ unit: "m" }] }, { tokens: [{ unit: "m" }] }] }) as Quantity;
      expect(store(q)).toEqual({ value: "3", exact: true });
    });
    it("no shown slot: no chip to store, never the number alone", () => {
      const q = kmh();
      delete (q as { shownSlot?: unknown }).shownSlot;
      expect(quantityChip(q)).toEqual({ value: "72", exact: true }); // the chip Home would take, without its unit
      expect(store(q)).toBeUndefined();
    });
    it("a unit text over 40 characters: none", () => {
      const q = { ...kmh(), unit: "k".repeat(41) };
      expect(quantityChip(q)?.unit).toBeUndefined();
      expect(store(q)).toBeUndefined();
    });
    it("σ with no chip text: none; a chip that lost σ while the view shows one: none", () => {
      const q = t10();
      expect(store({ ...q, unc: { ...q.unc!, value: { ...q.unc!.value, full: "" } } })).toBeUndefined();
      const { unc: _, ...noSigma } = quantityChip(q)!;
      expect(storeChip(noSigma, q.unit, q.unc)).toBeUndefined();
      expect(storeChip(noSigma, q.unit, { text: "0" })).toEqual(noSigma); // a σ of 0 is dropped by quantityChip
    });
  });
});
