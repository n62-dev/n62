// SPDX-License-Identifier: GPL-3.0-or-later
// G312: how many digits of a polar form r∡θ the confirmed digits of the value it was computed from confirm. Out of the
// start chunk: cycleForms.ts (fetched when idle) runs it once, where the engine computes r and θ, and the history item
// keeps the counts (Polar.confirmed), which displayMode.ts draws. Our own decimal arithmetic, never JS Number.
import { DECIMAL_KEEP, isZero, roundSignificant, ZERO_VALUE, type ComplexValue, type DecimalValue } from "./format.ts";

const pow10 = (k: number): bigint => 10n ** BigInt(k);

// scaled and fromScaled as format.ts has them for confirmedDigits (which runs in the Worker): kept here, so that the
// start chunk, which holds format.ts, does not carry them for this lazy module
/** v as m·10^e (m a signed BigInt). */
function scaled(v: DecimalValue): { m: bigint; e: number } {
  if (isZero(v)) return { m: 0n, e: 0 };
  const m = BigInt(v.digits);
  return { m: v.neg ? -m : m, e: v.exp + 1 - v.digits.length };
}

/** m·10^e as a DecimalValue, its first `keep` digits. */
function fromScaled(m: bigint, e: number, keep: number): DecimalValue {
  if (m === 0n) return ZERO_VALUE;
  const neg = m < 0n;
  const all = (neg ? -m : m).toString();
  const sig = all.replace(/0+$/, "");
  return { neg, digits: sig.slice(0, keep), exp: all.length - 1 + e, sticky: /[1-9]/.test(sig.slice(keep)) };
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
 * G312: the significant digits of r and θ (the polar form the engine computed from `value`) that `value`'s n confirmed
 * digits confirm. The kept part and the true one round alike to n digits, so each part is off by less than one unit in
 * its n-th digit, and z by less than d = u_re + u_im: r moves by at most d, θ by at most d / (r − d). r and θ are kept
 * to DECIMAL_KEEP digits (one unit there is added). A zero part counts as confirmed exactly, as the point form shows it.
 */
export function polarDigits(value: ComplexValue, n: number, r: DecimalValue, theta: DecimalValue): { r: number; theta: number } {
  const cap = Math.min(Math.max(n, 0), DECIMAL_KEEP);
  const parts = [value.re, value.im].filter((v) => !isZero(v));
  // r ≥ the larger part and r < 10 times it: anything else is no polar form of `value` (nothing confirmed)
  if (cap < 1 || parts.length === 0 || isZero(r) || r.exp > Math.max(...parts.map((v) => v.exp)) + 1) return { r: 0, theta: 0 };
  const ue = parts.map((v) => v.exp + 1 - cap);
  const top = Math.max(...ue);
  const d = ue.map((x) => Math.max(x, top - DECIMAL_KEEP)); // a part 40 decades below the other: bounded above
  const rDigits = digitsWithin(r, [...d.map((x): Term => [1n, x]), [1n, r.exp + 1 - DECIMAL_KEEP]], cap);
  if (top >= r.exp) return { r: rDigits, theta: 0 };
  // d / (r − d) rounded up, as q·10^-S: r − d > 0, every term of d being below r's first digit
  const R = scaled(r);
  const e0 = Math.min(R.e, ...d);
  const dm = d.reduce((s, x) => s + pow10(x - e0), 0n);
  const low = R.m * pow10(R.e - e0) - dm;
  const S = low.toString().length + DECIMAL_KEEP + 4;
  const q = (dm * pow10(S) + low - 1n) / low;
  return { r: rDigits, theta: digitsWithin(theta, [[q, -S], [1n, theta.exp + 1 - DECIMAL_KEEP]], cap) };
}
