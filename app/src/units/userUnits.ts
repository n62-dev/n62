// SPDX-License-Identifier: GPL-3.0-or-later
// G233: a unit of your own, built from Find's units (owner's list: "Your own units (built from others)"). A definition
// `{ name, factor, of }` is one more row of the unit evaluator's factor table (factors.ts): `factor` times the units of
// `of` (a UnitSlot of Find ids, as the unit slot gives it), with that slot's dimension and an exact SI factor. Its id in
// every stored token is OWN_PREFIX + name, a character no Find id holds (Find's ids are letters, digits and _ * / ^ ( )),
// so a unit Find gains later under the same name never takes a stored row over. `factor` is stored as decimal text with
// a point whatever the decimal mark (factorText reads what was typed). Plain TS, loaded with the builder (units/calc.ts).
import { unitText, type UnitMessageKey } from "../i18n/enUnits.ts";
import type { IndexItem } from "../find/types.ts";
import { rulesById, slotDim, slotFactor } from "./build.ts";
import { isExponent } from "./dims.ts";
import { bare, isOwnId, OWN_PREFIX, type FactorTable, type UnitFactor } from "./factors.ts";
import { exactFactor, type Exact } from "./slot.ts";
import type { UnitSlot, UnitToken } from "./types.ts";

export { OWN_PREFIX, isOwnId };

export interface UnitDef {
  /** Letters, digits and _, a letter first, at most 24 characters ("myfurlong"). */
  name: string;
  /** Exact decimal text with a point ("201.168", "1.5e-3"), above 0. */
  factor: string;
  /** What one of it is made of, as Find ids (one or more units, prefixes, powers, a ÷). */
  of: UnitSlot;
}

export type DefCheck = { ok: true } | { ok: false; key: UnitMessageKey; message: string };

export const ownId = (name: string): string => OWN_PREFIX + name;
export const ownToken = (name: string, prefix?: string): UnitToken => ({ ...(prefix !== undefined ? { prefix } : {}), unit: ownId(name) });

const refuse = (key: UnitMessageKey, vars?: Readonly<Record<string, string>>): { ok: false; key: UnitMessageKey; message: string } =>
  ({ ok: false, key, message: unitText(key, vars) });

/** Find's names that a name of your own may not take: every unit's and prefix's id and names, each to the symbol a
 *  message shows (a unit's first name, a prefix's id: fur, M). */
export interface FindNames {
  units: ReadonlyMap<string, string>;
  prefixes: ReadonlyMap<string, string>;
}

export function findNames(items: readonly IndexItem[]): FindNames {
  const units = new Map<string, string>();
  const prefixes = new Map<string, string>();
  for (const it of items) {
    if (it.kind !== "unit" && it.kind !== "pfx") continue;
    const id = bare(it.id);
    const to = it.kind === "unit" ? units : prefixes;
    for (const n of [id, ...it.names]) if (!to.has(n)) to.set(n, it.kind === "pfx" ? id : (it.names[0] ?? id));
  }
  return { units, prefixes };
}

const isDigit = (c: string): boolean => c >= "0" && c <= "9";
/** A letter of any script with a case (a–z, µ, Ω, é): by its case, no pattern (G88). */
const isLetter = (c: string): boolean => c.toLowerCase() !== c.toUpperCase();

function goodName(name: string): boolean {
  const cs = [...name];
  return cs.length >= 1 && cs.length <= 24 && isLetter(cs[0]!) && cs.every((c) => isLetter(c) || isDigit(c) || c === "_");
}

/** Decimal text with a point as an exact fraction: digits, an optional point and digits, an optional e with a sign and
 *  at most two digits ("201.168", "1.5e-3"); undefined for anything else. By character, no pattern (G88). */
function decimal(s: string): { n: bigint; d: bigint } | undefined {
  let i = 0;
  const run = (): string => {
    const j = i;
    while (i < s.length && isDigit(s[i]!)) i++;
    return s.slice(j, i);
  };
  const int = run();
  if (!int || s.length > 40) return undefined;
  let frac = "";
  if (s[i] === ".") {
    i++;
    frac = run();
    if (!frac) return undefined;
  }
  let exp = 0;
  if (s[i] === "e" || s[i] === "E") {
    i++;
    const neg = s[i] === "-";
    if (s[i] === "-" || s[i] === "+") i++;
    const e = run();
    if (!e || e.length > 2) return undefined;
    exp = neg ? -Number(e) : Number(e);
  }
  if (i !== s.length) return undefined;
  const k = exp - frac.length;
  const m = BigInt(int + frac);
  return k >= 0 ? { n: m * 10n ** BigInt(k), d: 1n } : { n: m, d: 10n ** BigInt(-k) };
}

/** The factor as typed, with the session's decimal mark, as the text a definition stores (a point). The other mark is
 *  refused, never read as a group separator (201,168 with the point mark is no 201168). */
export function factorText(typed: string, mark: "point" | "comma"): { ok: true; text: string } | { ok: false; key: UnitMessageKey; message: string } {
  const t = typed.trim();
  const other = mark === "comma" ? "." : ",";
  const text = t.includes(other) ? "" : mark === "comma" ? t.split(",").join(".") : t;
  const v = decimal(text);
  if (!v) return refuse("units.own.factor", { factor: typed });
  return v.n === 0n ? refuse("units.own.zero") : { ok: true, text };
}

const gcd = (a: bigint, b: bigint): bigint => (b ? gcd(b, a % b) : a < 0n ? -a : a);

/** An exact factor as Giac text, reduced ("25146/125", "pi/180", "3/(8*pi^2)"). */
function exactText(e: Exact): string {
  const sign = e.d < 0n ? -1n : 1n;
  const g = gcd(e.n, e.d) || 1n;
  const n = (sign * e.n) / g, d = (sign * e.d) / g;
  const k = Math.abs(e.pi);
  const pi = k === 1 ? "pi" : `pi^${k}`;
  if (e.pi > 0) return d === 1n ? `${n}*${pi}` : `${n}*${pi}/${d}`;
  if (e.pi < 0) return `${n}/(${d}*${pi})`;
  return d === 1n ? `${n}` : `${n}/${d}`;
}

/** `of`'s factor to SI times `f`, exactly: reduced when every factor reads as n/d·π^k and every power is an integer, else
 *  as Giac text (a half power: build.ts slotFactor, the text the builder writes for a slot). */
function ofSi(f: { n: bigint; d: bigint }, of: UnitSlot, table: FactorTable): string {
  const per = of.per ?? of.tokens.length;
  let acc: Exact | undefined = { n: f.n, d: f.d, pi: 0 };
  of.tokens.forEach((t, i) => {
    const p = t.prefix === undefined ? { n: 1n, d: 1n, pi: 0 } : exactFactor(table.prefixes.get(t.prefix)!.si);
    const u = exactFactor(table.units.get(t.unit)!.si!);
    const k = Number(t.power ?? "1");
    if (!acc || !p || !u || !Number.isInteger(k) || Math.abs(k) > 64) return (acc = undefined);
    const inv = (k < 0) !== i >= per;
    for (let j = 0; j < Math.abs(k); j++)
      acc = inv ? { n: acc.n * p.d * u.d, d: acc.d * p.n * u.n, pi: acc.pi - p.pi - u.pi } : { n: acc.n * p.n * u.n, d: acc.d * p.d * u.d, pi: acc.pi + p.pi + u.pi };
  });
  return acc ? exactText(acc) : `(${f.n}/${f.d})*${slotFactor(of, table)}`;
}

/** A definition as a row of the factor table, or why it is refused. Its name is not checked against Find here (a
 *  stored definition keeps its value when Find gains its name); validateDef does that for a new one. */
function rowOf(def: UnitDef, table: FactorTable): { ok: true; row: UnitFactor } | { ok: false; key: UnitMessageKey; message: string } {
  if (typeof def.name !== "string" || !goodName(def.name)) return refuse("units.own.name");
  const f = typeof def.factor === "string" ? decimal(def.factor) : undefined;
  if (!f) return refuse("units.own.factor", { factor: String(def.factor) });
  if (f.n === 0n) return refuse("units.own.zero");
  const of = def.of as Partial<UnitSlot> | undefined;
  const tokens = Array.isArray(of?.tokens) ? of.tokens : [];
  const per = of?.per;
  if (tokens.length === 0 || tokens.length > 16 || (per !== undefined && !(Number.isInteger(per) && per >= 1 && per < tokens.length)))
    return refuse("units.own.ofEmpty");
  for (const t of tokens) {
    if (typeof t?.unit !== "string" || (t.power !== undefined && (typeof t.power !== "string" || !isExponent(t.power) || Number(t.power) === 0)))
      return refuse("units.own.ofEmpty");
    if (isOwnId(t.unit)) return refuse("units.own.ofOwn", { unit: t.unit.slice(OWN_PREFIX.length) });
    const u = table.units.get(t.unit);
    if (!u) return refuse("units.own.unknown", { unit: t.unit });
    if (t.prefix !== undefined && (typeof t.prefix !== "string" || !table.prefixes.has(t.prefix))) return refuse("units.own.unknown", { unit: String(t.prefix) });
    if (u.si === undefined || u.dim === undefined || u.si.includes("+") || u.dim.includes("Np") || rulesById(t.unit))
      return refuse("units.own.ofKind", { unit: u.symbol });
  }
  const slot: UnitSlot = { tokens, ...(per !== undefined ? { per } : {}) };
  return { ok: true, row: { si: ofSi(f, slot, table), dim: slotDim(slot, table), symbol: def.name } };
}

/** Whether a definition holds as it is stored: its name's form, its factor, its `of` against Find's table. */
export function checkDef(def: UnitDef, table: FactorTable): DefCheck {
  const r = rowOf(def, table);
  return r.ok ? { ok: true } : r;
}

/** A new definition: checkDef, and a name that is none of Find's (a unit's or prefix's id or name, or a prefix and a
 *  unit read together, as a typed name would be: Mm, kilofurlong) nor one of `defs` (your units so far). */
export function validateDef(def: UnitDef, table: FactorTable, names: FindNames, defs: readonly UnitDef[] = []): DefCheck {
  if (typeof def.name !== "string" || !goodName(def.name)) return refuse("units.own.name");
  const name = def.name;
  const hit = names.units.get(name) ?? names.prefixes.get(name);
  if (hit !== undefined) return refuse("units.own.clash", { name, unit: hit });
  for (let i = 1; i < name.length; i++) {
    const prefix = names.prefixes.get(name.slice(0, i));
    const unit = names.units.get(name.slice(i));
    if (prefix !== undefined && unit !== undefined) return refuse("units.own.pair", { name, prefix, unit });
  }
  if (defs.some((d) => d.name === name)) return refuse("units.own.twice", { name });
  return checkDef(def, table);
}

/** Find's table with your units added under their own ids (OWN_PREFIX + name); Find's rows stay as they are. A
 *  definition that does not hold, or a name given twice, is left out (a slot that names it is then refused as a unit
 *  not in the table, never read with another value). */
export function mergedTable(table: FactorTable, defs: readonly UnitDef[]): FactorTable {
  if (!defs.length) return table;
  const count = new Map<string, number>();
  for (const d of defs) count.set(d.name, (count.get(d.name) ?? 0) + 1);
  const units = new Map(table.units);
  for (const d of defs) {
    const r = count.get(d.name) === 1 ? rowOf(d, table) : undefined;
    if (r?.ok) units.set(ownId(d.name), r.row);
  }
  return { ...table, units };
}
