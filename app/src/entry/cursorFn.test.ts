// SPDX-License-Identifier: GPL-3.0-or-later
// R196: which function the cursor is in, on the entry's LaTeX alone. `|` marks the cursor in each case.
import { describe, expect, it } from "vitest";
import { functionAt } from "./cursorFn.ts";

/** The Find id at the `|` of `marked` (the bar is taken out first). */
const at = (marked: string): string | null => {
  const o = marked.indexOf("|");
  if (o < 0 || marked.indexOf("|", o + 1) >= 0) throw new Error(`one | please: ${marked}`);
  return functionAt(marked.slice(0, o) + marked.slice(o + 1), o);
};

describe("functionAt (R196)", () => {
  it("finds the function whose bracket holds the cursor", () => {
    expect(at("\\sin\\left(1+|\\right)")).toBe("fn:sin");
    expect(at("2\\cdot\\sin\\left(|1\\right)+3")).toBe("fn:sin");
    expect(at("\\sin\\left(1|\\right)")).toBe("fn:sin");
  });

  it("takes the innermost function", () => {
    expect(at("\\sin\\left(\\cos\\left(|\\right)\\right)")).toBe("fn:cos");
    expect(at("\\sin\\left(1+|\\cos\\left(2\\right)\\right)")).toBe("fn:sin");
    expect(at("\\sin\\left(\\cos\\left(2\\right)|\\right)")).toBe("fn:sin");
    // a plain pair inside a function is no function of its own
    expect(at("\\ln\\left(\\left(1+|2\\right)\\cdot3\\right)")).toBe("fn:ln");
    // nor is a fraction
    expect(at("\\exp\\left(\\frac{1}{|2}\\right)")).toBe("fn:exp");
  });

  it("finds the function on its name", () => {
    expect(at("\\si|n\\left(1\\right)")).toBe("fn:sin");
    expect(at("\\sin|\\left(1\\right)")).toBe("fn:sin");
    expect(at("\\operatorname{std|dev}\\left(1\\right)")).toBe("fn:stddev");
  });

  it("is null outside any function", () => {
    expect(at("|")).toBeNull();
    expect(at("1+|2")).toBeNull();
    expect(at("|\\sin\\left(1\\right)")).toBeNull();
    expect(at("\\sin\\left(1\\right)|")).toBeNull();
    expect(at("\\sin\\left(1\\right)+|2")).toBeNull();
    expect(at("\\left(1+|2\\right)")).toBeNull();
    expect(at("\\frac{1}{|2}")).toBeNull();
  });

  it("reads a function written with \\operatorname", () => {
    expect(at("\\operatorname{stddev}\\left(|\\right)")).toBe("fn:stddev");
    expect(at("\\operatorname{\\mathrm{stddev}}\\left(|\\right)")).toBe("fn:stddev");
    expect(at("\\operatorname{NOT}\\left(x>|0\\right)")).toBe("fn:not");
    expect(at("\\operatorname{Gamma}\\left(|\\right)")).toBe("fn:Gamma");
    // AND, OR and XOR stand between their operands: no call, and the bracket after one is a plain pair
    expect(at("x>0\\operatorname{AND}\\left(x<|1\\right)")).toBeNull();
  });

  it("gives Find's id where it differs from the command", () => {
    expect(at("\\arcsin\\left(|\\right)")).toBe("fn:asin");
    expect(at("\\log\\left(|\\right)")).toBe("fn:log10");
    expect(at("\\log_{2}\\left(|\\right)")).toBe("fn:logb");
    expect(at("\\log_{|2}\\left(8\\right)")).toBe("fn:logb");
    expect(at("\\lim_{x\\to0}\\left(|\\right)")).toBe("fn:limit");
    expect(at("\\sum_{i=1}^{n}\\left(|i\\right)")).toBe("fn:sum");
    expect(at("\\prod_{i=|1}^{n}\\left(i\\right)")).toBe("fn:product");
    expect(at("\\sqrt{|2}")).toBe("fn:sqrt");
    expect(at("\\sqrt[3]{|2}")).toBe("tmpl:cbrt");
    expect(at("\\sqrt[4]{|2}")).toBe("fn:surd");
    // |x| draws its own bars: the cursor goes by offset here, after the −
    expect(functionAt("\\left|-2\\right|", 7)).toBe("fn:abs");
    expect(functionAt("1+\\left|-2\\right|", 2)).toBeNull();
  });

  it("is null on a chip, and never reads what a chip shows", () => {
    expect(at("\\res{1}{2}|")).toBeNull();
    expect(at("\\res{1}{\\sin\\left(|1\\right)}")).toBeNull();
    expect(at("\\const{c}{|c}")).toBeNull();
    expect(at("\\sin\\left(\\res{1}{\\cos\\left(1\\right)}|\\right)")).toBe("fn:sin");
    expect(at("\\sin\\left(\\ans|\\right)")).toBe("fn:sin");
  });

  it("is null for an offset off the line", () => {
    expect(functionAt("\\sin\\left(1\\right)", -1)).toBeNull();
    expect(functionAt("\\sin\\left(1\\right)", 99)).toBeNull();
    expect(functionAt("\\sin\\left(1\\right)", 1.5)).toBeNull();
  });
});
