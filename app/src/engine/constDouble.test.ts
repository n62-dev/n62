// SPDX-License-Identifier: GPL-3.0-or-later
// G363: one double evaluation of a constant expression (constDouble.ts); values from Math, by hand.
import { describe, expect, it } from "vitest";
import { constantDouble } from "./constDouble.ts";

describe("constantDouble", () => {
  it("evaluates numbers, pi, euler_gamma, the operations and the elementary functions", () => {
    expect(constantDouble("sin(1)")).toBe(Math.sin(1));
    expect(constantDouble("(1/sin(1))")).toBe(1 / Math.sin(1));
    expect(constantDouble("csc(1)")).toBe(1 / Math.sin(1));
    expect(constantDouble("ln(2)")).toBe(Math.LN2);
    expect(constantDouble("euler_gamma")).toBe(0.5772156649015329);
    expect(constantDouble("pi/180")).toBe(Math.PI / 180);
    expect(constantDouble(" 2 * exp( 1 ) - 1.5e1 ")).toBe(2 * Math.E - 15);
    expect(constantDouble("log10(1000)")).toBe(3);
  });
  it("reads ^ right-associative and tighter than a sign before it", () => {
    expect(constantDouble("-2^2")).toBe(-4);
    expect(constantDouble("2^-2")).toBe(0.25);
    expect(constantDouble("2^3^2")).toBe(512);
  });
  it("gives NaN for a name, a call it does not know, a value that is no finite real, or a text it does not read", () => {
    for (const t of ["x", "pasdeg*1", "e", "i", "sin(x)", "f(1)", "ln(-2)", "asin(2)", "1/0", "sin(1,2)", "(1", "1)", "", '"1"', "2!"]) {
      expect(constantDouble(t), t).toBeNaN();
    }
  });
});
