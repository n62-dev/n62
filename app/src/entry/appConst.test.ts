// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { constValueLatex, hasChipLatex } from "./appConst.ts";

describe("a constant on an app's line (R747)", () => {
  it("an integer or plain decimal is its digits", () => {
    expect(constValueLatex("299792458", "expr")).toBe("299792458");
    expect(constValueLatex("0.5291772", "num")).toBe("0.5291772");
  });
  it("an exponent: one bracketed term on an expression line, the exponent key's form on a number line", () => {
    expect(constValueLatex("6.67430E-11", "expr")).toBe("\\left(6.67430\\times10^{-11}\\right)");
    expect(constValueLatex("1.5e+3", "expr")).toBe("\\left(1.5\\times10^{3}\\right)");
    expect(constValueLatex("6.67430E-11", "num")).toBe("6.67430\\emark-11");
    expect(constValueLatex("2E0", "expr")).toBe("2");
  });
  it("a value that is no plain decimal goes in as written", () => {
    expect(constValueLatex("1/3", "expr")).toBe("\\left(1/3\\right)");
  });
  it("finds the chips", () => {
    expect(hasChipLatex("x+\\const{c}{c}")).toBe(true);
    expect(hasChipLatex("\\res{2}{3}")).toBe(true);
    expect(hasChipLatex("\\ans")).toBe(true);
    expect(hasChipLatex("x\\times3")).toBe(false);
  });
});
