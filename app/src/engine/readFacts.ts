// SPDX-License-Identifier: GPL-3.0-or-later
// Stored facts read back (history, chips, definitions): types.ts holds ValueFacts. Its own module, out of the start chunk: only the
// stored-row code reads them back, while the history is loaded (R832).
import type { PrecisionWhy } from "./format.ts";
import type { ValueFacts } from "./types.ts";

/** A stored PrecisionWhy: an object with only its keys, each of its type. */
function isWhy(x: unknown): x is PrecisionWhy {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  const names = (v: unknown): boolean => Array.isArray(v) && v.every((n) => typeof n === "string");
  const flag = (v: unknown): boolean => typeof v === "boolean";
  const check: Record<keyof PrecisionWhy, (v: unknown) => boolean> = { unaudited: names, inherited: names, once: flag, pastCap: flag, decided: flag, differ: flag, squareUnchecked: flag, existsUnchecked: flag, rounded: names, sigmaLost: names };
  return Object.entries(x).every(([k, v]) => Object.hasOwn(check, k) && check[k as keyof PrecisionWhy](v));
}

/**
 * Stored facts (history, chips, definitions) read back as ValueFacts: the one mapping for an item stored before G76,
 * whose keys stay as they were written. `exactRational` is the old name of `exact`; a missing `exact` claims nothing
 * (false), a missing `reliableDigits` is null (not limited). Null when a field that is there has the wrong type.
 */
export function readValueFacts(x: unknown): ValueFacts | null {
  if (!x || typeof x !== "object") return null;
  const f = x as Record<string, unknown>;
  const exact = f["exact"] ?? f["exactRational"] ?? false;
  const d = f["reliableDigits"] ?? null;
  if (typeof exact !== "boolean" || !(d === null || (typeof d === "number" && Number.isFinite(d)))) return null;
  const { warn, why, inexact, uncDigits, uncSigma } = f;
  if (warn !== undefined && warn !== "unaudited" && warn !== "unchecked") return null;
  if (inexact !== undefined && inexact !== true) return null;
  if (uncDigits !== undefined && !(typeof uncDigits === "number" && Number.isInteger(uncDigits) && uncDigits >= 0)) return null;
  if (why !== undefined && !isWhy(why)) return null;
  return {
    exact,
    reliableDigits: d,
    ...(warn ? { warn } : {}),
    ...(why ? { why: why as PrecisionWhy } : {}),
    ...(inexact ? { inexact } : {}),
    ...(uncDigits !== undefined ? { uncDigits } : {}),
    // R40: σ's text, read with decimalFromString where it is drawn (a text that is not a decimal draws no σ line and no
    // muted digit); one that is not a string is dropped, never trusted, and claims nothing the other facts do not
    ...(typeof uncSigma === "string" ? { uncSigma } : {}),
  };
}
