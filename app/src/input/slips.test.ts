// SPDX-License-Identifier: GPL-3.0-or-later
// R575 (F351): the commonest key slips get a message in plain words, never the parser's internals (\placeholder,
// \times, "unsupported command", "end of input" twice).
import { describe, expect, it } from "vitest";
import { parseLatex, parseLatexInfo } from "./parse.ts";

const message = (latex: string): string => {
  try {
    parseLatex(latex);
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error(`no error for ${latex}`);
};

const plain = (m: string): void => {
  expect(m).not.toMatch(/\\/);
  expect(m).not.toMatch(/placeholder/);
  expect(m).not.toMatch(/unsupported command/);
  expect(m.split("end of input").length).toBeLessThanOrEqual(2);
};

describe("key slips in plain words", () => {
  it.each([
    ["\\sin\\left(\\placeholder{}\\right)"], // sin Enter: the empty bracket
    ["2^{\\placeholder{}}"], // 2 xʸ Enter: the empty exponent
    ["\\frac{4}{\\placeholder{}}"], // 4 ÷ Enter: the empty denominator
    ["\\left(2+3\\right)\\left(\\placeholder{}\\right)"], // (2+3) ( ) Enter
    ["2\\placeholder{}"], // a box right after a value
  ])("an empty box: %s", (latex) => {
    const m = message(latex);
    plain(m);
    expect(m).toBe("fill the empty box");
  });

  it.each([
    ["2\\times\\times3", "×"],
    ["2+\\times3", "×"],
    ["\\times3", "×"],
    ["2\\div\\div3", "÷"],
    ["2\\cdot\\cdot3", "·"],
    ["2\\times+3", "+"],
    ["2+^{3}", "^"],
  ])("an operator where a value belongs: %s", (latex, sign) => {
    const m = message(latex);
    plain(m);
    expect(m).toBe(`${sign} needs a number or name before it`);
  });

  it.each([
    ["3+", "+"],
    ["3-", "−"],
    ["3\\times", "×"],
    ["3\\div", "÷"],
  ])("the line ends after an operator: %s", (latex, sign) => {
    const m = message(latex);
    plain(m);
    expect(m).toBe(`the line ends after ${sign}: something is missing`);
  });

  it("the line ends early elsewhere: one message, said once", () => {
    const m = message("\\frac{4}");
    plain(m);
    expect(m).toBe("the line ends too early: something is missing");
  });
});

describe("controls", () => {
  it("a pasted unknown command still says unsupported", () => {
    expect(message("\\foo")).toBe("unsupported command \\foo");
  });
  it("a unit slot in the unit view keeps its own meaning (R28)", () => {
    expect(parseLatexInfo("72\\placeholder[u1]{}", { units: true }).units?.slots).toEqual(["u1"]);
  });
  it("5−−2 is still a double minus", () => {
    expect(parseLatex("5--2")).toEqual(["Subtract", { num: "5" }, ["Negate", { num: "2" }]]);
  });
});
