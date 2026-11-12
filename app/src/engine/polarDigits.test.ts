// SPDX-License-Identifier: GPL-3.0-or-later
// G312: the digits of r and θ that a value's n confirmed digits confirm. r and θ are the oracle's (mpmath at 60 digits);
// the counts are derived by hand from the bound in polarDigits.ts: each part off by less than u (one unit in its n-th
// digit), r by less than u_x + u_y, θ by less than ((|x| + u_x)·u_y + (|y| + u_y)·u_x) / (r − u_x − u_y)²; a count is the
// largest k at which both ends of the interval round alike.
import { describe, expect, it } from "vitest";
import { decimalFromString, ZERO_VALUE, type DecimalValue } from "./format.ts";
import { polarDigits } from "./polarDigits.ts";

const d = (s: string): DecimalValue => decimalFromString(s) as DecimalValue;

describe("polarDigits (G312)", () => {
  it("1+i with 14 digits: r = √2 ± 2E-13 rounds alike to 13 digits, θ = π/4 ± 1.0E-13 to 11", () => {
    // θ: 0.785398163397348… and 0.785398163397548… round alike to 11 digits (0.78539816340), not 12 (…397, …398)
    const z = { re: d("1"), im: d("1") };
    expect(polarDigits(z, 14, d("1.4142135623730950488016887242097"), d("0.78539816339744830961566084581988"), "rad")).toEqual({ r: 13, theta: 11 });
  });
  it("1 + 1E-20·i: θ keeps its relative precision (± 2.0E-33 on 1E-20: 12 digits), r ± 1.0E-13: 12", () => {
    const z = { re: d("1"), im: d("1e-20") };
    const r = d("1.00000000000000000000000000000000000000005");
    const theta = d("9.99999999999999999999999999999999999999966667e-21");
    expect(polarDigits(z, 14, r, theta, "rad")).toEqual({ r: 12, theta: 12 });
  });
  it("10^100000000 + i: the same counts, with no BigInt of 10^8 digits (G58)", () => {
    const z = { re: d("1e100000000"), im: d("1") };
    const t0 = performance.now();
    expect(polarDigits(z, 14, d("1e100000000"), d("1e-100000000"), "rad")).toEqual({ r: 12, theta: 12 });
    expect(performance.now() - t0).toBeLessThan(200);
  });
  it("2i: the zero real part is exact, so θ = π/2 keeps every digit asked for; r = 2 ± 1E-13: 13", () => {
    const z = { re: ZERO_VALUE, im: d("2") };
    expect(polarDigits(z, 14, d("2"), d("1.5707963267948966192313216916397514"), "rad")).toEqual({ r: 13, theta: 14 });
  });
  it("DEG: θ in degrees moves 180/π times as far: 1+i, θ = 45 ± 5.8E-12°, 12 digits (14 with the radian bound)", () => {
    // the bound in radians, 1.0E-13, times 573/10 (≥ 180/π): 44.9999999999942… and 45.0000000000058… round alike to 12
    // digits (45.0000000000), not 13 (44.99999999999, 45.00000000000); the true error, 1.0E-13 · 57.2957… = 5.7E-12°, too
    const z = { re: d("1"), im: d("1") };
    expect(polarDigits(z, 14, d("1.4142135623730950488016887242097"), d("45"), "deg")).toEqual({ r: 13, theta: 12 });
    expect(polarDigits(z, 14, d("1.4142135623730950488016887242097"), d("45"), "rad")).toEqual({ r: 13, theta: 14 });
  });
  it("no confirmed digit, or an r that is no polar form of the value: none", () => {
    expect(polarDigits({ re: d("1"), im: d("1") }, 0, d("1.41421356237"), d("0.785398163397"), "rad")).toEqual({ r: 0, theta: 0 });
    expect(polarDigits({ re: d("1"), im: d("1") }, 14, d("1e5"), d("0.785398163397"), "rad")).toEqual({ r: 0, theta: 0 });
  });
});
