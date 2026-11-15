// SPDX-License-Identifier: GPL-3.0-or-later
// σ to 2 significant digits and the value rounded to its last digit (G18, docs/04 2.6).
import { describe, expect, it } from "vitest";
import { expandedText, relativeSigma, shortForm, shownWithUncertainty, uncertaintyText } from "./uncertainty.ts";

describe("uncertainty text (G18)", () => {
  it("σ is 2 significant digits, a trailing zero kept", () => {
    expect(uncertaintyText("1.2443295383458515")).toBe("1.2");
    expect(uncertaintyText("0.1")).toBe("0.10");
    expect(uncertaintyText("0.0999")).toBe("0.10");
    expect(uncertaintyText("9.96")).toBe("10");
    expect(uncertaintyText("12443.3")).toBe("12000");
    expect(uncertaintyText("1.5e-15")).toBe("1.5E-15");
    expect(uncertaintyText("0")).toBe("0");
    expect(uncertaintyText("x")).toBeNull();
  });
  it("the value is rounded to σ's last digit", () => {
    expect(shownWithUncertainty("39.488", "1.2443295383", "39.488")).toBe("39.5 ± 1.2");
    expect(shownWithUncertainty("2.5", "0.080039", "2.5")).toBe("2.500 ± 0.080");
    expect(shownWithUncertainty("394880", "12443.3", "394880")).toBe("395000 ± 12000");
    expect(shownWithUncertainty("-0.004", "0.28", "-0.004")).toBe("0.00 ± 0.28");
    expect(shownWithUncertainty("1.5", "0", "1.5")).toBe("1.5 ± 0");
    expect(shownWithUncertainty("6.6743E-11", "1.5e-15", "6.6743E-11")).toBe("6.67430E-11 ± 1.5E-15");
  });
  it("a value rounded to 0 at a place above 1 is written 0 (G143, be-7)", () => {
    expect(shownWithUncertainty("5", "1234", "5")).toBe("0 ± 1200");
    expect(shownWithUncertainty("5", "1.2E15", "5")).toBe("0 ± 1.2E15");
    expect(shownWithUncertainty("-5", "1234", "-5")).toBe("0 ± 1200");
    // controls: a value that rounds to a digit keeps its zeros; a 0 below 1 keeps σ's places
    expect(shownWithUncertainty("50", "1234", "50")).toBe("100 ± 1200");
    expect(shownWithUncertainty("0.004", "0.28", "0.004")).toBe("0.00 ± 0.28");
  });
});

describe("the short form 39.5(12) (G270, GUM 7.2.2 way 2)", () => {
  // [value, σ, maxDigits, expected, source]
  const rows: [string, string, number, string | null, string][] = [
    ["100.02147", "0.00035", 30, "100.02147(35)", "derived, GUM 7.2.2"],
    ["10.05762", "0.027", 30, "10.058(27)", "derived, GUM 7.2.6"],
    ["6.6743E-11", "1.5E-15", 30, "6.67430(15)E-11", "derived, NIST CODATA G"],
    ["9.1093837139E-31", "2.8E-40", 30, "9.1093837139(28)E-31", "derived, NIST CODATA mₑ"],
    ["39.488", "1.24433958387572", 30, "39.5(12)", "derived, t10"],
    ["9.996", "0.0996", 30, "10.00(10)", "derived, the carry"],
    ["0.0034", "0.00049", 30, "0.00340(49)", "derived"],
    ["12345", "123", 30, "1.235(12)E4", "derived"],
    ["1234", "56", 30, "1234(56)", "derived"],
    ["-1234", "56", 30, "-1234(56)", "derived"],
    ["12.34", "0.05", 30, "12.340(50)", "derived"],
    ["0", "123", 30, "0(12)E1", "derived"],
    ["0", "0.05", 30, "0.000(50)", "derived"],
    ["0", "1E-40", 30, "0(10)E-41", "derived"],
    ["39.488", "1E-10", 30, "39.48800000000(10)", "derived"],
    ["1E28", "1", 30, `1.${"0".repeat(29)}(10)E28`, "derived, needs exactly 30"],
    ["39.488", "0.1", 4, "39.49(10)", "derived, needs exactly 4"],
    ["39.488", "0.1", 3, null, "derived"],
    ["9.996", "0.0996", 3, "10.00(10)", "derived, the carry at exactly 3"],
    ["9.996", "0.0996", 2, null, "derived"],
    ["1E40", "1", 30, null, "derived, needs 42"],
    ["5", "0", 30, null, "derived"],
    ["1+2*i", "0.1", 30, null, "derived"],
  ];
  it.each(rows)("%s, σ %s, %i digits", (value, sigma, max, expected) => {
    expect(shortForm(value, sigma, max)).toBe(expected);
  });
  it("a value far from σ's place is refused or zero without a giant number", () => {
    // derived: 1E999999999 needs 10^9 digits; a value 10^9 places under σ rounds to 0
    expect(shortForm("1E999999999", "1", 30)).toBeNull();
    expect(shortForm("1E-999999999", "1", 30)).toBe("0.0(10)");
    expect(shortForm("5", "1E999999999", 30)).toBe("0(10)E999999998");
  });
});

describe("the relative σ in percent (G270)", () => {
  // source: derived (σ/|y| · 100 at 2 significant digits)
  it("is 2 significant digits as text", () => {
    expect(relativeSigma("39.488", "1.24433958387572")).toBe("3.2");
    expect(relativeSigma("6.6743E-11", "1.5E-15")).toBe("0.0022");
    expect(relativeSigma("-2", "0.1")).toBe("5.0");
    expect(relativeSigma("1", "0.0996")).toBe("10");
    expect(relativeSigma("1", "1234")).toBe("120000");
  });
  it("has none for a value of 0, a σ of 0 or text that is no decimal", () => {
    expect(relativeSigma("0", "1")).toBeNull();
    expect(relativeSigma("5", "0")).toBeNull();
    expect(relativeSigma("1+2*i", "1")).toBeNull();
  });
});

describe("U as text (G270)", () => {
  // source: derived (2 × the unrounded σ at 2 significant digits)
  it("doubles the unrounded σ, never the rounded one", () => {
    expect(expandedText("1.24433958387572")).toBe("2.5");
    expect(expandedText("0.05")).toBe("0.10");
    expect(expandedText("0")).toBe("0");
    expect(expandedText("x")).toBeNull();
  });
});
