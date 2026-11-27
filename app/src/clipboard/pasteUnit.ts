// SPDX-License-Identifier: GPL-3.0-or-later
// R325: Paste reads a unit row's Copy text back (docs/04 2.6, P5): `20 m/s`, `39.488 ± 1.2 m²` (`39,488 ± 1,2 m²` with the
// decimal comma), the value and σ as paste.ts reads a number, the unit as unitProduct writes it (`·` between factors,
// one `/`, a bracket below it, the powers powerText writes), each factor read to Find ids (readSymbol, R313; else the
// symbol a slot draws). It becomes R61's result chip (units/chip.ts quantityChip): the number in the unit shown, σ in the
// same unit, the unit as label and slot, so the units key fills the slot after it. The unit is taken only when slotText
// of the slot read gives the pasted text back: never a guessed unit. A lazy chunk of its own (the clipboard actions load
// it when the text is not a number); pure but unitCatalogue, which loads the Find index.
import { chipUnit, unitLatex } from "../input/chipUnit.ts";
import type { Chip } from "../input/chips.ts";
import { slotDim, slotText } from "../units/build.ts";
import type { FindIndex } from "../find/finder.ts";
import { factorTable, type FactorTable } from "../units/factors.ts";
import { readSymbol, slotCatalogue, type SlotCatalogue } from "../units/slot.ts";
import type { UnitSlot, UnitToken } from "../units/types.ts";
import { latexOf, parseReal, pasteText, realPattern, type Real } from "./paste.ts";
import type { TextOptions } from "./text.ts";

/** A text of the form `<number> [± <number>] <unit>`: each number as Giac text and as the keys type it, the unit as pasted. */
export interface QuantityText {
  value: string;
  valueLatex: string;
  sigma?: string;
  sigmaLatex?: string;
  /** The unit text, not yet read (`m²`, `m/s`). */
  unit: string;
}

/** The chip a unit row's Copy text gives, drawn as `shown`; or the unit text no unit of the catalogue writes. */
export type PastedQuantity = { shown: string; chip: Chip } | { unknown: string };

const catalogues = new WeakMap<FindIndex, readonly [SlotCatalogue, FactorTable]>();

/** The unit catalogue and factor table of the Find index, which Paste waits for (hurried, as a Math press or Help hurries
 *  it: finder.ts loadIndex); built once per index. */
export async function unitCatalogue(): Promise<readonly [SlotCatalogue, FactorTable]> {
  const index = await (await import("../find/finder.ts")).loadIndex(true);
  const had = catalogues.get(index);
  if (had) return had;
  const made = [slotCatalogue(index.items), factorTable(index.items)] as const;
  catalogues.set(index, made);
  return made;
}

/** The number as Giac text with a point (chipToGiac makes it exact): `-1.5e-3`. */
const giacOf = (r: Real): string => `${r.neg ? "-" : ""}${r.int}${r.frac ? `.${r.frac}` : ""}${r.exp !== 0 ? `e${r.exp}` : ""}`;
const isZero = (r: Real): boolean => !/[1-9]/.test(r.int + r.frac);

/** The form `<number> [± <number>] <unit>`, the unit one run without spaces that starts as a unit does (a letter or a
 *  symbol, or `1/`); null for anything else, so `1.5 ± 0.2` (no unit) stays "not a number". Syntax only. */
export function quantityText(clip: string, o: TextOptions = {}): QuantityText | null {
  const s = pasteText(clip);
  const m = s === null ? null : /^(\S+)(?:\s*±\s*(\S+))?\s+(\S+)$/.exec(s);
  if (!m) return null;
  const [, v = "", sg0, unit = ""] = m;
  if (!/^(?:1\/|[^\d+\-±.,(){}[\]⚠])/.test(unit)) return null;
  // R886f1: a unit row's Copy text writes σ's warning as `± ⚠0.64`; the one sign right after ± is taken off, no other
  const sg = sg0?.startsWith("⚠") ? sg0.slice(1) : sg0;
  const comma = o.decimalComma === true;
  const re = realPattern(comma ? "," : String.raw`\.`);
  const value = parseReal(v, re);
  const sigma = sg === undefined ? undefined : parseReal(sg, re);
  if (!value || sigma === null || sigma?.neg === true || /^[+-]/.test(sg ?? "")) return null;
  return {
    value: giacOf(value),
    valueLatex: latexOf(value, comma),
    ...(sigma ? { sigma: giacOf(sigma), sigmaLatex: latexOf(sigma, comma) } : {}),
    unit,
  };
}

/** The chip of a unit row's Copy text (quantityChip's shape): the value as pasted, never exact with a σ (R61), σ in the
 *  unit shown (a zero σ dropped, as quantityChip drops it), the unit with its dimension and slot. */
export function readQuantity(q: QuantityText, cat: SlotCatalogue, table: FactorTable): PastedQuantity {
  const slot = readUnitText(q.unit, cat, table);
  // (chipUnit: the shape a stored chip's unit is checked against; a pure number has no dimension key and fails it)
  const unit = slot && chipUnit({ value: "", exact: false, unit: { text: q.unit, dim: slotDim(slot, table), slot } });
  if (!unit) return { unknown: q.unit };
  const shown = `${q.valueLatex}${q.sigmaLatex !== undefined ? `\\pm${q.sigmaLatex}` : ""}${unitLatex(q.unit)}`;
  if (q.sigma === undefined) return { shown, chip: { value: q.value, exact: true, unit } };
  const unc = /[1-9]/.test(q.sigma.replace(/e.*$/, "")) ? { unc: q.sigma } : {};
  return { shown, chip: { value: q.value, exact: false, reliableDigits: null, ...unc, unit } };
}

const POWER: Readonly<Record<string, string>> = { "⁻": "-", "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };

/** A unit text as unitProduct writes it, as a slot of Find ids (the factors after `/` below `per`), when slotText writes
 *  that slot as the same text; else undefined. */
export function readUnitText(text: string, cat: SlotCatalogue, table: FactorTable): UnitSlot | undefined {
  const parts = text.split("/");
  if (parts.length > 2) return undefined;
  const [top = "", below] = parts;
  const up = below !== undefined && top === "1" ? [] : factorsOf(top, cat, table);
  const down = below === undefined ? [] : factorsOf(/^\(.*\)$/.test(below) ? below.slice(1, -1) : below, cat, table);
  if (!up || !down) return undefined;
  const slot: UnitSlot = { tokens: [...up, ...down], ...(below !== undefined ? { per: up.length } : {}) };
  return slotText(slot, table) === text ? slot : undefined;
}

function factorsOf(s: string, cat: SlotCatalogue, table: FactorTable): UnitToken[] | undefined {
  const out: UnitToken[] = [];
  for (const f of s.split("·")) {
    const t = factorOf(f, cat, table);
    if (!t) return undefined;
    out.push(t);
  }
  return out;
}

/** One factor: a symbol with the power powerText writes (`m²`, `s⁻¹`, `m^(1/2)`); a symbol that itself ends in a
 *  superscript is tried whole too. */
function factorOf(f: string, cat: SlotCatalogue, table: FactorTable): UnitToken | undefined {
  const m = /^(.+?)(⁻?[⁰¹²³⁴⁵⁶⁷⁸⁹]+|\^\(-?\d+\/\d+\))?$/.exec(f);
  if (!m) return undefined;
  const [, sym = "", p] = m;
  const power = p === undefined ? "1" : p.startsWith("^") ? p.slice(2, -1) : [...p].map((c) => POWER[c] ?? c).join("");
  const t = symbolToken(sym, cat, table);
  if (t) return power === "1" ? t : { ...t, power };
  return p === undefined ? undefined : symbolToken(f, cat, table);
}

/** The token a slot draws as `sym`: the symbol a keyboard types (readSymbol, R313), else the symbol of a unit of the
 *  catalogue, alone or after a prefix's symbol (`kΩ`, `µs`, `°C`), as slotText writes them. */
function symbolToken(sym: string, cat: SlotCatalogue, table: FactorTable): UnitToken | undefined {
  const fits = (t: UnitToken | undefined): UnitToken | undefined => (t && slotText({ tokens: [t] }, table) === sym ? t : undefined);
  const typed = fits(readSymbol(cat, sym));
  if (typed) return typed;
  const { units, prefixes } = symbolsOf(cat, table);
  const whole = units.get(sym);
  if (whole !== undefined) return fits({ unit: whole });
  for (const [p, prefix] of prefixes) {
    const unit = sym.startsWith(p) ? units.get(sym.slice(p.length)) : undefined;
    const t = unit === undefined ? undefined : fits({ prefix, unit });
    if (t) return t;
  }
  return undefined;
}

interface Symbols {
  units: ReadonlyMap<string, string>;
  /** Prefix symbols, the longest first (`da` before `d`). */
  prefixes: readonly (readonly [string, string])[];
}
const symbolCache = new WeakMap<FactorTable, Symbols>();

/** Each unit's and prefix's symbol as a slot draws it, to its id; a symbol two units share goes to the one the
 *  catalogue ranks first (tier, then id). */
function symbolsOf(cat: SlotCatalogue, table: FactorTable): Symbols {
  const had = symbolCache.get(table);
  if (had) return had;
  const units = new Map<string, string>();
  for (const id of cat.units.keys()) {
    const sym = table.units.has(id) ? slotText({ tokens: [{ unit: id }] }, table) : "";
    if (sym !== "" && !units.has(sym)) units.set(sym, id);
  }
  const prefixes = [...table.prefixes].map(([id, p]) => [p.symbol, id] as const).filter(([s]) => s !== "").sort((a, b) => b[0].length - a[0].length);
  const made = { units, prefixes };
  symbolCache.set(table, made);
  return made;
}
