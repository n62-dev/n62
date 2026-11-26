// SPDX-License-Identifier: GPL-3.0-or-later
// R62: what the unit view shows under the reading, as data (docs/04 4.3 "Result", docs/archive/r17-unit-result.md 0.3,
// the mockup `docs/mockups/unit-result.html` at `b1c44ee4`): a refusal, Working…, or a result with its value line (the
// mark as Home draws it, the value at the digits setting, the unit, the dimension), σ with its ⚠ and why-line, a note and
// the alternatives row.
// Plain TS; units/panel.ts draws it. Loaded with the unit view.
import { confirmedOptions, formatComplex, isZero, markOf, toText, type FormatOptions, type Mark } from "../engine/format.ts";
import { precisionFacts } from "../engine/precisionFacts.ts";
import { unitText } from "../i18n/enUnits.ts";
import { groupText } from "../render/groupText.ts";
import { groupSepFor, type GroupSep } from "../render/home.ts";
import { sigmaAlone, sigmaDrawn } from "../render/sigmaForm.ts";
import { powerOf, sigmaCut, tailAt } from "../render/uncMute.ts";
import { commaResult, markText, withSigmaText } from "../state/displayMode.ts";
import type { Alternative } from "./alternatives.ts";
import { unitErrorMessage, unitNamesText, unitNoteText, unitWhyText } from "./messages.ts";
import { isUnitError, type Quantity, type UnitError } from "./types.ts";
import { shownDigits } from "../state/sigmaDigits.ts";

/** What the view shows under the reading: nothing, a refusal (a slot's or the evaluator's), Working…, or a result. */
export type Shown =
  | { kind: "none" }
  | { kind: "message"; text: string }
  | { kind: "working" }
  | UnitShown;

export interface UnitShown {
  kind: "result";
  /** The value line's number: with σ `39.5 ± 1.2` (Uncertainty.shown), else the value at the digits setting. */
  text: string;
  /** The value alone as the evaluator displays it, with the decimal comma when it is on and no groups (the result's
   *  data-text, Copy's rule, R120; the e2e reads it). */
  display: string;
  unit: string;
  /** The mark as Home draws it (`⚠ 3` for fewer confirmed digits); a value with σ is never "=". */
  mark: Mark;
  markText: string;
  /** The value line's σ as `{ head: "1.0000 ± ", sigma: "0.0071" }`, so the ⚠ can sit just before σ. */
  sigma?: { head: string; tail: string };
  /** σ has ⚠ (Uncertainty.why). */
  warn: boolean;
  why?: string;
  note?: string;
  /** R121: the note on the names the formula read as pure numbers (Quantity.names). */
  names?: string;
  /** "L·T⁻¹"; absent for a pure number. */
  dim?: string;
  /** With σ, muted under the value line: the value at the digits setting and σ at 2 significant digits (R885). */
  sub?: string;
  /** R883: where in `sub` its value stands and its digits past σ go muted (R40's rule, render/uncMute.ts):
   *  [value from, muted from, muted to, value to]; the muted part is empty when no digit is. */
  subCut?: readonly [number, number, number, number];
  /** The dimension key; "" for a pure number (no row). */
  dimension: string;
  /** The row's chips, fixed for as long as this result is on screen (not reordered); "More…" follows them. */
  alts: readonly Alternative[];
}

/** How the host wants numbers drawn: Home's format and digits, R57's decimal comma, and R55's digit groups (the screen
 *  asks for them; `display`, the result's data-text and Copy's text, never has them). */
export interface UnitFormat extends FormatOptions {
  decimalComma?: boolean;
  grouped?: boolean;
  /** R125: the groups' separator (absent: the thin space; a comma under the decimal comma draws as the thin space). */
  groupSep?: GroupSep;
  /** R884: Settings › Numbers › Uncertainty "Rounded to σ": the line under the value line draws the value to σ's last
   *  digit as the headline does, no digit muted. */
  round?: boolean;
}

/** A result as the view shows it. `alts` is the row (alternatives.ts), none for a refusal or a pure number. */
export function shownOf(q: Quantity | UnitError, u: UnitFormat, alts: readonly Alternative[] = []): Shown {
  if (isUnitError(q)) return { kind: "message", text: unitErrorMessage(q) };
  const { decimalComma, grouped, groupSep, round, ...o } = u;
  const sep = groupSepFor(groupSep, decimalComma);
  /** R120: a number as the screen draws it (Home's unit row: commaResult, groupDigits) and as Copy writes it. */
  const comma = (s: string): string => (decimalComma ? commaResult(s, false) : s);
  const drawn = (s: string): string => comma(grouped ? groupText(s, sep) : s);
  const facts = precisionFacts(q.value);
  // R271f1: the value's facts already hold σ's limit (evaluate.ts done, sigmaFacts.ts), as the Home row and the chip do
  // R327f1: the line draws unc.shown, the value rounded to σ's last place whatever the setting: its digits count too
  const m = withSigmaText(markOf(facts, o), facts.reliableDigits, shownDigits(q.unc));
  // the ⚠ sits before σ when σ's facts are the limit the value carries (its ⚠ reason, or the digits σ's limit gives it at
  // σ's decade, R286: evaluate.ts done works them out)
  const limit = q.unc?.chip;
  const sigmaWarn = m?.mark === "⚠" && !!limit && (!!limit.warn || (q.unc?.limit ?? -1) === facts.reliableDigits);
  const mark: Mark = m?.mark === "⚠" ? "⚠" : q.unc ? "≈" : (m?.mark ?? "≈");
  const hv = q.value.value;
  // the value at the digits setting, formatted once (R884's cut: no second formatComplex for its real part)
  const fv = hv && formatComplex(hv, confirmedOptions(hv, q.value.facts.reliableDigits, o));
  const re = fv?.re;
  const value = fv?.text ?? q.value.display;
  const why = q.unc?.why;
  const dimension = q.dimension ?? "";
  // R885: the headline draws value ± σ by the row's rule (render/sigmaForm.ts sigmaDrawn, as Home's row: sigmaRow) in
  // the view's format, the value cut at σ's last digit (the row's digits past it are muted, and the line under this one
  // has them); Uncertainty.shown where that rule draws nothing (a σ of 0, a complex value)
  const hs = q.unc?.value.value, qu = q.unc;
  const hd = hv && hs && isZero(hv.im) && isZero(hs.im) && sigmaDrawn(hv.re, hs.re, confirmedOptions(hv, facts.reliableDigits, o), facts.reliableDigits, true);
  // [head, tail]; Uncertainty.text is never empty ("0" for a σ of 0)
  const ht = hd ? [`${toText(hd.value)} ± `, toText(hd.sigma)] : qu?.shown.endsWith(qu.text) ? [qu.shown.slice(0, -qu.text.length), qu.text] : null;
  const text = drawn(ht ? ht.join("") : (qu?.shown ?? value));
  const dim = q.dimensionText !== null && q.dimensionText !== "1" && dimension !== "" ? q.dimensionText : undefined;
  return {
    kind: "result",
    text,
    display: comma(q.value.display),
    unit: q.unit,
    mark,
    markText: m ? markText({ ...m, mark }) : mark,
    ...(ht ? { sigma: { head: drawn(ht[0]!), tail: drawn(ht[1]!) } } : {}),
    warn: why !== undefined || sigmaWarn,
    ...(why ? { why: unitWhyText(why) } : {}),
    ...(q.note ? { note: unitNoteText(q.note) } : {}),
    ...(q.names?.length ? { names: unitNamesText(q.names) } : {}),
    ...(dim ? { dim } : {}),
    // R884: Rounded to σ draws the headline's value here, nothing muted
    ...(q.unc ? subLine(drawn(round && hd ? toText(hd.value) : value), drawn(sigmaText(q.unc.value, o)), sigmaCut(q.unc.value.value?.re, hv), !round && re && [(re.neg ? "-" : "") + drawn(re.mantissa), powerOf(re)], decimalComma ? "," : ".") : {}),
    dimension,
    alts: dimension === "" ? [] : alts,
  };
}

/** R885: σ on the line under the value line, at 2 significant digits in the format's form for σ (render/sigmaForm.ts
 *  sigmaAlone: SCI 5.0E-2, not the digits setting's 5.00000000000E-2; in E form above the units place, so G·M's line
 *  reads 3.98589196E14 · σ 9.0E9, not σ 9000000000); a σ of 0 or no decimal as the digits setting draws it. */
function sigmaText(s: Quantity["value"], o: FormatOptions): string {
  const f = s.value && isZero(s.value.im) ? sigmaAlone(s.value.re, o) : null;
  return f ? toText(f) : s.value ? formatComplex(s.value, confirmedOptions(s.value, s.facts.reliableDigits, o)).text : s.display;
}

/** R883: the line under the value line (`sub`), and with σ's cut (render/uncMute.ts sigmaCut) where its value's digits
 *  go muted (`subCut`), as Home's row and a constant's (R40) draw them. `value` is drawn (groups, decimal comma);
 *  `m` its real part's mantissa drawn the same way, with its sign, and the mantissa's power of ten (false: none muted, R884). */
function subLine(value: string, sigma: string, cut: number | undefined, m: [string, number | undefined] | false | undefined, mark: string): Pick<UnitShown, "sub" | "subCut"> {
  const sub = unitText("units.result.sub", { value, sigma });
  const [lead, exp] = m || [""];
  const at = cut === undefined || exp === undefined || !value.startsWith(lead) ? -1 : tailAt(lead, exp, cut, mark);
  const k = sub.indexOf(value);
  const e = k + value.length;
  return { sub, subCut: at < 0 ? [k, e, e, e] : [k, k + at, k + lead.length, e] };
}
