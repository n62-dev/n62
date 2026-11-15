// SPDX-License-Identifier: GPL-3.0-or-later
// G363: the value and the magnitude of a constant expression (constDouble.ts), read by giacPrint's arithmeticOf; values
// from Math, magnitudes by hand (5000*log10(sin(1)) = -374.80).
import { describe, expect, it } from "vitest";
import { constantDouble, constantLog10 } from "./constDouble.ts";
import { arithmeticOf } from "./giacPrint.ts";

const tree = (t: string): NonNullable<ReturnType<typeof arithmeticOf>> => {
  const a = arithmeticOf(t, "typed");
  if (!a) throw new Error(`no tree: ${t}`);
  return a;
};
const v = (t: string): number => constantDouble(tree(t));
const l = (t: string): number => constantLog10(tree(t));

describe("constantDouble", () => {
  it("evaluates numbers, pi, euler_gamma, the operations and the elementary functions", () => {
    expect(v("sin(1)")).toBe(Math.sin(1));
    expect(v("(1/sin(1))")).toBe(1 / Math.sin(1));
    expect(v("csc(1)")).toBe(1 / Math.sin(1));
    expect(v("ln(2)")).toBe(Math.LN2);
    expect(v("euler_gamma")).toBe(0.5772156649015329);
    expect(v("pi/180")).toBe(Math.PI / 180);
    expect(v(" 2 * exp( 1 ) - 1.5e1 ")).toBe(2 * Math.E - 15);
    expect(v("log10(1000)")).toBe(3);
  });
  it("reads ^ right-associative and tighter than a sign before it", () => {
    expect(v("-2^2")).toBe(-4);
    expect(v("2^-2")).toBe(0.25);
    expect(v("2^3^2")).toBe(512);
  });
  it("gives NaN for a name, a call it does not know, or a value that is no real", () => {
    for (const t of ["x", "pasdeg*1", "e", "i", "sin(x)", "f(1)", "ln(-2)", "asin(2)"]) expect(v(t), t).toBeNaN();
  });
});

describe("constantLog10 (G363 fix round 2)", () => {
  it("is log10 |value| in the double's range", () => {
    expect(l("sin(1)")).toBe(Math.log10(Math.sin(1)));
    expect(l("-pi")).toBe(Math.log10(Math.PI));
    expect(l("cos(1)^10+1")).toBe(Math.log10(Math.cos(1) ** 10 + 1));
  });
  it("reads past the double's range: a power of an integer literal multiplies, a product adds, a quotient subtracts", () => {
    const s = 5000 * Math.log10(Math.sin(1));
    // sin(1)^5000 is 0 in double, and (sin(1)^5000)^-2 Infinity; the audit's input counted only the inner 375
    expect(l("(sin(1)^5000)^(-2)")).toBeCloseTo(-2 * s, 9);
    expect(l("(sin(1)^5000)^2")).toBeCloseTo(2 * s, 9);
    expect(l("sin(1)^5000*sin(1)^5000/pi")).toBeCloseTo(2 * s - Math.log10(Math.PI), 9);
    expect(l("sqrt(sin(1)^5000)")).toBeCloseTo(s / 2, 9);
    expect(l("exp(2000)")).toBeCloseTo(2000 * Math.LOG10E, 9);
    expect(l("ln(sin(1)^5000)")).toBeCloseTo(Math.log10(-s / Math.LOG10E), 9);
    // two operands that underflow: the larger bounds the sum
    expect(l("sin(1)^5000+sin(1)^6000")).toBeCloseTo(s, 9);
    expect(l("sin(1)^-5000+1")).toBeCloseTo(-s + Math.log10(2), 9);
  });
  it("is Infinity in size where it cannot tell, never NaN for a constant: a tiny value -Infinity, a huge one Infinity", () => {
    expect(l("sin(sin(1)^5000)")).toBe(-Infinity);
    expect(l("cosh(sin(1)^-5000)")).toBe(Infinity);
    expect(l(`1${"0".repeat(400)}`)).toBe(Infinity);
  });
  it("a base of exactly 1 or an exponent 0 is 0 (an exponent of 309 digits is Infinity: no NaN)", () => {
    expect(l(`cos(0)^1${"0".repeat(309)}`)).toBe(0);
    expect(l("(sin(1)^5000)^0")).toBe(0);
  });
  it("gives NaN for no constant, and for a zero of normal operands (no magnitude, as 0^n)", () => {
    for (const t of ["x^5000", "(1-1)", "sin(0)", "(1-1)^5000", "0", "1/0", "(sin(1)^5000*x)^2", "asin(2)^5"]) expect(l(t), t).toBeNaN();
  });
});
