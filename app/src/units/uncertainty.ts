// SPDX-License-Identifier: GPL-3.0-or-later
// How a value with its uncertainty is written (G18, docs/04 2.6): σ to 2 significant digits, the value rounded to σ's
// last digit ("39.5 ± 1.2"). Pure text arithmetic on Giac's decimal text, no engine. Only erasable TypeScript syntax.

/** A decimal as m · 10^k. */
interface Dec {
  neg: boolean;
  m: bigint;
  k: number;
}

/** Giac's decimal text ("39.488", "-1.5e-05", "2E3") as an exact m · 10^k, or null when it is not a plain decimal. */
export function parseDecimal(text: string): Dec | null {
  const t = /^\s*([+-]?)(\d*)\.?(\d*)(?:[eE]([+-]?\d+))?\s*$/.exec(text);
  if (!t || (t[2] === "" && t[3] === "")) return null;
  const frac = t[3]!;
  return { neg: t[1] === "-", m: BigInt((t[2]! + frac) || "0"), k: Number(t[4] ?? 0) - frac.length };
}

const pow10 = (n: number): bigint => 10n ** BigInt(n);

/** m · 10^k rounded half away from zero to a multiple of 10^place, as the integer count of those multiples. */
function roundTo(d: Dec, place: number): bigint {
  if (d.k >= place) return d.m * pow10(d.k - place);
  const q = pow10(place - d.k);
  const r = d.m / q;
  return 2n * (d.m % q) >= q ? r + 1n : r;
}

/** Digits `m` at the place `k`, written as text: plain for a nearby magnitude, else mantissa E exponent, with every
 *  digit kept (so "0.10" and "1.20E-9" keep their zero). A 0 at a place of 1 or above is "0" (G143: not "000").
 *  G270: `bracket` ("(12)") goes after the mantissa, before the exponent; `forceExp` writes the exponent form
 *  whatever the magnitude (the exponent is then the last place's for a 0: "0(12)E1"). */
function write(neg: boolean, m: bigint, k: number, bracket = "", forceExp = false): string {
  if (m === 0n && k >= 0 && !forceExp) return "0" + bracket;
  const digits = m.toString();
  const e10 = digits.length - 1 + k;
  const sign = neg && m !== 0n ? "-" : "";
  if (!forceExp && (m === 0n || (e10 >= -4 && e10 < 12))) {
    if (k >= 0) return sign + digits + "0".repeat(k) + bracket;
    const pad = digits.padStart(-k + 1, "0");
    return `${sign}${pad.slice(0, pad.length + k)}.${pad.slice(pad.length + k)}${bracket}`;
  }
  return `${sign}${digits[0]}${digits.length > 1 ? `.${digits.slice(1)}` : ""}${bracket}E${e10}`;
}

/** σ at 2 significant digits as [m, k] with m in 10..99, or null for 0. */
function twoDigits(s: Dec): { m: bigint; k: number } | null {
  if (s.m === 0n) return null;
  const n = s.m.toString().length;
  let place = s.k + n - 2;
  let m = roundTo(s, place);
  if (m >= 100n) {
    m /= 10n;
    place += 1;
  }
  return { m, k: place };
}

/** σ at 2 significant digits ("1.2", "0.10"; "0" for 0); null when the text is not a number. */
export function uncertaintyText(sigma: string): string | null {
  const s = parseDecimal(sigma);
  if (!s) return null;
  const t = twoDigits(s);
  return t ? write(false, t.m, t.k) : "0";
}

/** "value ± σ": σ at 2 significant digits and the value rounded to the same last digit. Null when either is not a
 *  decimal. A σ of 0 leaves the value as it is. */
export function shownWithUncertainty(value: string, sigma: string, plainValue: string): string | null {
  const v = parseDecimal(value);
  const s = parseDecimal(sigma);
  if (!v || !s) return null;
  const t = twoDigits(s);
  if (!t) return `${plainValue} ± 0`;
  return `${write(v.neg, roundTo(v, t.k), t.k)} ± ${write(false, t.m, t.k)}`;
}

/** G270 (GUM 7.2.2 way 2): "39.5(12)", the value rounded to σ's last place with σ's two digits in brackets (the
 *  standard uncertainty σ, never U); "6.67430(15)E-11" with the exponent after the bracket. Where σ's last place is
 *  above the units digit the exponent form is forced ("1.235(12)E4"). Null for σ 0, text that is no decimal, and a
 *  value that needs more than `maxDigits` digits to reach σ's last place (they are not known that far; a 0 never). */
export function shortForm(value: string, sigma: string, maxDigits: number): string | null {
  const v = parseDecimal(value);
  const s = parseDecimal(sigma);
  const t = v && s ? twoDigits(s) : null;
  if (!v || !t) return null;
  const e10v = v.m === 0n ? 0 : v.m.toString().length - 1 + v.k;
  // far above σ's place: the digits are too many (the carry adds an exact leading 1, no digit to know); far below: the value rounds to 0
  if (v.m !== 0n && e10v - t.k + 1 > maxDigits) return null;
  const m = v.m === 0n || e10v <= t.k - 2 ? 0n : roundTo(v, t.k);
  const forceExp = t.k > 0 || (m === 0n && t.k + 1 < -4);
  return write(v.neg, m, t.k, `(${t.m})`, forceExp);
}

/** G270: σ/|y| · 100 at 2 significant digits as text ("3.2"); null for a value of 0, a σ of 0 or no decimal. BigInt only. */
export function relativeSigma(value: string, sigma: string): string | null {
  const v = parseDecimal(value);
  const s = parseDecimal(sigma);
  if (!v || !s || v.m === 0n || s.m === 0n) return null;
  // σ/|y| · 100 = s.m / v.m · 10^x; find the place p of the 2nd digit and m = round(s.m · 10^(x-p) / v.m)
  const x = s.k - v.k + 2;
  let p = s.m.toString().length - v.m.toString().length + x - 1;
  for (let i = 0; i < 4; i++) {
    const num = x - p >= 0 ? s.m * pow10(x - p) : s.m;
    const den = x - p >= 0 ? v.m : v.m * pow10(p - x);
    const m = (2n * num + den) / (2n * den);
    if (m >= 100n) p += 1;
    else if (m < 10n) p -= 1;
    else return write(false, m, p);
  }
  return null;
}

/** G270: U = 2σ as text, 2 × the unrounded σ at 2 significant digits ("2.5" for σ = 1.2443…, not 2 × 1.2); null when
 *  the text is no decimal. */
export function expandedText(sigma: string): string | null {
  const s = parseDecimal(sigma);
  if (!s) return null;
  const t = twoDigits({ ...s, m: 2n * s.m });
  return t ? write(false, t.m, t.k) : "0";
}

/** R327f1: the significant digits the value part of "value ± σ" and of the short form shows: both round the value to
 *  σ's last place (σ at 2 significant digits), so "10.123 ± 0.071" and "10.123(71)" show 5 ("12300 ± 1200": 3, its
 *  zeros hold places). Null for a σ of 0, a value that rounds to 0 and text that is no decimal. */
export function digitsToSigma(value: string, sigma: string): number | null {
  const v = parseDecimal(value);
  const s = parseDecimal(sigma);
  const t = v && s ? twoDigits(s) : null;
  if (!v || !t) return null;
  const m = roundTo(v, t.k);
  return m === 0n ? null : m.toString().length;
}

/** R327f1: the digits the value part of a unit row's "value ± σ" (Uncertainty.shown) shows; null as digitsToSigma, and
 *  for a text that is not the value, " ± " and σ. */
export function shownDigits(unc: { shown?: unknown; text?: unknown } | undefined): number | null {
  const sh = unc?.shown, tx = unc?.text;
  if (typeof sh !== "string" || typeof tx !== "string" || !sh.endsWith(` ± ${tx}`)) return null;
  return digitsToSigma(sh.slice(0, sh.length - tx.length - 3), tx);
}
