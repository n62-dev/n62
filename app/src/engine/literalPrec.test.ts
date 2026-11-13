// SPDX-License-Identifier: GPL-3.0-or-later
// G141: the precision a long exact literal needs (literalPrec.ts). Engine-free; the values are counted by hand.
import { describe, expect, it } from "vitest";
import { literalDigits, literalStart, uncheckedPastCap } from "./literalPrec.ts";

const ONE_E100 = "1" + "0".repeat(100);

describe("literalDigits", () => {
  it("counts the longest printed integer", () => {
    expect(literalDigits(`exp(${ONE_E100}*ln(${ONE_E100.slice(0, -1)}1/${ONE_E100}))`, "printed")).toBe(101);
    expect(literalDigits(`sqrt(2)*${ONE_E100}`, "printed")).toBe(101);
    expect(literalDigits("sqrt(2)+1/3", "printed")).toBe(1);
  });
  it("skips names, decimals and strings", () => {
    expect(literalDigits(`"${ONE_E100}"+1`, "typed")).toBe(1);
    expect(literalDigits("x12345678901234567890123+1.234567890123456789012345", "typed")).toBe(0);
  });
  it("reads a typed power of two integer literals", () => {
    expect(literalDigits("evalf((1+10^(-100))^(10^100))", "typed")).toBe(101);
    expect(literalDigits("2^-64", "typed")).toBe(20);
    expect(literalDigits("x^100+1^500", "typed")).toBe(3);
    expect(literalDigits("3^(200)+10^-70", "typed")).toBe(96);
  });
  it("reads a power of pi and exp of an integer literal as a magnitude (G307)", () => {
    // ⌈200·log10 π⌉ = ⌈99.43⌉ = 100, ⌈200·log10 e⌉ = ⌈86.86⌉ = 87, ⌈2200·log10 π⌉ = ⌈1093.7⌉ = 1094
    expect(literalDigits("(1+pi^(-200))^(pi^200)", "typed")).toBe(100);
    expect(literalDigits("(1+pi^-200)^pi^200", "typed")).toBe(100);
    expect(literalDigits("(1+exp(-200))^exp(200)", "typed")).toBe(87);
    expect(literalDigits("(exp(-200)+1)^exp(200)", "printed")).toBe(87);
    expect(literalDigits("pi^(2200)", "typed")).toBe(1094);
    expect(literalDigits("pi^2+exp(5)", "typed")).toBe(3);
  });
  it("reads no other name, no non-literal exponent and no call of another name (G307)", () => {
    expect(literalDigits("api^200+e^200+x^200", "typed")).toBe(3);
    expect(literalDigits("myexp(200)+exp(200*x)+exp(x+200)+exp(200.5)", "typed")).toBe(3);
    expect(literalDigits("pi^(200*x)+pi^200.5+pi^2e3", "typed")).toBe(3);
    expect(literalDigits(`"exp(200)"+pi^("200")`, "typed")).toBe(1);
  });
});

describe("literalStart", () => {
  it("is P without a long literal", () => {
    expect(literalStart("sqrt(2)*2^20", 40, 1000, "typed")).toEqual({ at: 40, unchecked: false });
  });
  it("is the digit count plus P for one that passes P - 20", () => {
    expect(literalStart(`ln(${ONE_E100.slice(0, -1)}1)`, 40, 1000, "printed")).toEqual({ at: 141, unchecked: false });
    expect(literalStart("exp(10^-70)-1", 50, 1000, "typed")).toEqual({ at: 121, unchecked: false });
    expect(literalStart("2^66+1", 40, 1000, "typed")).toEqual({ at: 40, unchecked: false });
    expect(literalStart("2^67+1", 40, 1000, "typed")).toEqual({ at: 61, unchecked: false });
    expect(literalStart("(1+pi^(-200))^(pi^200)", 40, 1000, "typed")).toEqual({ at: 140, unchecked: false });
    expect(literalStart("(1+exp(-200))^exp(200)", 40, 1000, "typed")).toEqual({ at: 127, unchecked: false });
    expect(literalStart("2*exp(-3)+1/3", 40, 1000, "typed")).toEqual({ at: 40, unchecked: false });
  });
  it("past the cap is P unchecked, a power of ten too (G141f1)", () => {
    expect(literalStart("1" + "0".repeat(1249) + "1", 40, 1000, "printed")).toEqual({ at: 40, unchecked: true });
    expect(literalStart("1" + "0".repeat(1250), 40, 1000, "printed")).toEqual({ at: 40, unchecked: true });
    expect(literalStart("(1-cos(10^-600))*10^1200+1", 40, 1000, "typed")).toEqual({ at: 40, unchecked: true });
    expect(literalStart("asinh(-10^1250)", 40, 1000, "typed")).toEqual({ at: 40, unchecked: true });
    expect(literalStart("(1+pi^(-2200))^(pi^2200)", 40, 1000, "typed")).toEqual({ at: 40, unchecked: true });
    expect(literalStart("(1+exp(-2400))^exp(2400)", 40, 1000, "typed")).toEqual({ at: 40, unchecked: true });
  });
  it("is the digit count plus P up to the cap", () => {
    expect(literalStart("10^919", 40, 1000, "typed")).toEqual({ at: 960, unchecked: false });
    expect(literalStart("10^920", 40, 1000, "typed")).toEqual({ at: 40, unchecked: true });
  });
});

describe("uncheckedPastCap (G141f2)", () => {
  const f = (exact: boolean, reliableDigits: number | null, warn?: "unaudited" | "unchecked") => ({ exact, reliableDigits, ...(warn ? { warn } : {}) });
  it("warns a float that has confirmed digits, keeping a warn it has", () => {
    expect(uncheckedPastCap(f(false, 12))).toEqual({ ...f(false, 12, "unchecked"), pastCap: true }); // G182: marked for the why line
    expect(uncheckedPastCap(f(false, 12, "unaudited"))).toEqual(f(false, 12, "unaudited"));
  });
  it("leaves an exact element and a no-digit one as they are", () => {
    expect(uncheckedPastCap(f(true, null))).toEqual(f(true, null));
    expect(uncheckedPastCap(f(false, 0))).toEqual(f(false, 0));
  });
});
