// SPDX-License-Identifier: GPL-3.0-or-later
// G60's rounding-noise rule for a part of a non-real value, and G324's use of it on the unaudited check (rule 3), which
// compares a double (14 digits) with MPFR at P. A rootof Giac evaluates in MPFR carries its rounding as an imaginary
// part: the real root of x^3-x-1 is 1.3247…+1.6E-40*i at 40 digits, 3.7E-60*i at 60 and real as a double, so the double
// and P alone disagree on every digit of a part that is not there. Only erasable TypeScript syntax.
import { isZero, type ComplexValue, type DecimalValue } from "./format.ts";

/** G60: a part this many decades below the other one at aPrecision digits is within the rounding of the value. */
const NOISE_MARGIN = 10;
/** G60: decades a noise part falls by when the precision rises by 20 digits (the rounding falls by 20). */
export const NOISE_DROP = 10;

export const ZERO: DecimalValue = { neg: false, digits: "", exp: 0, sticky: false };

/**
 * G60 (r16 F6): part `k` of a non-real value is rounding noise: at aPrecision digits it is NOISE_MARGIN decades or
 * fewer above the rounding of the other part, and in `b` (more digits) it fell by NOISE_DROP decades or more, or is 0.
 * sqrt(asinh(cos(10))) is 7.4E-41+0.873…*i at 40 digits and 1E-61+0.873…*i at 60; mpmath's real part is 0. A true
 * small part keeps its size when the precision rises (tanh(1E-40+i) = 3.4E-40+1.557…*i).
 */
export function noisePart(a: ComplexValue, b: ComplexValue, k: "re" | "im", aPrecision: number): boolean {
  const o = k === "re" ? "im" : "re";
  if (isZero(a[k]) || isZero(a[o]) || isZero(b[o])) return false;
  return a[k].exp <= a[o].exp - (aPrecision - NOISE_MARGIN) && (isZero(b[k]) || b[k].exp <= a[k].exp - NOISE_DROP);
}

const PARTS = ["re", "im"] as const;

/** G324: a part of `m` (at P digits) that is 0 in `d` (the double) is not: only such a part asks for a read at P + 20. */
export function zeroInDouble(d: ComplexValue, m: ComplexValue): boolean {
  return PARTS.some((k) => isZero(d[k]) && !isZero(m[k]));
}

/**
 * G324: `m` (at P digits) with each part that is 0 in the double `d`, not in `m`, and noise by G60's rule against `b`
 * (P + 20 digits; null when it could not be read) set to 0: it is shown as 0 and counts no digit (the double's 0 and
 * the 0 here are equal). Any other part is kept and compared as before.
 */
export function withoutDoubleNoise<T extends ComplexValue>(d: ComplexValue, m: T, b: ComplexValue | null, P: number): T {
  if (b === null) return m;
  const noise = PARTS.filter((k) => isZero(d[k]) && !isZero(m[k]) && noisePart(m, b, k, P));
  return noise.length ? { ...m, ...Object.fromEntries(noise.map((k) => [k, ZERO])) } : m;
}
