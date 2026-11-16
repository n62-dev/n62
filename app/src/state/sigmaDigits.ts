// SPDX-License-Identifier: GPL-3.0-or-later
// R327f1: the significant digits the value part of a row's "value ± σ" shows, read from the text alone. Kept out of
// units/uncertainty.ts (BigInt arithmetic, loaded with the unit view) because the Home row's mark needs it in the start
// chunk (state/displayMode.ts markFor). Only erasable TypeScript syntax.

/** The power of ten of a decimal text's leading nonzero digit ("10.123" → 1, "0.071" → -2, "1.2E-9" → -9); null for a
 *  text that is no decimal or is 0. */
function leadingPlace(text: string): number | null {
  const t = /^\s*[+-]?(\d*)\.?(\d*)(?:[eE]([+-]?\d+))?\s*$/.exec(text);
  if (!t || (t[1] === "" && t[2] === "")) return null;
  const i = (t[1]! + t[2]!).search(/[1-9]/);
  return i < 0 ? null : t[1]!.length - 1 - i + Number(t[3] ?? 0);
}

/** The digits the value part of a unit row's "value ± σ" (Uncertainty.shown, written by units/uncertainty.ts
 *  shownWithUncertainty) shows: the value is rounded to σ's last place and σ has 2 significant digits, so they run from
 *  the value's leading digit to the place below σ's ("10.123 ± 0.071": 5, "12300 ± 1200": 3, its zeros hold places;
 *  units/uncertainty.ts digitsToSigma gives the same from the unrounded value). Null for a σ of 0, a value of 0, a text
 *  that is no decimal, and a text that is not the value, " ± " and σ. */
export function shownDigits(unc: { shown?: unknown; text?: unknown } | undefined): number | null {
  const sh = unc?.shown, tx = unc?.text;
  if (typeof sh !== "string" || typeof tx !== "string" || !sh.endsWith(` ± ${tx}`)) return null;
  const v = leadingPlace(sh.slice(0, sh.length - tx.length - 3));
  const s = leadingPlace(tx);
  return v === null || s === null || v < s - 1 ? null : v - s + 2;
}
