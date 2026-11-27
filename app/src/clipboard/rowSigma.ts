// SPDX-License-Identifier: GPL-3.0-or-later
// G400: one σ reader for every export (☰ › Export › CSV and LaTeX, Share session, the work report): a unit row's σ (the
// unit view's), else the σ a constant's uncertainty leaves (R40's σ line, state/sigmaLine.ts), so a file never drops the
// σ the screen shows (principle 3).
import type { ValueFacts } from "../engine/types.ts";
import { commaResult, type FmtMode } from "../state/displayMode.ts";
import { sigmaText } from "../state/sigmaLine.ts";

/** What the σ reader reads of a row: a unit row's fields read back unchecked (units/row.ts UnitRow), the value's facts. */
export interface SigmaSource {
  units?: unknown;
  facts?: ValueFacts;
}

/** A row's σ as the exports write it, without a unit: a unit row's `units.unc.text` (the decimal comma applied), else
 *  sigmaText of the facts in the row's notation `mode`; the exponent as `E` (Copy's text), not the σ line's `ᴇ`, so a
 *  file has one notation. null: the row has no σ. */
export function rowSigma(item: SigmaSource, mode: FmtMode, comma: boolean): string | null {
  const u = (item.units as { unc?: { text?: unknown } } | undefined)?.unc?.text;
  const s = typeof u === "string" && u !== "" ? (comma ? commaResult(u, false) : u) : sigmaText(item.facts, mode, comma);
  return s === null ? null : s.replace(/ᴇ/g, "E");
}

/** rowSigma's text as LaTeX, drawn as the result is (render/home.ts): `E` as `\times10^{…}`, PFX's prefix upright after a
 *  thin space, the decimal comma as `{,}`. */
export function sigmaLatex(s: string): string {
  const t = s.replace(/(\d),(?=\d)/g, "$1{,}");
  const e = /^(.*?)E([-+]?\d+)$/.exec(t);
  if (e) return `${e[1]}\\times10^{${e[2]}}`;
  const p = /^(.*?)\s(\S+)$/.exec(t); // the σ line's space before a prefix (formatReal's, not always U+0020)
  return p ? `${p[1]}\\,\\mathrm{${p[2]}}` : t;
}
