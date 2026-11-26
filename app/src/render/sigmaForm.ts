// SPDX-License-Identifier: GPL-3.0-or-later
// R885: a value with σ is drawn by one rule (docs/04 2.6): σ at 2 significant digits; the value drawn at least to σ's
// last digit, never cut above it (the digits setting may draw more: R883 mutes the digits past σ, render/uncMute.ts),
// with no zeros padded past σ's place that the value does not have (SCI's 9.81000000000E0 ± 0.050 reads 9.810E0); value
// and σ in the same form: σ in the value's prefix or exponent (4.70 k ± 0.10 k, 9.810E-6 ± 0.050E-6; an exponent of 0
// is not written). FIX keeps its decimals while they reach σ's place. Home's unit row and Copy as shown
// (state/displayMode.ts renderPoint, through DisplayContext.sigma) and the unit view's second line (units/result.ts)
// draw through it. Pure text arithmetic on DecimalValue; in the tidy chunk (render/tidy.ts), off the start chunk.
import { formatReal, isZero, PREFIXES, roundSignificant, trimZeros, type DecimalValue, type FormatOptions, type FormattedNumber } from "../engine/format.ts";

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
 * confirmedOptions gave them). Null for a σ of 0: the caller draws as before.
 */
export function sigmaDrawn(v: DecimalValue, sv: DecimalValue, o: FormatOptions): SigmaDrawn | null {
  if (isZero(sv)) return null;
  const s2 = roundSignificant({ ...sv, neg: false }, 2);
  const k = s2.exp - 1; // σ's last digit's place
  // FIX: its decimals, or its SCI fallback's digits, when format.ts draws that
  const fixSci = o.format === "FIX" && formatReal(v, o).exponent !== null;
  const n = o.format === "FIX" ? (o.sciDigits ?? (o.fixed ?? 4) + 1) : o.digits;
  const last = isZero(v) ? Math.min(0, k) : o.format === "FIX" && !fixSci ? Math.min(-(o.fixed ?? 4), k) : Math.min(lastAt(v, n), k);
  const r = roundAt(v, last);
  const zero = /^0+$/.test(r.digits);
  const e = zero ? Math.max(0, last) : r.exp;
  const d = zero ? "0".repeat(e - last + 1) : r.digits;
  const f = zero ? { p: 0, ...(o.format === "PFX" ? { prefix: "" } : {}) } : powerOf(o, e, last, fixSci);
  // STD and FIX drawn plain have no exponent; the other forms write theirs, E0 too (sci, eng in format.ts)
  const plainValue = f.prefix === undefined && f.p === 0 && (o.format === "STD" || (o.format === "FIX" && !fixSci));
  const value = written(v.neg && !zero, d, e, last, f, plainValue);
  // σ in the value's prefix or exponent; an exponent of 0 is not written on σ (9.810E0 ± 0.050)
  const sigma = written(false, s2.digits, s2.exp, k, f, f.p === 0);
  return { value, sigma };
}

/** σ alone, as the second line of the unit view writes it: 2 significant digits in the format's own form for σ
 *  ("0.050", SCI "5.0E-2", ENG "50E-3", PFX "50 m"; sigmaDrawn with σ at 2 digits as the value). Null for a σ of 0. */
export function sigmaAlone(sv: DecimalValue, o: FormatOptions): FormattedNumber | null {
  if (isZero(sv)) return null;
  const s2 = roundSignificant({ ...sv, neg: false }, 2);
  return sigmaDrawn({ neg: false, digits: trimZeros(s2.digits), exp: s2.exp, sticky: false }, sv, o)?.sigma ?? null;
}
