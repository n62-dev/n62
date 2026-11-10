// SPDX-License-Identifier: GPL-3.0-or-later
// R271f1: σ's mark, decided once. A σ that took a result chip's facts (Uncertainty.chip) limits the result: the
// evaluator folds σ's confirmed digits and ⚠ reason into the value's facts (evaluate.ts done), so the unit view, the
// Home row (units/row.ts), Copy and the chip (units/chip.ts) all read one stored fact under every setting and after a
// relaunch. A typed σ limits nothing (its row stays ≈). Pure; only erasable TypeScript.
import type { PrecisionWarn } from "../engine/format.ts";
import type { SigmaFacts, Uncertainty } from "./types.ts";

/** σ's facts when σ took a result chip's: its confirmed digits and its ⚠ reason; undefined for a typed σ. */
export function sigmaLimit(unc: Uncertainty | undefined): SigmaFacts | undefined {
  if (!unc?.chip) return undefined;
  const f = unc.value.facts;
  return { reliableDigits: f.reliableDigits, ...(f.warn ? { warn: f.warn } : {}) };
}

/** `facts` limited by `s`: the fewer confirmed digits of the two (null limits nothing), the value's ⚠ reason, else σ's. */
export function worseFacts<F extends { reliableDigits: number | null; warn?: PrecisionWarn }>(facts: F, s: SigmaFacts | undefined): F {
  if (!s) return facts;
  const a = facts.reliableDigits;
  const b = s.reliableDigits;
  const warn = facts.warn ?? s.warn;
  return { ...facts, reliableDigits: a === null ? b : b === null ? a : Math.min(a, b), ...(warn ? { warn } : {}) };
}

