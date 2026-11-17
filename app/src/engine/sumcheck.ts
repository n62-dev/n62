// SPDX-License-Identifier: GPL-3.0-or-later
// G618 (F432, F431): Giac's closed form of a series Σ t over k up to ±∞ is checked against the series' own terms, a
// second route as G59 is for Home's digits (P19). Giac's sum of a rational function gives `infinity` for Σ 1/(k(k+3)),
// 11/24 for Σ 1/(k(k+4)) (right 25/48), 2 − 3 ln 2 < 0 for the positive Σ 1/(k(4k+1)); its causes are G619's.
// - The terms checked: t = A(k) + (−1)^k·B(k) with A and B rational in k (Giac's lvar of t holds only k, (−1)^k and
//   names free of k), A's denominator degree at least 2 above its numerator's, B's at least 1 (the series converges),
//   every pole of A and B left of start + N/2 and none at an integer of the range. Any other term is not checked: an
//   estimate from the first terms says nothing of what comes after them (a bump at k = 1000, cos k / k).
// - The estimate at a cut M: the partial sum of the first M terms in 20 digits, plus A's Euler–Maclaurin tail (∫ of A
//   from start + M on by Giac's numeric quadrature, A/2, −A′/12, A‴/720, −A⁽⁵⁾/30240 there) and the alternating part's tail by Euler's transform
//   (the partial sums from M on averaged pairwise LEVELS times). Its error is far below 1e-12 for such terms; the
//   estimates at M = N and M = 2N must agree to a hundredth of the tolerance, else nothing is decided.
// - The closed form must agree with the estimate to a relative REL (plus 1e-12 of Σ|t| for a sum near 0); an
//   infinity is wrong for such a series outright.
// A sum from −∞ is its reflection (k → −k); from −∞ to ∞, the two halves. About five engine calls per sum.
import type { Giac } from "./numeric.ts";
import { splitList, wordsOf } from "./giacPrint.ts";
import { decimalFromString } from "./format.ts";

/** The first cut; the second is 2N. */
const N = 200;
/** Pairwise averagings of the alternating part's partial sums (Euler's transform). */
const LEVELS = 12;
/** Terms read: enough for the second cut and its averagings. */
const L = 2 * N + LEVELS + 1;
/** The closed form and the estimate agree to this relative difference (Σ 1/(k(k+4)) is off by 1/16 of 25/48). */
export const REL = 1e-8;
/** Name for (−1)^k while the term is split (every pas name is ours, G341). */
const ALT = "pasalt_";
/** The loop name of the term list. */
const J = "pasj_";

/** One half-line Σ_{k ≥ start} of a sum: the term as Giac text and the first index. */
interface Piece {
  term: string;
  start: number;
}

/** A rational part of a term: its text ("0" for none) and its poles. */
interface Part {
  text: string;
  zero: boolean;
  /** denominator degree minus numerator degree */
  gap: number;
  poles: { re: number; im: number }[];
}

/** A Giac number text as a JS number; null for anything else (infinity, undef, a complex, a name). */
function num(t: string): number | null {
  const s = t.trim();
  if (!decimalFromString(s)) return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

/** The half-lines of `sum(t,k,·,·)` whose bounds read `lo`, `hi` (±Infinity for ±∞); null when no end is infinite or a
 *  finite end is not an integer. */
function piecesOf(giac: Giac, t: string, k: string, lo: number, hi: number): Piece[] | null {
  const whole = (v: number): boolean => Number.isInteger(v) && Math.abs(v) <= 1e9;
  const reflected = (): string => giac.eval(`subst(${t},${k},-(${k}))`).trim();
  if (hi === Infinity && whole(lo)) return [{ term: t, start: lo }];
  if (lo === -Infinity && whole(hi)) return [{ term: reflected(), start: -hi }];
  if (lo === -Infinity && hi === Infinity) return [{ term: t, start: 0 }, { term: reflected(), start: 1 }];
  return null;
}

/** The rational part `x` of a term: its degrees and poles, read in one call; null when `x` is not rational in `k`. */
function partOf(giac: Giac, x: string, k: string): Part | null {
  if (x === "0") return { text: x, zero: true, gap: Infinity, poles: [] };
  const n = `normal(${x})`;
  const out = splitList(giac.eval(`[lvar(${x}),degree(numer(${n}),${k}),degree(denom(${n}),${k}),evalf(map(proot(denom(${n}),${k}),pasz_->[re(pasz_),im(pasz_)]))]`));
  if (!out || out.length !== 4) return null;
  const vars = splitList(out[0]!);
  if (!vars || vars.some((v) => v !== k && wordsOf(v).includes(k))) return null;
  const dn = num(out[1]!);
  const dd = num(out[2]!);
  const roots = splitList(out[3]!);
  if (dn === null || dd === null || !roots) return null;
  const poles: Part["poles"] = [];
  for (const r of roots) {
    const z = splitList(r);
    const re = z && z.length === 2 ? num(z[0]!) : null;
    const im = z && z.length === 2 ? num(z[1]!) : null;
    if (re === null || im === null) return null;
    poles.push({ re, im });
  }
  return { text: x, zero: false, gap: dd - dn, poles };
}

/** The term `t` as A + (−1)^k·B with A and B rational in `k` (B "0" when t does not alternate); null for another term. */
function partsOf(giac: Giac, t: string, k: string): [Part, Part] | null {
  const vars = splitList(giac.eval(`lvar(${t})`));
  if (!vars) return null;
  const sign = `(-1)^${k}`;
  if (vars.some((v) => v !== k && v !== sign && wordsOf(v).includes(k))) return null;
  let ab: [string, string] = [t, "0"];
  if (vars.includes(sign)) {
    const g = `subst(${t},${sign},${ALT})`;
    const two = splitList(giac.eval(`[normal((subst(${g},${ALT},1)+subst(${g},${ALT},-1))/2),normal((subst(${g},${ALT},1)-subst(${g},${ALT},-1))/2)]`));
    if (!two || two.length !== 2 || two.some((p) => wordsOf(p).includes(ALT))) return null;
    ab = [two[0]!.trim(), two[1]!.trim()];
  }
  const a = partOf(giac, ab[0], k);
  const b = a && partOf(giac, ab[1], k);
  return a && b ? [a, b] : null;
}

/** The piece converges: A's gap at least 2, B's at least 1, and no pole at an integer of the range (an undefined term). */
function converges([a, b]: [Part, Part], start: number): boolean {
  if (a.gap < 2 || b.gap < 1) return false;
  return ![...a.poles, ...b.poles].some((p) => Math.abs(p.im) < 1e-6 && p.re > start - 1e-6 && Math.abs(p.re - Math.round(p.re)) < 1e-6);
}

/** Every piece of `sum(t,k,·,·)` converges by its terms (partsOf, converges); false when one is not of that kind. */
function piecesConverge(giac: Giac, pieces: Piece[], k: string): boolean {
  return pieces.every((p) => {
    const parts = partsOf(giac, p.term, k);
    return parts !== null && converges(parts, p.start);
  });
}

/**
 * G618: Giac's `value` of `sum(t,k,a,b)`, whose bounds read `lo` and `hi` (±Infinity for ±∞), is refuted by the terms:
 * an infinity for a series of the checked kind (it converges), or a number the estimate from the terms contradicts.
 * False when the terms agree, when they are of another kind, or when the estimate cannot be made (a complex term, a
 * closed form that is not a real number, two cuts that disagree): the value then stands as before.
 */
export function sumRefuted(giac: Giac, t: string, k: string, lo: number, hi: number, value: string): boolean {
  const pieces = piecesOf(giac, t, k, lo, hi);
  if (!pieces) return false;
  if (value.includes("infinity")) return piecesConverge(giac, pieces, k);
  const closed = num(giac.eval(`evalf(${value},30)`));
  if (closed === null) return false;
  let est = [0, 0];
  let scale = 0;
  for (const p of pieces) {
    const e = estimate(giac, p, k);
    if (!e) return false;
    est = [est[0]! + e.at[0], est[1]! + e.at[1]];
    scale += e.scale;
  }
  const tol = REL * Math.max(Math.abs(closed), Math.abs(est[1]!)) + 1e-12 * scale;
  if (Math.abs(est[0]! - est[1]!) > tol / 100) return false;
  return Math.abs(closed - est[1]!) > tol;
}

/** The estimate of one piece at the cuts N and 2N, and Σ|t| over the terms read; null when it cannot be made. */
function estimate(giac: Giac, p: Piece, k: string): { at: [number, number]; scale: number } | null {
  const parts = partsOf(giac, p.term, k);
  if (!parts || !converges(parts, p.start)) return null;
  const [a, b] = parts;
  // A pole near or past the cuts spoils both tails (a bump the first terms do not show).
  if ([...a.poles, ...b.poles].some((q) => q.re > p.start + N / 2)) return null;
  const live = [a, b].filter((x) => !x.zero);
  const rows = splitList(giac.eval(`evalf(seq([${live.map((x) => `subst(${x.text},${k},${J})`).join(",")}],${J},${p.start},${p.start + L - 1}),20)`));
  if (!rows || rows.length !== L) return null;
  const av: number[] = [];
  const bv: number[] = [];
  for (const row of rows) {
    const vals = splitList(row)?.map(num);
    if (!vals || vals.length !== live.length || vals.some((v) => v === null)) return null;
    av.push(a.zero ? 0 : vals[0]!);
    bv.push(b.zero ? 0 : vals[live.length - 1]!);
  }
  let scale = 0;
  for (let j = 0; j < L; j++) scale += Math.abs(av[j]!) + Math.abs(bv[j]!);
  const cuts = [N, 2 * N] as const;
  const tailA = a.zero ? [0, 0] : eulerMaclaurin(giac, a.text, k, cuts.map((m) => p.start + m));
  if (!tailA) return null;
  // The alternating part's partial sums: u_j = (−1)^(start+j)·B(start+j).
  const partial: number[] = [0];
  for (let j = 0; j < L; j++) partial.push(partial[j]! + ((p.start + j) % 2 === 0 ? 1 : -1) * bv[j]!);
  const sumA = (m: number): number => av.slice(0, m).reduce((s, v) => s + v, 0);
  const at = cuts.map((m, i) => sumA(m) + tailA[i]! + (b.zero ? 0 : euler(partial.slice(m, m + LEVELS + 1)))) as [number, number];
  return { at, scale };
}

/** Σ_{k ≥ m} A(k) for each m of `ms` by Euler–Maclaurin to the fifth derivative; null when Giac gives no real number. */
function eulerMaclaurin(giac: Giac, a: string, k: string, ms: number[]): number[] | null {
  const at = (e: string, m: number): string => `subst(${e},${k},${m})`;
  // The integral with a float bound is Giac's numeric quadrature (about 1e-14 here): its exact one gave `infinity` for
  // ∫ 1/(k^7+3) from 201 on, in 144 ms.
  const parts = ms.flatMap((m) => [`int(${a},${k},evalf(${m}),inf)`, at(a, m), at(`diff(${a},${k})`, m), at(`diff(${a},${k},3)`, m), at(`diff(${a},${k},5)`, m)]);
  const vals = splitList(giac.eval(`evalf([${parts.join(",")}],30)`))?.map(num);
  if (!vals || vals.length !== 5 * ms.length || vals.some((v) => v === null)) return null;
  return ms.map((_, i) => {
    const [I, f, d1, d3, d5] = vals.slice(5 * i, 5 * i + 5) as number[];
    return I! + f! / 2 - d1! / 12 + d3! / 720 - d5! / 30240;
  });
}

/** Euler's transform of an alternating series' tail: consecutive partial sums averaged pairwise until one is left. */
export function euler(partials: number[]): number {
  let row = partials;
  while (row.length > 1) row = row.slice(1).map((v, i) => (v + row[i]!) / 2);
  return row[0]!;
}
