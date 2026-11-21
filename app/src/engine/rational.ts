// SPDX-License-Identifier: GPL-3.0-or-later
// A rational as a DecimalValue (format.ts holds the type and the rest of the number formatting). Its own module, out of the start
// chunk: only the lazy code (the clipboard, the stored rows, the unit view, the engine's Worker) reads exact ratios (R832).
import { DECIMAL_KEEP, pow10, trimZeros, ZERO_VALUE, type DecimalValue } from "./format.ts";

/** p/q (q > 0) as a DecimalValue, exactly (BigInt long division). */
export function decimalFromRational(p: bigint, q: bigint, keep: number = DECIMAL_KEEP): DecimalValue {
  if (q <= 0n) throw new RangeError("denominator must be positive");
  if (p === 0n) return ZERO_VALUE;
  const neg = p < 0n;
  if (neg) p = -p;
  let e = p.toString().length - q.toString().length;
  // Make 10^e ≤ p/q < 10^(e+1).
  const below = (k: number) => (k >= 0 ? p < q * pow10(k) : p * pow10(-k) < q);
  if (below(e)) e -= 1;
  const shift = keep - 1 - e;
  const N = shift >= 0 ? p * pow10(shift) : p;
  const D = shift >= 0 ? q : q * pow10(-shift);
  const m = N / D;
  return { neg, digits: trimZeros(m.toString()), exp: e, sticky: N % D !== 0n };
}
