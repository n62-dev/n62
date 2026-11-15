// SPDX-License-Identifier: GPL-3.0-or-later
// G272: the uncertainty budget's model, each input's share of σ² (GUM 5.1.2, eq. 10, with its note's second-order
// part as one signed row). UI-free and without words: the sheet words the flags. Exact BigInt arithmetic on the decimal
// text of G271's terms, never a float. Only erasable TypeScript syntax.
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
  return d ? { n: d.neg ? -d.m : d.m, k: d.k } : null;
}

const abs = (n: bigint): bigint => (n < 0n ? -n : n);

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
  const parts = [...input.terms.map((x) => exact(x.t)), ...(input.second !== undefined ? [exact(input.second)] : [])];
  const uys = input.terms.map((x) => uncertaintyText(x.uy));
  if (!input.terms.length || parts.some((p) => p === null) || uys.some((u) => u === null)) return null;
  // one scale for all: the smallest exponent
  const K = Math.min(...parts.map((p) => p!.k));
  const scaled = parts.map((p) => p!.n * 10n ** BigInt(p!.k - K));
  const ts = scaled.slice(0, input.terms.length);
  // a term is a square (∂f/∂x · u)²: a negative one is no term of σ²
  if (ts.some((t) => t < 0n)) return null;
  const b = input.second !== undefined ? scaled[input.terms.length]! : 0n;
  const a = ts.reduce((s, t) => s + t, 0n);
  if (a === 0n && b === 0n) return null;
  if (input.why === "jump" || input.why === "singular") return { reason: input.why };
  if (a === 0n) return { reason: "firstOrderZero" };
  const fallback = a + b <= 0n;
  const D = fallback ? a : a + b;
  const noBasis = new Set(input.noBasis ?? []);
  const rows = input.terms.map((x, i) => {
    const s = shareOf(ts[i]!, D);
    const independent = x.key !== undefined && (x.key.startsWith("pasr_") || noBasis.has(x.key));
    return { i, t: ts[i]!, s, row: { ...(x.key !== undefined ? { key: x.key } : {}), share: s.share, ...(s.small ? { small: true as const } : {}), uy: uys[i]!, ...(independent ? { independent: true as const } : {}) } };
  });
  rows.sort((p, q) => (p.t === q.t ? p.i - q.i : p.t > q.t ? -1 : 1));
  const second = !fallback && b !== 0n ? shareOf(b, D) : null;
  const shown = [...rows.map((r) => r.s), ...(second ? [second] : [])];
  return {
    rows: rows.map((r) => r.row),
    ...(second ? { second: { share: second.share, ...(second.small ? { small: true as const } : {}) } } : {}),
    rounded: shown.reduce((s, x) => s + x.tenths, 0n) !== 1000n,
    over100: shown.some((x) => x.tenths > 1000n),
    fallback,
    ...(input.why ? { why: input.why } : {}),
  };
}
