// SPDX-License-Identifier: GPL-3.0-or-later
// G272: the uncertainty budget's model, each input's share of σ² (GUM 5.1.2, eq. 10, with its note's second-order
// part as one signed row). UI-free and without words: the sheet words the flags. Exact BigInt arithmetic on the decimal
// text of G271's terms, never a float; parts more than EXACT_SPREAD orders apart are bounded, not scaled. Only erasable
// TypeScript syntax.
//
// The model has no cross terms: inputs that share a leaf are modelled by the leaf; a result chip (R61, `pasr_`), a
// constant with no basis and CODATA's leaf correlations are taken as independent, so σ and the shares can be off in
// either direction there (`independent` marks the row; GUM 5.2).
import { parseDecimal, uncertaintyText } from "../units/uncertainty.ts";
import type { UncWhy } from "../units/types.ts";

/** What the budget is made from: Uncertainty.terms and .second (G271), its ⚠ reason, and the keys of the constants
 *  that have no basis (the caller's, constBasis.ts basisOf). */
export interface BudgetInput {
  terms: readonly { key?: string; t: string; uy: string }[];
  /** The second-order part b of σ²; absent where σ is first order (Home). */
  second?: string;
  why?: UncWhy;
  noBasis?: readonly string[];
}

/** A share of σ² in percent: `share` is its decimal text rounded to 0.1 ("98.3", "-4.2"), "0" for an exact 0. With
 *  `small` its magnitude is below 0.05 and `share` is the bound ("0.1" read "< 0.1", "-0.1" read "> −0.1"). */
export interface BudgetShare {
  share: string;
  small?: true;
}

/** An input's row: its key (none for a typed ±), its |∂f/∂x · u| at 2 significant digits, and `independent` for a
 *  result chip or a constant with no basis (taken as independent of the other inputs, not known to be). */
export interface BudgetRow extends BudgetShare {
  key?: string;
  uy: string;
  independent?: true;
}

/** Why no shares are shown: σ crossed a jump or a singular point (a derivative there would mislead), or the first
 *  order is 0 and σ is the second order alone. */
export type BudgetReason = "jump" | "singular" | "firstOrderZero";

export interface BudgetShares {
  /** Largest share first, input order on a tie. */
  rows: BudgetRow[];
  /** The second-order part's signed share, when it is given, nonzero and part of the base. */
  second?: BudgetShare;
  /** The shown shares (a small one counted as 0) do not sum to 100.0. */
  rounded: boolean;
  /** R328: that sum as decimal text to 0.1 ("99.9", "100.0"), the number the rounded line states. */
  total: string;
  /** A share reads above 100.0. */
  over100: boolean;
  /** a + b ≤ 0: the base is a alone (as pasuo, evaluate.ts), no second-order row. */
  fallback: boolean;
  why?: UncWhy;
}

/** The budget of σ²: shares, a reason for none, or null for no budget (σ 0, or a term that is not a decimal). */
export type Budget = BudgetShares | { reason: BudgetReason } | null;

/** A decimal as an integer count of 10^k. */
type Exact = { n: bigint; k: number };

function exact(text: string): Exact | null {
  const d = parseDecimal(text);
  // an exponent past 2^53 ("1E99999999999999999999") is no place BigInt can scale to
  return d && Number.isSafeInteger(d.k) ? { n: d.neg ? -d.m : d.m, k: d.k } : null;
}

const abs = (n: bigint): bigint => (n < 0n ? -n : n);
/** The place of the leading digit (a nonzero part): |p| < 10^(top + 1). */
const top = (p: Exact): number => abs(p.n).toString().length - 1 + p.k;

/** |p| against |q| exactly, without scaling across their magnitudes: −1, 0 or 1. */
function compare(p: Exact, q: Exact): number {
  if (p.n === 0n || q.n === 0n) return (p.n !== 0n ? 1 : 0) - (q.n !== 0n ? 1 : 0);
  if (top(p) !== top(q)) return top(p) < top(q) ? -1 : 1;
  // one leading place: the shift is the difference of the digit counts, bounded by the texts
  const K = Math.min(p.k, q.k);
  const [x, y] = [abs(p.n) * 10n ** BigInt(p.k - K), abs(q.n) * 10n ** BigInt(q.k - K)];
  return x === y ? 0 : x < y ? -1 : 1;
}

/** Parts whose exponents lie at most this many orders apart are summed exactly (10^1000 is a 3.3 kbit BigInt). */
const EXACT_SPREAD = 1000;
/** Farther apart (Giac's text at a high precision, "1E-400000000"): a part this many orders below the largest one is
 *  only bounded, |v| < 10^(M − TINY), its sign kept; the shown result must then be the same at either end of the
 *  bound, else no budget. */
const TINY = 500;

/** 100·t/D rounded on its own to 0.1, half away from zero (D > 0). */
function shareOf(t: bigint, D: bigint): BudgetShare & { tenths: bigint } {
  if (t === 0n) return { share: "0", tenths: 0n };
  const sign = t < 0n ? "-" : "";
  if (2000n * abs(t) < D) return { share: `${sign}0.1`, small: true, tenths: 0n };
  const q = (1000n * abs(t)) / D;
  const r = 2n * ((1000n * abs(t)) % D) >= D ? q + 1n : q;
  return { share: `${sign}${r / 10n}.${r % 10n}`, tenths: t < 0n ? -r : r };
}

export function budgetOf(input: BudgetInput): Budget {
  const terms = input.terms.map((x) => exact(x.t));
  const sec = input.second !== undefined ? exact(input.second) : undefined;
  const uys = input.terms.map((x) => (exact(x.uy) ? uncertaintyText(x.uy) : null));
  if (!terms.length || sec === null || uys.some((u) => u === null) || !terms.every((p) => p !== null)) return null;
  // a term is a square (∂f/∂x · u)²: a negative one is no term of σ²
  if (terms.some((p) => p.n < 0n)) return null;
  const aZero = terms.every((p) => p.n === 0n);
  if (aZero && (sec?.n ?? 0n) === 0n) return null;
  if (input.why === "jump" || input.why === "singular") return { reason: input.why };
  if (aZero) return { reason: "firstOrderZero" };
  // one scale for the parts summed exactly: the smallest exponent among them (a 0's exponent counts for nothing)
  const parts = [...terms, ...(sec ? [sec] : [])];
  const nonzero = parts.filter((p) => p.n !== 0n);
  const near = Math.max(...nonzero.map((p) => p.k)) - Math.min(...nonzero.map((p) => p.k)) <= EXACT_SPREAD;
  const M = Math.max(...nonzero.map(top));
  const tiny = (p: Exact): boolean => !near && p.n !== 0n && top(p) < M - TINY;
  const K = Math.min(...nonzero.filter((p) => !tiny(p)).map((p) => p.k), ...(near ? [] : [M - TINY]));
  const scale = (p: Exact): bigint => (p.n === 0n || tiny(p) ? 0n : p.n * 10n ** BigInt(p.k - K));
  // the bound of one tiny part, and of their sum, in units of 10^K (0 when every part is summed exactly)
  const unit = near ? 0n : 10n ** BigInt(M - TINY - K);
  const E = unit * BigInt(parts.filter(tiny).length);
  const ts = terms.map(scale);
  const b = sec ? scale(sec) : 0n;
  const a = ts.reduce((s, t) => s + t, 0n);
  // a + b ≤ 0 (as pasuo, which then uses a), decided only where the tiny parts cannot change it
  if (a + b - E <= 0n && a + b + E > 0n) return null;
  const fallback = a + b + E <= 0n;
  const D = fallback ? a : a + b;
  if (D - E <= 0n) return null;
  const shareAt = (p: Exact, t: bigint, d: bigint): (BudgetShare & { tenths: bigint }) | null =>
    !tiny(p) ? shareOf(t, d) : 2000n * unit <= d ? { share: p.n < 0n ? "-0.1" : "0.1", small: true, tenths: 0n } : null;
  const at = (d: bigint) => [...terms.map((p, i) => shareAt(p, ts[i]!, d)), ...(sec && !fallback && sec.n !== 0n ? [shareAt(sec, b, d)] : [])];
  // a share is monotonic in the base, so one result at both ends of D's bound is the result for every D between them
  const text = (xs: ReturnType<typeof at>): string => xs.map((s) => (s ? s.share + (s.small ? "<" : "") : "?")).join(" ");
  const shown = at(D - E);
  if (!shown.every((s) => s !== null) || (E > 0n && text(shown) !== text(at(D + E)))) return null;
  const noBasis = new Set(input.noBasis ?? []);
  const rows = input.terms.map((x, i) => {
    const s = shown[i]!;
    const independent = x.key !== undefined && (x.key.startsWith("pasr_") || noBasis.has(x.key));
    return { i, s, row: { ...(x.key !== undefined ? { key: x.key } : {}), share: s.share, ...(s.small ? { small: true as const } : {}), uy: uys[i]!, ...(independent ? { independent: true as const } : {}) } };
  });
  rows.sort((p, q) => compare(terms[q.i]!, terms[p.i]!) || p.i - q.i);
  const second = shown.length > terms.length ? shown[terms.length]! : null;
  const sum = shown.reduce((s, x) => s + x.tenths, 0n);
  return {
    rows: rows.map((r) => r.row),
    ...(second ? { second: { share: second.share, ...(second.small ? { small: true as const } : {}) } } : {}),
    rounded: sum !== 1000n,
    total: `${sum < 0n ? "-" : ""}${abs(sum) / 10n}.${abs(sum) % 10n}`,
    over100: shown.some((x) => x.tenths > 1000n),
    fallback,
    ...(input.why ? { why: input.why } : {}),
  };
}
