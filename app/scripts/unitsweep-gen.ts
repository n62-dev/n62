// SPDX-License-Identifier: GPL-3.0-or-later
// G800: the unit sweep's random cases (scripts/unitsweep.ts), from a seed and the Find index's units, prefixes and constants. Written
// in app/scripts/unit-case.ts's text ({k:m / h} a slot, {=c} a constant). Two kinds:
//   trip:  v [± σ] in a unit A (a unit, a prefixed one, or a compound of two with a power or a ÷), converted to B (A with each token
//          swapped for another of its dimension or prefix) and back;
//   sigma: (x ± σx) A · (y ± σy) B, the same with ÷, or (x ± σx A)^n, n in 2, 3, −1, −2, 1/2; a product's second factor is now and
//          then a Find constant with its CODATA σ (or an exact one, σ none).
// Only units that convert by a factor are drawn: no °C or °F (an offset), no level, no cycle or power-kind unit (build.ts rulesById),
// no angle or ratio dimension (a rad or % that drops out of the shown unit), no unit without an exact factor.
import { lcg } from "../../tools/probes/sweep/gen.ts";
import type { IndexItem } from "../src/find/types.ts";
import { rulesById } from "../src/units/build.ts";
import type { Input } from "./unitsweep-checks.ts";

export interface Pools {
  /** Units by dimension key: id, factor-1 (coherent SI, which takes a prefix). */
  byDim: Map<string, { id: string; coherent: boolean }[]>;
  dims: string[];
  prefixes: string[];
  /** Constants with a value (and a CODATA σ, when they carry one). */
  consts: { id: string; value: number; unc?: number }[];
}

/** The pools of the index's items. */
export function poolsOf(items: readonly IndexItem[]): Pools {
  const byDim = new Map<string, { id: string; coherent: boolean }[]>();
  const prefixes: string[] = [];
  const consts: Pools["consts"] = [];
  for (const raw of items) {
    const i = raw as unknown as { id: string; kind: string; si?: string; dim?: string; ratio?: boolean; value?: string; unc?: string };
    const id = i.id.slice(i.id.indexOf(":") + 1);
    if (i.kind === "pfx" && /^[a-zA-Z]$/.test(id)) prefixes.push(id === "u" ? "u" : id);
    if (i.kind === "const" && i.value !== undefined && i.dim && /^[A-Za-z_]\w*$/.test(id)) consts.push({ id, value: Number(i.value), ...(i.unc ? { unc: Number(i.unc) } : {}) });
    if (i.kind !== "unit" || !i.si || !i.dim || i.ratio) continue;
    if (!/^[-0-9/*.E^()pi]+$/.test(i.si) || i.si.includes("+") || /rad|Np/.test(i.dim) || rulesById(id)) continue;
    if (!/^[A-Za-zµΩÅ_][\wµΩÅ]*(\^-?\d+)?$/u.test(id)) continue;
    const list = byDim.get(i.dim) ?? [];
    list.push({ id, coherent: i.si === "1" });
    byDim.set(i.dim, list);
  }
  return { byDim, dims: [...byDim.keys()].sort(), prefixes: prefixes.sort(), consts: consts.sort((a, b) => a.id.localeCompare(b.id)) };
}

export type UnitCase =
  | { kind: "trip"; from: string; to: string; v: string; s?: string; digits: number }
  | { kind: "sigma"; shape: "product" | "quotient" | "power"; input: string; a: Input; b?: Input; n?: number; digits: number };

/** The shared text of a number: up to `sig` significant digits, a power of ten 10^`e` on its first. */
function decimal(r: () => number, sig: number, e: number): string {
  const n = 1 + Math.floor(r() * sig);
  let d = String(1 + Math.floor(r() * 9));
  for (let i = 1; i < n; i++) d += String(Math.floor(r() * 10));
  d = d.replace(/0+$/, "") || "1";
  // d1.d2d3… × 10^e, written plain
  const last = e - d.length + 1;
  if (last >= 0) return d + "0".repeat(last);
  if (e < 0) return `0.${"0".repeat(-e - 1)}${d}`;
  return `${d.slice(0, e + 1)}.${d.slice(e + 1)}`;
}

/** σ for a value `v`: 1 or 2 significant digits, 10^-r of it, r from 0 to `deep` (σ with 2 digits never sits on a rounding edge). */
function sigmaFor(r: () => number, v: string, deep: number): string {
  const ve = Math.floor(Math.log10(Math.abs(Number(v))));
  return decimal(r, 2, ve - Math.floor(r() * (deep + 1)));
}

const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
const DIGITS = [4, 6, 8, 10, 12];

/** A token: a unit of `dim`, a prefix on a coherent one now and then. */
function token(r: () => number, p: Pools, dim: string, not?: string): string {
  const list = p.byDim.get(dim)!;
  for (let tries = 0; tries < 8; tries++) {
    const u = pick(r, list);
    const t = u.coherent && r() < 0.5 ? `${pick(r, p.prefixes)}:${u.id}` : u.id;
    if (t !== not) return t;
  }
  const u = list[0]!;
  return u.coherent ? `${pick(r, p.prefixes.filter((x) => `${x}:${u.id}` !== not))}:${u.id}` : u.id;
}

/** A unit slot text and its tokens' dimensions: one token, or two with a ÷ or a power on the second. */
function slot(r: () => number, p: Pools): { text: string; dims: string[]; tail: string[] } {
  const d1 = pick(r, p.dims);
  const t1 = token(r, p, d1);
  if (r() < 0.5) return { text: t1, dims: [d1], tail: [""] };
  const d2 = pick(r, p.dims);
  const t2 = token(r, p, d2);
  const pw = r() < 0.3 && !t2.includes("^") ? "^2" : "";
  return r() < 0.5 ? { text: `${t1} / ${t2}${pw}`, dims: [d1, d2], tail: ["", pw] } : { text: `${t1} ${t2}${pw}`, dims: [d1, d2], tail: ["", pw] };
}

/** A token's power and the slot's other unit: `k:m^2` has the power outside its prefix (unit-case.ts). */
function swapped(r: () => number, p: Pools, from: string, dims: string[], tail: string[]): string {
  const parts = from.split(" ");
  let k = 0;
  return parts
    .map((part) => {
      if (part === "/") return part;
      const i = k++;
      const bare = tail[i] ? part.slice(0, -tail[i]!.length) : part;
      return (r() < 0.75 ? token(r, p, dims[i]!, bare) : bare) + tail[i];
    })
    .join(" ");
}

/** `count` cases from `seed`: about half trips, half σ shapes. */
export function generateUnitCases(seed: number, count: number, p: Pools): UnitCase[] {
  const r = lcg(seed);
  const out: UnitCase[] = [];
  while (out.length < count) {
    const digits = pick(r, DIGITS);
    if (r() < 0.5) {
      const s = slot(r, p);
      let to = swapped(r, p, s.text, s.dims, s.tail);
      if (to === s.text) to = swapped(r, p, s.text, s.dims, s.tail);
      if (to === s.text) continue;
      const v = (r() < 0.2 ? "-" : "") + decimal(r, 12, Math.floor(r() * 25) - 9);
      out.push({ kind: "trip", from: s.text, to, v, ...(r() < 0.75 ? { s: sigmaFor(r, v, 10) } : {}), digits });
      continue;
    }
    const shape = pick(r, ["product", "product", "quotient", "power"] as const);
    const num = (): { text: string; i: Input } => {
      const v = (r() < 0.15 ? "-" : "") + decimal(r, 6, Math.floor(r() * 9) - 3);
      const s = sigmaFor(r, v, 3);
      return { text: `pasupm(${v},${s})`, i: { x: Number(v), s: Number(s) } };
    };
    const ua = slot(r, p).text, ub = slot(r, p).text;
    const a = num();
    if (shape === "power") {
      const n = pick(r, [2, 3, -1, -2, 0.5]);
      const ap = n === 0.5 ? { text: a.text.replace("pasupm(-", "pasupm("), i: { ...a.i, x: Math.abs(a.i.x) } } : a;
      out.push({ kind: "sigma", shape, input: `(${ap.text}*{${ua}})^(${n === 0.5 ? "1/2" : n})`, a: ap.i, n, digits });
      continue;
    }
    const c = shape === "product" && r() < 0.3 ? pick(r, p.consts) : undefined;
    if (c) {
      out.push({ kind: "sigma", shape, input: `${a.text}*{${ua}}*{=${c.id}}`, a: a.i, ...(c.unc ? { b: { x: c.value, s: c.unc } } : {}), digits });
      continue;
    }
    const b = num();
    out.push({ kind: "sigma", shape, input: shape === "product" ? `${a.text}*{${ua}}*${b.text}*{${ub}}` : `${a.text}*{${ua}}/(${b.text}*{${ub}})`, a: a.i, b: b.i, digits });
  }
  return out;
}
