// SPDX-License-Identifier: GPL-3.0-or-later
// G234: the stored record of the units of your own (G233, userUnits.ts), as plain TS the store (ownUnits.ts) and
// the backup's check (state/backup.ts) both read, so a restore refuses exactly what the start would drop. Stamped store
// key `units.own`: `{ units: [{ name, factor, of }] }`, `of` a UnitSlot of Find ids. Nothing here knows Find's table (no
// index is read): whether an id is a unit Find has is checked where a definition is used (userUnits.ts rowOf).
import { isExponent } from "./dims.ts";
import { OWN_PREFIX } from "./factors.ts";
import type { UnitSlot } from "./types.ts";

/** The key of the stamped store (state/storage.ts) that holds your units. */
export const UNITS_OWN = "units.own";

export interface UnitDef {
  /** Letters, digits and _, a letter first, at most 24 characters ("myfurlong"). */
  name: string;
  /** Exact decimal text with a point ("201.168", "1.5e-3"), above 0. */
  factor: string;
  /** What one of it is made of, as Find ids (one or more units, prefixes, powers, a ÷). */
  of: UnitSlot;
}

export const MAX_NAME = 24;
export const MAX_TOKENS = 16;

export const isDigit = (c: string): boolean => c >= "0" && c <= "9";
/** A letter of any script with a case (a–z, µ, Ω, é): by its case, no pattern (G88). */
export const isLetter = (c: string): boolean => c.toLowerCase() !== c.toUpperCase();

export function goodName(name: string): boolean {
  const cs = [...name];
  return cs.length >= 1 && cs.length <= MAX_NAME && isLetter(cs[0]!) && cs.every((c) => isLetter(c) || isDigit(c) || c === "_");
}

/** Decimal text with a point as an exact fraction: digits, an optional point and digits, an optional e with a sign and
 *  at most two digits ("201.168", "1.5e-3"); undefined for anything else. By character, no pattern (G88). */
export function decimal(s: string): { n: bigint; d: bigint } | undefined {
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

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (x: unknown): x is string => typeof x === "string" && x !== "";
/** Every key of `o` is one of `known` (a field this version does not know is a fault, as in backup.ts `fields`). */
const only = (o: Record<string, unknown>, known: readonly string[]): boolean => Object.keys(o).every((k) => known.includes(k));

/** A unit slot as stored: one to MAX_TOKENS tokens, each a unit id (never one of your own) with an optional prefix id and
 *  an optional non-zero power; `per`, when there, a whole number from 1 to the last token. No other field. */
export function slotShapeOk(of: unknown): of is UnitSlot {
  if (!isObject(of) || !only(of, ["tokens", "per"])) return false;
  const tokens = of["tokens"];
  if (!Array.isArray(tokens) || tokens.length < 1 || tokens.length > MAX_TOKENS) return false;
  const per = of["per"];
  if (per !== undefined && !(typeof per === "number" && Number.isInteger(per) && per >= 1 && per < tokens.length)) return false;
  return tokens.every((t: unknown) => {
    if (!isObject(t) || !only(t, ["prefix", "unit", "power"]) || !text(t["unit"]) || t["unit"].startsWith(OWN_PREFIX)) return false;
    if (t["prefix"] !== undefined && !text(t["prefix"])) return false;
    const p = t["power"];
    return p === undefined || (typeof p === "string" && isExponent(p) && Number(p) !== 0);
  });
}

/** One definition as stored: the three fields and no other, a good name, a factor above 0, a slot that is a UnitSlot. */
export function defShapeOk(d: unknown): d is UnitDef {
  if (!isObject(d) || !only(d, ["name", "factor", "of"])) return false;
  const f = typeof d["factor"] === "string" ? decimal(d["factor"]) : undefined;
  return typeof d["name"] === "string" && goodName(d["name"]) && f !== undefined && f.n !== 0n && slotShapeOk(d["of"]);
}

/** The whole record, strictly (the backup's check): `{ units: [...] }` and no other field, every definition good, no
 *  name twice (mergedTable would leave both out, so a restore would lose them silently). */
export function recordOk(v: unknown): boolean {
  if (!isObject(v) || !only(v, ["units"]) || !Array.isArray(v["units"])) return false;
  const names = new Set<string>();
  for (const d of v["units"] as unknown[]) {
    if (!defShapeOk(d) || names.has(d.name)) return false;
    names.add(d.name);
  }
  return true;
}

/** The definitions of a stored record as the start reads it: the good ones, a copy, the first of a name only (a second
 *  of it would leave both out of the table; recordOk refuses such a record); anything else (no record, a record of
 *  another shape, a damaged entry) gives none or fewer, never a throw. */
export function readRecord(v: unknown): UnitDef[] {
  if (!isObject(v) || !Array.isArray(v["units"])) return [];
  const out: UnitDef[] = [];
  for (const d of v["units"] as unknown[]) if (defShapeOk(d) && !out.some((o) => o.name === d.name)) out.push(structuredClone(d));
  return out;
}
