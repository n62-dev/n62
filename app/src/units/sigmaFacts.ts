// SPDX-License-Identifier: GPL-3.0-or-later
// R271f1: σ's mark, decided once in the evaluator. A σ that took a result chip's facts keeps them (Uncertainty.chip) and
// limits the result: evaluate.ts done folds σ's confirmed digits and ⚠ reason into the value's facts, so the unit view,
// the Home row (units/row.ts), Copy and the chip (units/chip.ts) all read one stored fact under every setting and after
// a relaunch. A typed σ limits nothing (its row stays ≈). R286: σ's digits limit the value at σ's decade, not as a
// count. Pure; only erasable TypeScript.
import { isZero, type DecimalValue, type PrecisionWarn } from "../engine/format.ts";
import type { SigmaFacts } from "./types.ts";

/** The magnitudes of the value and of σ (their first digits' decades, DecimalValue.exp). */
export interface SigmaAt {
  value: DecimalValue | undefined;
  sigma: DecimalValue | undefined;
}

/** R286: σ's confirmed digits as the value's: σ's n digits end at the decade σ.exp − n + 1, and the value is known to
 *  that decade: n plus the decades from σ's first digit up to the value's (1000.5 ± 0.0707 with 3: 3 + 3 + 2 = 8);
 *  none below 0. Without `at`, or with a value or σ of zero, σ's count as it is. Null: σ limits no digit. */
export function limitDigits(s: SigmaFacts, at?: SigmaAt): number | null {
  const n = s.reliableDigits;
  const v = at?.value;
  const g = at?.sigma;
  if (n === null || !v || !g || isZero(v) || isZero(g)) return n;
  return Math.max(0, n + v.exp - g.exp);
}

/** `facts` limited by `s`: the fewer confirmed digits of the two (null limits nothing), σ's taken at `at` (limitDigits);
 *  the value's ⚠ reason, else σ's. */
export function worseFacts<F extends { reliableDigits: number | null; warn?: PrecisionWarn }>(facts: F, s: SigmaFacts | undefined, at?: SigmaAt): F {
  if (!s) return facts;
  const a = facts.reliableDigits;
  const b = limitDigits(s, at);
  const warn = facts.warn ?? s.warn;
  return { ...facts, reliableDigits: a === null ? b : b === null ? a : Math.min(a, b), ...(warn ? { warn } : {}) };
}
