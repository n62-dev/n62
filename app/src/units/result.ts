// SPDX-License-Identifier: GPL-3.0-or-later
// R62: what the unit view shows under the reading, as data (docs/04 4.3 "Result", docs/archive/r17-unit-result.md 0.3,
// the mockup `docs/mockups/unit-result.html` at `b1c44ee4`): a refusal, Working…, or a result with its value line (the
// mark as Home draws it, the value at the digits setting, the unit, the dimension), σ with its ⚠ and why-line, a note and
// the alternatives row.
// Plain TS; units/panel.ts draws it. Loaded with the unit view.
import { confirmedOptions, formatComplex, markOf, type FormatOptions, type FormattedNumber, type Mark } from "../engine/format.ts";
import { precisionFacts } from "../engine/precisionFacts.ts";
import { unitText } from "../i18n/enUnits.ts";
import { groupText } from "../render/groupText.ts";
import { groupSepFor, type GroupSep } from "../render/home.ts";
import { prefixPower, sigmaCut, tailAt } from "../render/uncMute.ts";
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
  /** With σ, muted under the value line: the value and σ at the digits setting. */
  sub?: string;
  /** R883: `sub` cut where the value's digits past σ go muted, R40's rule (render/uncMute.ts): before, muted, after;
   *  absent when no digit is. */
  subMuted?: readonly [string, string, string];
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
}

/** A result as the view shows it. `alts` is the row (alternatives.ts), none for a refusal or a pure number. */
export function shownOf(q: Quantity | UnitError, u: UnitFormat, alts: readonly Alternative[] = []): Shown {
  if (isUnitError(q)) return { kind: "message", text: unitErrorMessage(q) };
  const { decimalComma, grouped, groupSep, ...o } = u;
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
  const formatted = (v: Quantity["value"]) => (v.value ? formatComplex(v.value, confirmedOptions(v.value, v.facts.reliableDigits, o)) : undefined);
  const number = (v: Quantity["value"]): string => formatted(v)?.text ?? v.display;
  const value = number(q.value);
  const why = q.unc?.why;
  const dimension = q.dimension ?? "";
  const text = drawn(q.unc ? q.unc.shown : value);
  const dim = q.dimensionText !== null && q.dimensionText !== "1" && dimension !== "" ? q.dimensionText : undefined;
  return {
    kind: "result",
    text,
    display: comma(q.value.display),
    unit: q.unit,
    mark,
    markText: m ? markText({ ...m, mark }) : mark,
    ...(q.unc && q.unc.shown.endsWith(q.unc.text) ? { sigma: { head: drawn(q.unc.shown.slice(0, q.unc.shown.length - q.unc.text.length)), tail: drawn(q.unc.text) } } : {}),
    warn: why !== undefined || sigmaWarn,
    ...(why ? { why: unitWhyText(why) } : {}),
    ...(q.note ? { note: unitNoteText(q.note) } : {}),
    ...(q.names?.length ? { names: unitNamesText(q.names) } : {}),
    ...(dim ? { dim } : {}),
    ...(q.unc ? subLine(drawn(value), drawn(number(q.unc.value)), sigmaCut(q.unc.value.value?.re, q.value.value), formatted(q.value)?.re, decimalComma ? "," : ".") : {}),
    dimension,
    alts: dimension === "" ? [] : alts,
  };
}

/** R883: the line under the value line (`sub`), and with σ's cut (render/uncMute.ts sigmaCut) its value's mantissa
 *  split where its digits go muted (`subMuted`), as Home's row and a constant's (R40) draw them. `value` is drawn
 *  (groups, decimal comma); `re` its real part as formatted, for the mantissa's power of ten. */
function subLine(value: string, sigma: string, cut: number | undefined, re: FormattedNumber | undefined, mark: string): Pick<UnitShown, "sub" | "subMuted"> {
  const sub = unitText("units.result.sub", { value, sigma });
  const exp = re === undefined ? undefined : re.prefix !== undefined ? prefixPower(re.prefix) : (re.exponent ?? 0);
  const lead = /^-?\d(?:[\d.,’\s]*\d)?/.exec(value)?.[0];
  const at = cut === undefined || exp === undefined || lead === undefined ? -1 : tailAt(lead, exp, cut, mark);
  if (at < 0) return { sub };
  const [pre, post] = unitText("units.result.sub", { value: "\0", sigma }).split("\0") as [string, string];
  return { sub, subMuted: [pre + value.slice(0, at), value.slice(at, lead!.length), value.slice(lead!.length) + post] };
}
