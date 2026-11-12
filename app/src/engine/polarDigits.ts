// SPDX-License-Identifier: GPL-3.0-or-later
// G312: how many digits of a polar form r∡θ the confirmed digits of the value it was computed from confirm. Out of the
// start chunk: cycleForms.ts (fetched when idle) runs it once, where the engine computes r and θ, and the history item
// keeps the counts (Polar.confirmed), which displayMode.ts draws. Our own decimal arithmetic, never JS Number.
import { DECIMAL_KEEP, decimalFromRational, isZero, roundSignificant, type ComplexValue, type DecimalValue } from "./format.ts";

const pow10 = (k: number): bigint => 10n ** BigInt(k);

// scaled as format.ts has it for confirmedDigits (which runs in the Worker): kept here, so that the start chunk, which
// holds format.ts, does not carry it for this lazy module; fromScaled reads decimalFromRational, which the start has
/** v as m·10^e (m a signed BigInt). */
function scaled(v: DecimalValue): { m: bigint; e: number } {
  if (isZero(v)) return { m: 0n, e: 0 };
  const m = BigInt(v.digits);
  return { m: v.neg ? -m : m, e: v.exp + 1 - v.digits.length };
}

/** m·10^e as a DecimalValue, its first `keep` digits (exact: format.ts's long division, no text pattern, G88). */
function fromScaled(m: bigint, e: number, keep: number): DecimalValue {
  const v = decimalFromRational(m, 1n, keep); // m's own digits; the power of ten only moves the exponent (no 10^e, G58)
  return { ...v, exp: v.exp + e };
}

/** m·10^e: a bound on an error. */
type Term = [m: bigint, e: number];

/** The largest k ≤ cap at which every value within `half` (the sum of its terms) of c rounds to the same k significant
 *  digits, as confirmedDigits; 0 when none. Terms are rounded up to one unit in c's (cap + 2)-th digit, which keeps the
 *  BigInts small (G58); a term at or above c's first digit leaves nothing confirmed. */
function digitsWithin(c: DecimalValue, half: Term[], cap: number): number {
  if (isZero(c) || cap < 1) return 0;
  if (half.some(([m, x]) => x + m.toString().length - 1 >= c.exp)) return 0;
  const C = scaled(c);
  const e = Math.min(C.e, c.exp - cap - 2);
  // rounded up to a whole unit of 10^e; a term below one unit is one unit (no 10^(e − x) built for it)
  const up = ([m, x]: Term): bigint =>
    x >= e ? m * pow10(x - e) : m.toString().length < e - x ? 1n : (m + pow10(e - x) - 1n) / pow10(e - x);
  const hm = half.reduce((s, t) => s + up(t), 0n);
  const cm = C.m * pow10(C.e - e);
  const lo = fromScaled(cm - hm, e, cap + 2);
  const hi = fromScaled(cm + hm, e, cap + 2);
  if (isZero(lo) || isZero(hi) || lo.neg !== hi.neg) return 0;
  for (let k = cap; k >= 1; k--) {
    const x = roundSignificant(lo, k);
    const y = roundSignificant(hi, k);
    if (x.digits === y.digits && x.exp === y.exp) return k;
  }
  return 0;
}

/**
 * G312: the significant digits of r and θ (the polar form the engine computed from `value` = x + y·i) that `value`'s n
 * confirmed digits confirm. The kept part and the true one round alike to n digits, so each part is off by less than
 * u, one unit in its n-th digit (a zero part counts as exact, as the point form shows it). Then r moves by at most
 * u_x + u_y, and θ (mean value theorem on dθ = (x dy − y dx) / r², along the segment to the true value) by at most
 * ((|x| + u_x)·u_y + (|y| + u_y)·u_x) / (r − u_x − u_y)², which keeps θ's relative precision when θ is small. r and θ
 * are kept to DECIMAL_KEEP digits: one unit there is added. `angle`: the unit θ is in (computePolar divides arg by
 * pasdeg); in degrees the bound, worked out in radians, is multiplied by 573/10 ≥ 180/π.
 */
export function polarDigits(
  value: ComplexValue,
  n: number,
  r: DecimalValue,
  theta: DecimalValue,
  angle: "rad" | "deg",
): { r: number; theta: number } {
  const cap = Math.min(Math.max(n, 0), DECIMAL_KEEP);
  const parts = [value.re, value.im].filter((v) => !isZero(v));
  // r ≥ the larger part and r < 10 times it: anything else is no polar form of `value` (nothing confirmed)
  if (cap < 1 || parts.length === 0 || isZero(r) || r.exp > Math.max(...parts.map((v) => v.exp)) + 1) return { r: 0, theta: 0 };
  const u = (v: DecimalValue): number | null => (isZero(v) ? null : v.exp + 1 - cap);
  const [ux, uy] = [u(value.re), u(value.im)];
  const us = [ux, uy].filter((x): x is number => x !== null);
  const rDigits = digitsWithin(r, [...us.map((x): Term => [1n, x]), [1n, r.exp + 1 - DECIMAL_KEEP]], cap);
  if (Math.max(...us) >= r.exp) return { r: rDigits, theta: 0 };
  // L = r − u_x − u_y > 0 (each u is below r's first digit), a u rounded up to one unit in r's (cap + 45)-th digit (G58)
  const R = scaled(r);
  const lowU = us.map((x) => Math.max(x, r.exp - cap - 45));
  const e0 = Math.min(R.e, ...lowU);
  const Lm = R.m * pow10(R.e - e0) - lowU.reduce((s, x) => s + pow10(x - e0), 0n);
  // the numerator's terms: |x|·u_y, u_x·u_y, |y|·u_x, u_y·u_x
  const num: Term[] = [];
  const add = (v: DecimalValue, uv: number | null, uo: number | null): void => {
    if (uo === null) return;
    const V = scaled(v);
    if (!isZero(v)) num.push([V.m < 0n ? -V.m : V.m, V.e + uo]);
    if (uv !== null) num.push([1n, uv + uo]);
  };
  add(value.re, ux, uy);
  add(value.im, uy, ux);
  // each over L² = Lm²·10^(2·e0), rounded up, with S more digits
  const L2 = Lm * Lm;
  const S = L2.toString().length + DECIMAL_KEEP + 4;
  const half = num.map(([m, e]): Term => [(m * pow10(S) + L2 - 1n) / L2, e - 2 * e0 - S]);
  // DEG: θ is in degrees, so its error is 180/π times the bound in radians; 573/10 is above 180/π = 57.2957…
  const unit = (t: Term): Term => (angle === "deg" ? [t[0] * 573n, t[1] - 1] : t);
  return { r: rDigits, theta: digitsWithin(theta, [...half.map(unit), [1n, theta.exp + 1 - DECIMAL_KEEP]], cap) };
}
