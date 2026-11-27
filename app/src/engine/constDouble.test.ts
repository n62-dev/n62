// SPDX-License-Identifier: GPL-3.0-or-later
// G363: the value and the magnitude of a constant expression (constDouble.ts), read by giacPrint's arithmeticOf; values
// from Math, magnitudes by hand (5000*log10(sin(1)) = -374.80).
import { describe, expect, it } from "vitest";
import { constantDouble, constantLog10, flatErfc } from "./constDouble.ts";
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
    // Giac's print of e^sqrt(acosh(10^-300)) (g186-exp-sqrt-acosh-1e-300-12) holds ln(1/10^600+1)^2: ln(1) in double, which
    // a log10 of -Infinity sent past the cap (⚠ where ≈ is right); its 1/10^600 counts by itself
    expect(l("ln((1/10^300)^2+1)")).toBeNaN();
    expect(l("ln((1/10^300)^2+1)^2")).toBeNaN();
  });
});

// G403: the oracle's values, mpmath at 1200 digits (log10 of the exact value)
describe("constantLog10 past the double by an asymptote (G403)", () => {
  it("(a) reads cosh and sinh past the double's range as |x|·log10 e − log10 2, where they were an overflow", () => {
    // cosh(1000) is Infinity in double; mpmath: 433.993451907588
    expect(l("cosh(1000)")).toBeCloseTo(433.993451907588, 9);
    expect(l("sinh(-1000)")).toBeCloseTo(433.993451907588, 9);
    expect(l("1/cosh(1000)")).toBeCloseTo(-433.993451907588, 9);
    // in the double's range as before (mpmath: 129.987314575312)
    expect(l("cosh(300)")).toBeCloseTo(129.987314575312, 9);
    // fix round 2: only an overflow. sinh(0) is a zero (no magnitude), and sinh of an argument the double rounds to 0 is
    // that argument (mpmath: log10 sinh(sin(1)^5000) = -374.804272802478; it read -0.301, sizing sinh(…)^-5000 at 1505)
    expect(l("sinh(0)")).toBeNaN();
    expect(l("sinh(sin(1)^5000)")).toBeCloseTo(-374.804272802478, 9);
  });
  it("(b) reads ln(1 ± u) and log10(1 ± u) as u where 1 ± u rounds to 1 in double", () => {
    // mpmath: log10 ln(1+sin(1)^5000) = -374.804272802478, log10 log10(1+sin(1)^5000) = -375.166488491177
    expect(l("ln(1+sin(1)^5000)")).toBeCloseTo(-374.804272802478, 9);
    expect(l("log(sin(1)^5000+1)")).toBeCloseTo(-374.804272802478, 9);
    expect(l("ln(1-sin(1)^5000)")).toBeCloseTo(-374.804272802478, 9);
    expect(l("log10(1+sin(1)^5000)")).toBeCloseTo(-375.166488491177, 9);
    // its square by the literal-power rule (G363)
    expect(l("ln(1+sin(1)^5000)^2")).toBeCloseTo(-749.608545604955, 8);
    // a u of numbers alone counts by its literals (G141), and ln(1) is still no magnitude
    expect(l("ln((1/10^300)^2+1)")).toBeNaN();
    expect(l("ln(1+sin(0))")).toBeNaN();
  });
  it("(c) reads erfc(x) and Giac's 1-erf(x) for x > 5 as −x²·log10 e − log10(x·√π)", () => {
    // mpmath: log10 erfc(12) = -63.8676566722511, log10 erfc(6) = -16.6671630464354: the asymptote is within 0.002 and 0.006
    expect(l("erfc(12)")).toBeCloseTo(-63.8676566722511, 2);
    expect(l("1-erf(12)")).toBeCloseTo(-63.8676566722511, 2);
    expect(l("erfc(6)")).toBeCloseTo(-16.6671630464354, 1);
    // fix round 2: a sum Giac prints flat, (1+1)-erf(50) in its tree, holds the term 1-erf(50) (flatErfc)
    const flat = (t: string): number => constantLog10(flatErfc(arithmeticOf(t, "printed")!)!);
    expect(flat("1+1-erf(12)")).toBeCloseTo(-63.8676566722511, 2);
    expect(flat("pi-1+erf(12)")).toBeCloseTo(-63.8676566722511, 2);
    expect(flatErfc(arithmeticOf("2-erf(12)", "printed")!)).toBeNull();
    expect(l("erfc(12)^2")).toBeCloseTo(2 * -63.8676566722511, 2);
    // x ≤ 5 or not constant: no double here, as before
    for (const t of ["erfc(4)", "1-erf(5)", "erfc(x)", "2-erf(12)"]) expect(l(t), t).toBeNaN();
  });
});
