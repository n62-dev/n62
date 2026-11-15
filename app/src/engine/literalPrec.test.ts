// SPDX-License-Identifier: GPL-3.0-or-later
// G141: the precision a long exact literal needs (literalPrec.ts). Engine-free; the values are counted by hand.
import { describe, expect, it } from "vitest";
import { literalDigits, literalPastCap, literalStart, uncheckedPastCap } from "./literalPrec.ts";

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
    expect(literalDigits(`"exp(200)"+"pi^200"+1`, "typed")).toBe(1);
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
    // as Giac prints them: the tiny power stands in a denominator
    expect(literalStart("(1+1/pi^2200)^(pi^2200)", 40, 1000, "printed")).toEqual({ at: 40, unchecked: true });
    expect(literalStart("(1+1/exp(2400))^(exp(2400))", 40, 1000, "printed")).toEqual({ at: 40, unchecked: true });
  });
  it("past the cap counts no huge power of pi or exp, which rounds no term away (G307)", () => {
    expect(literalStart("exp(10000000)", 40, 1000, "printed")).toEqual({ at: 40, unchecked: false });
    expect(literalStart("pi^3000*sqrt(2)", 40, 1000, "typed")).toEqual({ at: 40, unchecked: false });
    expect(literalStart("exp(3000)+10^1250", 40, 1000, "typed")).toEqual({ at: 40, unchecked: true });
  });
  // G307f1: the four inputs of the G307 round 3 audit as the keys type them (latexToGiac); each showed ≈ 1
  it.each(["(1+1/(3*pi^2200))^(pi^2200)", "(1+1/(2*exp(2400)))^exp(2400)", "(1+(pi^2200)^(-1))^(pi^2200)", "(1+1/(pi^2200+1))^(pi^2200)"])(
    "past the cap counts a huge power in %s, which forms a small value (G307f1)",
    (text) => expect(literalStart(text, 40, 1000, "typed")).toEqual({ at: 40, unchecked: true }),
  );
  it("past the cap counts a huge power in a text with a division, a negative exponent or inv (G307f1)", () => {
    // a negative exponent anywhere, after a caret or exp's bracket, and inv
    expect(literalStart("(1+pi^-3)*pi^2200", 40, 1000, "typed")).toEqual({ at: 40, unchecked: true });
    expect(literalStart("(1+exp(-1))^exp(2400)", 40, 1000, "typed")).toEqual({ at: 40, unchecked: true });
    expect(literalStart("(1+inv(pi^2200))^(pi^2200)", 40, 1000, "typed")).toEqual({ at: 40, unchecked: true });
    // was { at: 140, unchecked: false } before G307f1: the text forms a small value (pi^(-200)), so exp(3000)'s 1303 digits count
    expect(literalStart("exp(3000)*(1+pi^(-200))", 40, 1000, "typed")).toEqual({ at: 40, unchecked: true });
    // a slash, a minus or inv inside a string forms no value; a subtraction is no negative exponent
    expect(literalStart(`pi^3000-1+"1/2^-3"`, 40, 1000, "typed")).toEqual({ at: 40, unchecked: false });
    expect(literalStart("myinv(2)+pi^3000", 40, 1000, "typed")).toEqual({ at: 40, unchecked: false });
  });
  // G307f2 (Opus pass 173): under a periodic function a huge power of pi or exp counts, as the value needs the argument
  // to an absolute precision no level we run holds; as the keys type them (latexToGiac) and as Giac prints them
  it.each(["sin(pi^2200)", "sin(pi^2200)+1", "cos(pi^2200)", "tan(pi^2200)", "sin(exp(2400))", "2*sec(exp(2400))", "csc(pi^2200)+cot(pi^2200)"])(
    "past the cap counts a huge power under a periodic function in %s (G307f2)",
    (text) => {
      expect(literalStart(text, 40, 1000, "typed")).toEqual({ at: 40, unchecked: true });
      expect(literalStart(text, 40, 1000, "printed")).toEqual({ at: 40, unchecked: true });
    },
  );
  it("still leaves a huge power out with no periodic call (G307f2 guards)", () => {
    expect(literalStart("pi^3000*sqrt(2)", 40, 1000, "typed")).toEqual({ at: 40, unchecked: false });
    expect(literalStart("exp(10000000)", 40, 1000, "printed")).toEqual({ at: 40, unchecked: false });
    // a name that merely ends in a trig name, and a trig name in a string, call nothing
    expect(literalStart(`mysin(2)+pi^3000+"cos(1)"`, 40, 1000, "typed")).toEqual({ at: 40, unchecked: false });
    // a periodic call below the cap starts at the literal's digits plus P, as before
    expect(literalStart("sin(pi^200)", 40, 1000, "typed")).toEqual({ at: 140, unchecked: false });
  });
  // G348 (Opus pass 175): exp of an i argument and a power of a negative or i base read their argument modulo 2π as a
  // periodic call does; as the keys type them and as Giac prints them (`(-2)^(pi^2200)` prints as
  // (-1)^(pi^2200)*2^(pi^2200), `i^(pi^2200)` as exp(i/2*pi^2201), `2*exp(-i*pi^2200)` as 2*exp((-i)*pi^2200))
  it.each([
    ["exp(i*pi^2207)", "exp(i*pi^2207)"],
    ["2*exp(-i*pi^2200)", "2*exp((-i)*pi^2200)"],
    ["(-1)^(pi^2206)", "(-1)^(pi^2206)"],
    ["(-2)^(pi^2200)", "(-1)^(pi^2200)*2^(pi^2200)"],
    ["i^(pi^2200)", "exp(i/2*pi^2201)"],
  ])("past the cap counts a huge power read modulo a period in %s (G348)", (typed, printed) => {
    expect(literalStart(typed, 40, 1000, "typed")).toEqual({ at: 40, unchecked: true });
    expect(literalStart(printed, 40, 1000, "printed")).toEqual({ at: 40, unchecked: true });
  });
  it("reads the place of a huge power, not the text's calls (G348)", () => {
    // as before G307f2: a periodic call elsewhere leaves the huge power out
    expect(literalStart("sin(1)+pi^3000", 40, 1000, "typed")).toEqual({ at: 40, unchecked: false });
    expect(literalStart("sin(1)+pi^3000", 40, 1000, "printed")).toEqual({ at: 40, unchecked: false });
    expect(literalStart("pi^3000*cos(0)", 40, 1000, "typed")).toEqual({ at: 40, unchecked: false });
    // a positive real base and an exp with no i read nothing modulo a period; a power after the exponent is outside it
    expect(literalStart("2^(pi^3000)+exp(pi^3000)", 40, 1000, "typed")).toEqual({ at: 40, unchecked: false });
    expect(literalStart("(-1)^pi*pi^3000", 40, 1000, "typed")).toEqual({ at: 40, unchecked: false });
    // a right-associative exponent, e^ of an i argument, i in a base's bracket, nested calls
    expect(literalStart("(-1)^pi^2206", 40, 1000, "typed")).toEqual({ at: 40, unchecked: true });
    expect(literalStart("e^(i*pi^2207)", 40, 1000, "typed")).toEqual({ at: 40, unchecked: true });
    expect(literalStart("(1+i)^(pi^2200)", 40, 1000, "typed")).toEqual({ at: 40, unchecked: true });
    expect(literalStart("exp(i*sqrt(exp(2400)))", 40, 1000, "typed")).toEqual({ at: 40, unchecked: true });
    // an i in a string names nothing
    expect(literalStart(`exp(pi^3000)+"i"`, 40, 1000, "typed")).toEqual({ at: 40, unchecked: false });
    // below the cap: the literal's digits plus P, as before
    expect(literalStart("exp(i*pi^200)", 40, 1000, "typed")).toEqual({ at: 140, unchecked: false });
  });
  it("is the digit count plus P up to the cap", () => {
    expect(literalStart("10^919", 40, 1000, "typed")).toEqual({ at: 960, unchecked: false });
    expect(literalStart("10^920", 40, 1000, "typed")).toEqual({ at: 40, unchecked: true });
  });
});

// G363 (night review 2026-11-14, be-3): a power of any constant base with an integer literal exponent is a magnitude;
// digit counts ⌈|n|·|log10 b|⌉ by hand: sin(1)^5000 374.80 → 375, ln(2)^500 79.59 → 80, euler_gamma^5000 1193.31 → 1194,
// sin(1)^20000 and csc(1)^20000 1499.22 → 1500, cos(1)^10 2.67 → 3, sin(1)^2 0.15 → 1
describe("a power of a constant base (G363)", () => {
  it("counts its magnitude, as Giac prints it and as typed with no angle factor", () => {
    expect(literalDigits("(1+sin(1)^5000)^(sin(1)^-5000)", "printed")).toBe(375);
    expect(literalDigits("(1+sin(1)^5000)^(sin(1)^(-5000))", "typed")).toBe(375);
    expect(literalDigits("(1+ln(2)^500)^(ln(2)^-500)", "printed")).toBe(80);
    expect(literalDigits("(1+euler_gamma^5000)^(1/euler_gamma^5000)", "printed")).toBe(1194);
    expect(literalDigits("(1+sin(1)^20000)^((1/sin(1))^20000)", "printed")).toBe(1500);
    expect(literalDigits("cos(1)^10+1", "printed")).toBe(3);
    expect(literalDigits("sin(1)^2", "printed")).toBe(1);
    // was 0 before G363: no literal, Giac keeps sin(1)^5000 as it is
    expect(literalDigits("ln(1+sin(1)^5000)*sin(1)^-5000", "printed")).toBe(375);
  });
  it("reads no free, stored or mode name, no complex or undefined base and no non-literal exponent", () => {
    expect(literalDigits("sin(x)^5000+B^5000+sin(pasdeg*1)^5000+e^5000", "typed")).toBe(4);
    expect(literalDigits("(1+i)^5000+ln(-2)^5000+asin(2)^5000+(1-1)^5000+0^5000", "typed")).toBe(4);
    // a base 0 in exact maths that the double rounds (cos(pi/2) is 6.1E-17) counts too many digits: a later start or ⚠, never ≈
    expect(literalDigits("cos(pi/2)^5", "typed")).toBe(82); // ⌈5·16.21⌉
    expect(literalDigits("sin(1)^(5000*x)+sin(1)^5000.5", "typed")).toBe(4);
    // a right-associative exponent is no literal; its own power (5000² = 25000000) counts as one
    expect(literalDigits("sin(1)^(5000)^2", "typed")).toBe(8);
    expect(literalDigits(`"sin(1)^5000"+1`, "typed")).toBe(1);
    // a base of exactly 1 is no magnitude; an integer base stays a power of two integer literals (G141)
    expect(literalDigits("cos(0)^5000", "typed")).toBe(4);
    expect(literalDigits("10^(-100)", "typed")).toBe(101);
  });
  it("starts the agreement check past the power's digits below the cap", () => {
    expect(literalStart("(1+sin(1)^5000)^(sin(1)^-5000)", 40, 1000, "printed")).toEqual({ at: 415, unchecked: false });
    expect(literalStart("(1+ln(2)^500)^(ln(2)^-500)", 40, 1000, "printed")).toEqual({ at: 120, unchecked: false });
    expect(literalStart("ln(1+sin(1)^5000)*sin(1)^-5000", 40, 1000, "printed")).toEqual({ at: 415, unchecked: false });
    expect(literalStart("cos(1)^10+1", 40, 1000, "printed")).toEqual({ at: 40, unchecked: false });
  });
  it("past the cap counts a power that forms a small value: a base below 1 to a positive power, above 1 to a negative one", () => {
    // CAS-typed (no angle factor): no slash, no minus after a caret; was { at: 40, unchecked: false } (≈ 1, the value is e)
    expect(literalStart("(1+sin(1)^20000)^(csc(1)^20000)", 40, 1000, "typed")).toEqual({ at: 40, unchecked: true });
    expect(literalStart("(1+csc(1)^(-20000))^(csc(1)^20000)", 40, 1000, "typed")).toEqual({ at: 40, unchecked: true });
    // as Giac prints them
    expect(literalStart("(1+sin(1)^20000)^((1/sin(1))^20000)", 40, 1000, "printed")).toEqual({ at: 40, unchecked: true });
    expect(literalStart("(1+(1/sin(1))^-20000)^((1/sin(1))^20000)", 40, 1000, "printed")).toEqual({ at: 40, unchecked: true });
    expect(literalStart("(1+euler_gamma^5000)^(1/euler_gamma^5000)", 40, 1000, "printed")).toEqual({ at: 40, unchecked: true });
    expect(literalStart("sin(1)^20000+pi^3000", 40, 1000, "typed")).toEqual({ at: 40, unchecked: true });
  });
  it("fix round 2: counts a power of a base the double cannot hold, and never NaN", () => {
    // sin(1)^5000 is 0 in double: (sin(1)^5000)^-2 counted nothing, so 1+1E-750 was 1 at a start of 415 (≈ 1, the value e);
    // 2·374.80 = 749.6 → 750
    const audit = "(1+(sin(1)^5000)^2)^((sin(1)^5000)^(-2))";
    expect(literalDigits(audit, "typed")).toBe(750);
    expect(literalStart(audit, 40, 1000, "typed")).toEqual({ at: 790, unchecked: false });
    // an exponent of 310 digits on a base of exactly 1 gave NaN, which hid the 2001 digits of 10^2000 from the decisions
    const one = `sign(sin(10^2000)+cos(0)^1${"0".repeat(309)})`;
    expect(literalDigits(one, "typed")).toBe(2001);
    expect(literalPastCap(one, 40, 1000, "typed")).toBe(true);
    expect(literalDigits(`(1+cos(0))^1${"0".repeat(309)}`, "typed")).toBe(Infinity);
  });
  it("past the cap leaves out a huge power that forms no small value", () => {
    // above 1 to a positive power, below 1 to a negative one: alone it rounds no term away
    expect(literalStart("csc(1)^20000*sqrt(2)", 40, 1000, "typed")).toEqual({ at: 40, unchecked: false });
    expect(literalStart("sin(1)^(-20000)+1", 40, 1000, "typed")).toEqual({ at: 40, unchecked: true }); // ^( - is a negative exponent (G307f1)
    expect(literalStart("pi^3000*cos(0)^5", 40, 1000, "typed")).toEqual({ at: 40, unchecked: false });
    // but a decision on it cannot hold it
    expect(literalPastCap("csc(1)^20000>0", 40, 1000, "typed")).toBe(true);
  });
});

describe("literalPastCap (G307 fix round 2)", () => {
  it("counts a huge power of pi or exp, which a decision on it cannot hold, as a power of ten", () => {
    expect(literalPastCap("sin(10^2000)>0", 40, 1000, "typed")).toBe(true);
    expect(literalPastCap("sin(pi^2200)>0", 40, 1000, "typed")).toBe(true);
    expect(literalPastCap("sin(exp(2400))>0", 40, 1000, "typed")).toBe(true);
    expect(literalPastCap("sign(sin(exp(3000)))", 40, 1000, "typed")).toBe(true);
    // the value's start leaves the same powers out (g58-exp-1e7-12 stays ≈), but not under a periodic function (G307f2)
    expect(literalStart("pi^3000*sqrt(2)", 40, 1000, "typed").unchecked).toBe(false);
    expect(literalStart("exp(10000000)", 40, 1000, "printed").unchecked).toBe(false);
    expect(literalPastCap("exp(10000000)", 40, 1000, "printed")).toBe(true);
  });
  it("is false below the cap", () => {
    expect(literalPastCap("sin(pi^200)>0", 40, 1000, "typed")).toBe(false);
    expect(literalPastCap("sin(exp(5))>0", 40, 1000, "typed")).toBe(false);
    expect(literalPastCap("10^919", 40, 1000, "typed")).toBe(false);
    expect(literalPastCap("10^920", 40, 1000, "typed")).toBe(true);
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
