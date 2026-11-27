// SPDX-License-Identifier: GPL-3.0-or-later
// R325: Paste reads a unit row's Copy text (`39.488 ± 1.2 m²`, clipboard/text.ts copyFull) back as R61's result chip,
// its unit matched to Find ids. The check is the round trip: each slot read, written back by slotText, gives the
// pasted unit text exactly. Expected values: the copied texts themselves (derived: t10 = 12.34·3.2 = 39.488, σ 1.2 as
// the row draws it; unitback.spec.ts).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { IndexItem } from "../find/types.ts";
import { unitLatex } from "../input/chipUnit.ts";
import { slotText } from "../units/build.ts";
import { factorTable } from "../units/factors.ts";
import { slotCatalogue } from "../units/slot.ts";
import { quantityText, readQuantity, readUnitText } from "./pasteUnit.ts";

const here = dirname(fileURLToPath(import.meta.url));
const indexFile = join(here, "../find/_gen/find-index.json");
const items: IndexItem[] = existsSync(indexFile) ? (JSON.parse(readFileSync(indexFile, "utf8")) as IndexItem[]) : [];
const hasIndex = items.some((it) => it.kind === "unit");
const it_ = hasIndex || process.env["FIND_INDEX"] === "required" ? it : it.skip;
const cat = slotCatalogue(items);
const table = factorTable(items);

const read = (clip: string, comma = false) => {
  const q = quantityText(clip, comma ? { decimalComma: true } : {});
  return q && readQuantity(q, cat, table);
};

describe("quantityText: the form `<number> [± <number>] <unit>` (syntax only, no catalogue)", () => {
  it("splits a unit row's Copy text", () => {
    expect(quantityText("39.488 ± 1.2 m²")).toMatchObject({ value: "39.488", sigma: "1.2", unit: "m²" });
    expect(quantityText("20 m/s")).toMatchObject({ value: "20", unit: "m/s" });
    expect(quantityText("20 m/s")?.sigma).toBeUndefined();
    expect(quantityText("39,488 ± 1,2 m²", { decimalComma: true })).toMatchObject({ value: "39.488", sigma: "1.2", unit: "m²" });
    expect(quantityText("-1.5E-3 m")).toMatchObject({ value: "-1.5e-3", unit: "m" });
    expect(quantityText("5 1/s")).toMatchObject({ value: "5", unit: "1/s" });
  });
  it("R886f1: one ⚠ right after ± is taken off before σ is read (a unit row's Copy text with a warned σ)", () => {
    expect(quantityText("1024 ± ⚠580 m")).toMatchObject({ value: "1024", sigma: "580", unit: "m" });
    expect(quantityText("0,00 ± ⚠0,64 m", { decimalComma: true })).toMatchObject({ value: "0.00", sigma: "0.64", unit: "m" });
    expect(quantityText("0.00 ± ⚠0.64 m")).toMatchObject({ value: "0.00", sigma: "0.64", unit: "m" });
    expect(quantityText("9.810 ± 0.050 m")).toMatchObject({ value: "9.810", sigma: "0.050", unit: "m" }); // control
    expect(quantityText("1024 ± ⚠⚠580 m")).toBeNull(); // one sign only
  });
  it("R886f1: a ⚠ anywhere else is still not the form", () => {
    expect(quantityText("⚠1024 ± 580 m")).toBeNull();
    expect(quantityText("1024 ± 580 ⚠m")).toBeNull();
    expect(quantityText("1024 ⚠± 580 m")).toBeNull();
  });
  it("is not the form (Paste says: not a number, as before)", () => {
    expect(quantityText("1.5 ± 0.2")).toBeNull(); // a value with σ and no unit
    expect(quantityText("1.5 ±0.2")).toBeNull();
    expect(quantityText("1 2")).toBeNull();
    expect(quantityText("abc")).toBeNull();
    expect(quantityText("20m")).toBeNull();
    expect(quantityText("1.5 ± -0.2 m")).toBeNull(); // σ is never negative
    expect(quantityText("39,488 ± 1,2 m²")).toBeNull(); // a decimal comma without the setting
    expect(quantityText("1+2i m")).toBeNull();
  });
});

describe("readQuantity: the chip of a unit row's Copy text (R61's quantityChip)", () => {
  it_("39.488 ± 1.2 m²: value 39.488, σ 1.2, never exact, the slot m power 2", () => {
    expect(read("39.488 ± 1.2 m²")).toEqual({
      shown: `39.488\\pm1.2${unitLatex("m²")}`,
      chip: { value: "39.488", exact: false, reliableDigits: null, unc: "1.2", unit: { text: "m²", dim: "m2", slot: { tokens: [{ unit: "m", power: "2" }] } } },
    });
  });
  it_("39,488 ± 1,2 m² with the decimal comma: the same chip, drawn with the comma", () => {
    const r = read("39,488 ± 1,2 m²", true);
    expect(r && "chip" in r ? r.chip : r).toEqual(
      { value: "39.488", exact: false, reliableDigits: null, unc: "1.2", unit: { text: "m²", dim: "m2", slot: { tokens: [{ unit: "m", power: "2" }] } } },
    );
    expect(r && "shown" in r ? r.shown : "").toBe(`39{,}488\\pm1{,}2${unitLatex("m²")}`);
  });
  it_("20 m/s: no σ, exact (the digits as typed), the slot m per s", () => {
    expect(read("20 m/s")).toEqual({
      shown: `20${unitLatex("m/s")}`,
      chip: { value: "20", exact: true, unit: { text: "m/s", dim: "m1s-1", slot: { tokens: [{ unit: "m" }, { unit: "s" }], per: 1 } } },
    });
  });
  it_("1.5 psi and 0.1570796326794896619 m", () => {
    const psi = read("1.5 psi");
    expect(psi && "chip" in psi ? psi.chip.unit?.slot : psi).toEqual({ tokens: [{ unit: "psi" }] });
    const m = read("0.1570796326794896619 m");
    expect(m && "chip" in m ? m.chip : m).toEqual({ value: "0.1570796326794896619", exact: true, unit: { text: "m", dim: "m1", slot: { tokens: [{ unit: "m" }] } } });
  });
  it_("an exponent goes into the value as Giac text and onto the chip as the mark ᴇ", () => {
    const r = read("1.5E-3 m");
    expect(r && "chip" in r ? [r.chip.value, r.shown] : r).toEqual(["1.5e-3", `1.5\\emark-3${unitLatex("m")}`]);
  });
  it_("a unit the catalogue does not hold is refused, named", () => {
    expect(read("20 m/zz")).toEqual({ unknown: "m/zz" });
    expect(read("2 apples")).toEqual({ unknown: "apples" });
    expect(read("2 m//s")).toEqual({ unknown: "m//s" });
    expect(read("2 m·")).toEqual({ unknown: "m·" });
  });
});

describe("readUnitText: the unit text as unitProduct writes it, read back to the same text (the round trip)", () => {
  const texts = ["m", "m²", "m/s", "km/h", "1/s", "psi", "mi", "kg·m²/s³", "m³/(kg·s²)", "N·m", "kWh", "kΩ", "µs", "Ω", "°C", "J/(kg·K)", "m⁴", "cm²", "mm"];
  for (const t of texts)
    it_(t, () => {
      const slot = readUnitText(t, cat, table);
      expect(slot, t).toBeDefined();
      expect(slotText(slot!, table)).toBe(t);
    });
  it_("refuses a text it cannot write back", () => {
    expect(readUnitText("m/", cat, table)).toBeUndefined();
    expect(readUnitText("1/(s)", cat, table)).toBeUndefined(); // unitProduct writes 1/s
    expect(readUnitText("s⁻¹", cat, table)).toBeUndefined(); // unitProduct writes 1/s
    expect(readUnitText("(m)", cat, table)).toBeUndefined();
    expect(readUnitText("", cat, table)).toBeUndefined();
  });
});
