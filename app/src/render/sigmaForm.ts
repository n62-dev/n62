// SPDX-License-Identifier: GPL-3.0-or-later
// R885: a value with σ is drawn by one rule (docs/04 2.6): σ at 2 significant digits; the value drawn at least to σ's
// last digit, never cut above it (the digits setting may draw more: R883 mutes the digits past σ, render/uncMute.ts),
// never below the value's confirmed digits (ValueFacts.reliableDigits: a finer σ leaves the value at those, σ alone),
// with no zeros padded past σ's place that the value does not have (SCI's 9.81000000000E0 ± 0.050 reads 9.810E0); value
// and σ in the same form: σ in the value's prefix or exponent (4.70 k ± 0.10 k, 9.810E-6 ± 0.050E-6; an exponent of 0
// is not written). FIX keeps its decimals while they reach σ's place. Home's unit row and Copy as shown (renderPoint
// through DisplayContext.sigma = sigmaRow, Session.display through withSigma) and the unit view (units/result.ts: its
// headline through sigmaDrawn, its second line through sigmaAlone) draw through it. Pure text arithmetic on
// DecimalValue; in the tidy chunk (render/tidy.ts), off the start chunk.
import { decimalFromString, formatReal, isZero, PREFIXES, roundSignificant, toText, trimZeros, type ComplexValue, type DecimalValue, type FormatOptions, type FormattedComplex, type FormattedNumber } from "../engine/format.ts";
import { withUnit } from "../state/results.ts";
import { complexToLatex } from "./home.ts";

/** The value and σ of one "value ± σ", each in the same form (σ never negative). */
export interface SigmaDrawn {
  value: FormattedNumber;
  sigma: FormattedNumber;
}

/** Digits from place `e` down to place `last` (both powers of ten) as a plain mantissa: "9.810", "0.050", "1200". */
function plain(d: string, e: number, last: number): string {
  if (last >= 0) return d + "0".repeat(last);
  if (e < 0) return `0.${"0".repeat(-e - 1)}${d}`;
  return `${d.slice(0, e + 1)}.${d.slice(e + 1)}`;
}

/** `v` rounded half away from zero to a multiple of 10^`last`: its digits from its first place `e` down to `last`
 *  (zeros kept); a value below half that place is zero ("0" at place `last`). */
function roundAt(v: DecimalValue, last: number): { digits: string; exp: number } {
  const n = v.exp - last + 1;
  if (isZero(v) || n < 0 || (n === 0 && v.digits.charAt(0) < "5")) return { digits: "0", exp: last };
  if (n === 0) return { digits: "1", exp: last };
  const r = roundSignificant(v, n);
  return { digits: r.digits.padEnd(r.exp - last + 1, "0"), exp: r.exp };
}

/** The place of the last nonzero digit `v` keeps at `n` significant digits (its rounding at the setting). */
function lastAt(v: DecimalValue, n: number): number {
  const r = roundSignificant(v, n);
  return r.exp - trimZeros(r.digits).length + 1;
}

/** The place of the last of `n` significant digits of `v` (after its rounding there: 9.99996 at 5 → 10.000, 10⁻³). */
function placeAt(v: DecimalValue, n: number): number {
  return roundSignificant(v, n).exp - n + 1;
}

/** The power of ten the form puts on a value whose rounded first digit is at `e` and that is drawn down to `last`: 0 for
 *  plain, else the exponent; `prefix` for PFX inside f … P. */
function powerOf(o: FormatOptions, e: number, last: number, sci: boolean): { p: number; prefix?: string } {
  if (sci) return { p: e };
  switch (o.format) {
    case "SCI":
      return { p: e };
    case "ENG":
    case "PFX": {
      const p = Math.floor(e / 3) * 3;
      const prefix = o.format === "PFX" ? PREFIXES[p] : undefined;
      return prefix === undefined ? { p } : { p, prefix };
    }
    case "FIX":
      return { p: 0 };
    case "STD":
      // STD's own switch (format.ts std): plain from 10⁻⁴ while the integer part fits in the digits drawn
      return e >= -4 && e < Math.max(o.digits, e - last + 1) ? { p: 0 } : { p: e };
  }
}

/** A number of digits `d` from place `e` to `last`, written with the power `p` (exponent, or prefix, or neither). */
function written(neg: boolean, d: string, e: number, last: number, f: { p: number; prefix?: string }, plainForm: boolean): FormattedNumber {
  const mantissa = plain(d, e - f.p, last - f.p);
  if (f.prefix !== undefined) return { neg, mantissa, exponent: null, prefix: f.prefix };
  return { neg, mantissa, exponent: plainForm ? null : f.p };
}

/**
 * The value `v` and σ `sv` drawn by the rule above with the format `o` (the row's notation and digits, as
 * confirmedOptions gave them), `reliable` the value's confirmed significant digits (ValueFacts.reliableDigits; null or
 * absent: every digit `v` has). Never drawn below the value's confirmed last place: a σ finer than it leaves the value at
 * its confirmed digits (no zeros padded in for digits not known) and σ at 2 digits in its own form (sigmaAlone). Null
 * for a σ of 0: the caller draws as before. `atSigma`: the value cut at σ's last digit whatever the digits setting (the unit
 * view's headline, value line of `39.5 ± 1.2`: the row may draw more, R883 mutes them; the form still the setting's).
 */
export function sigmaDrawn(v: DecimalValue, sv: DecimalValue, o: FormatOptions, reliable?: number | null, atSigma = false): SigmaDrawn | null {
  if (isZero(sv)) return null;
  const s2 = roundSignificant({ ...sv, neg: false }, 2);
  const k = s2.exp - 1; // σ's last digit's place
  // FIX: its decimals, or its SCI fallback's digits, when format.ts draws that
  const fixSci = o.format === "FIX" && formatReal(v, o).exponent !== null;
  const n = o.format === "FIX" ? (o.sciDigits ?? (o.fixed ?? 4) + 1) : o.digits;
  const wanted = atSigma ? k : o.format === "FIX" && !fixSci ? Math.min(-(o.fixed ?? 4), k) : Math.min(lastAt(v, n), k);
  // the value's confirmed last place bounds it (at least one digit, as confirmedOptions draws); its zeros count:
  // 10.1 confirmed to 6 digits is known to 10⁻⁴ and draws 10.100 ± 0.071
  const floor = reliable === null || reliable === undefined ? -Infinity : placeAt(v, Math.max(1, reliable));
  const last = isZero(v) ? Math.min(0, k) : Math.max(wanted, floor);
  const r = roundAt(v, last);
  const zero = /^0+$/.test(r.digits);
  // a value that rounds to zero is written from the units place: its decimals down to σ's place (0.00 ± 0.10), and
  // the single digit 0 when σ's place is above the units (0 ± 120, not 00 ± 120: no zeros padded for a zero)
  const vl = zero ? Math.min(0, last) : last;
  const e = zero ? 0 : r.exp;
  const d = zero ? "0".repeat(1 - vl) : r.digits;
  const f = zero ? { p: 0, ...(o.format === "PFX" ? { prefix: "" } : {}) } : powerOf(o, e, last, fixSci);
  // STD and FIX drawn plain have no exponent; the other forms write theirs, E0 too (sci, eng in format.ts)
  const plainValue = f.prefix === undefined && f.p === 0 && (o.format === "STD" || (o.format === "FIX" && !fixSci));
  const value = written(v.neg && !zero, d, e, vl, f, plainValue);
  // σ in the value's prefix or exponent; an exponent of 0 is not written on σ (9.810E0 ± 0.050). A σ finer than the
  // value's confirmed digits: in its own form (3.14159265359E20 ± 3.0, not 0.000000000000000000030E20)
  const sigma = last > k ? sigmaAlone(sv, o) : written(false, s2.digits, s2.exp, k, f, f.p === 0);
  return sigma && { value, sigma };
}

/** σ alone: 2 significant digits in the format's own form for σ ("0.050", SCI "5.0E-2", ENG "50E-3", PFX "50 m";
 *  sigmaDrawn with σ at 2 digits as the value); drawn plain with its last digit above the units place, in E form (9.0E9,
 *  1.2E3: 9000000000 would read as ten digits). Null for a σ of 0. */
export function sigmaAlone(sv: DecimalValue, o: FormatOptions): FormattedNumber | null {
  if (isZero(sv)) return null;
  const s2 = roundSignificant({ ...sv, neg: false }, 2);
  const s = sigmaDrawn({ neg: false, digits: trimZeros(s2.digits), exp: s2.exp, sticky: false }, sv, o)?.sigma ?? null;
  return s && s.exponent === null && s.prefix === undefined && s2.exp - 1 > 0 ? written(false, s2.digits, s2.exp, s2.exp - 1, { p: s2.exp }, false) : s;
}

/** A Home row with σ as renderPoint passes it (state/displayMode.ts NumericResult): a unit row's σ is in `units.unc`, its
 *  full σ in `facts.uncSigma` (R883). */
type SigmaRowIn = { value?: ComplexValue; facts?: { uncDigits?: number; uncSigma?: string; reliableDigits?: number | null }; units?: { unc?: unknown } };

/** R885: a unit row's real value drawn with `o` (renderPoint's options, after confirmedOptions) and σ in its form, σ's
 *  LaTeX with the groups `group` (GROUP_LATEX; undefined: none); undefined for a row without σ, a σ of 0 and a complex
 *  value (drawn by the digits setting). `round` (R884, Settings › Numbers › Uncertainty "Rounded to σ"): the value cut
 *  at σ's last digit as the unit view's headline cuts it, a constant's row too (its σ in `facts`, R40). DisplayContext.sigma,
 *  in the tidy chunk. */
export function sigmaRow(r: SigmaRowIn, o: FormatOptions, group: string | undefined, round = false): { c: FormattedComplex; sigma: { text: string; latex: string } } | undefined {
  const has = r.units?.unc || (round && r.facts?.uncDigits !== undefined);
  const sv = has && r.facts?.uncSigma !== undefined && r.value && isZero(r.value.im) ? decimalFromString(r.facts.uncSigma) : null;
  const d = sv && r.value ? sigmaDrawn(r.value.re, sv, o, r.facts?.reliableDigits, round) : null;
  if (!d) return undefined;
  const sigma: FormattedComplex = { re: d.sigma, im: null, text: toText(d.sigma) };
  return { c: { re: d.value, im: null, text: toText(d.value) }, sigma: { text: sigma.text, latex: complexToLatex(sigma, group) } };
}

/** state/results.ts withUnit with `r.sigma` (sigmaRow's σ, drawn in the value's form) in place of the row's stored ` ± σ`
 *  (UnitRow.unc.text, read back unchecked; its ⚠ kept, R886), the decimal comma's rewrite `comma` applied to it as to the rest; withUnit
 *  itself for a row drawn without it, or one whose stored text does not start with that σ. Session.display's writer once
 *  the tidy chunk is in: the row's drawing, its data-text and Copy as shown. */
export function withSigma(
  r: { text: string; latex: string; sigma?: { text: string; latex: string } },
  u: { text?: unknown; latex?: unknown; unc?: unknown },
  comma?: (s: string, latex: boolean) => string,
): { text: string; latex: string } {
  const st = (u.unc as { text?: unknown } | undefined)?.text;
  // R886: a σ with ⚠ (units/row.ts unitRow) keeps it before the σ drawn here
  const w = typeof u.text === "string" && u.text.startsWith(" ± ⚠") ? "⚠" : "";
  const tx = ` ± ${w}${String(st)}`, lx = `\\pm${w}${String(st)}`;
  if (!r.sigma || typeof st !== "string" || typeof u.text !== "string" || typeof u.latex !== "string" || !u.text.startsWith(tx) || !u.latex.startsWith(lx)) return withUnit(r, u, comma);
  return withUnit(r, { text: ` ± ${w}${r.sigma.text}${u.text.slice(tx.length)}`, latex: `\\pm${w}${r.sigma.latex}${u.latex.slice(lx.length)}` }, comma);
}
