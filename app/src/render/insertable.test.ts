// SPDX-License-Identifier: GPL-3.0-or-later
// L5: results put back on the entry line must parse to the same value (derived).
import { describe, expect, it } from "vitest";
import { latexToGiac } from "../input/latex-to-giac.ts";
import { exactMaths } from "./exactMaths.ts";
import { resultToEntry } from "./insertable.ts";
import { tidyGiacLatex } from "./tidy.ts";

const cases: [string, string, string][] = [
  // display latex, entry latex, Giac text our parser makes of it
  ["0.333333333333", "0.333333333333", "0.333333333333"],
  ["1.5\\times10^{-7}", "1.5\\times10^{-7}", "1.5*10^(-7)"],
  ["-2.5", "\\left(-2.5\\right)", "(-2.5)"], // R746: a leading minus is one term too: (−2.5)², 2·(−2.5)
  ["-\\frac{5}{6}", "\\left(-\\frac{5}{6}\\right)", "(-5/6)"],
  ["2+3\\mathrm{i}", "\\left(2+3\\imaginaryI\\right)", "(2+3*i)"],
  ["\\frac{1}{2}", "\\frac{1}{2}", "1/2"],
  ["x_{1}+2x_{2}", "\\left(x_{1}+2x_{2}\\right)", "(x_1+2*x_2)"],
  ["\\frac{\\mathrm{e}^{x}}{x}", "\\frac{\\exponentialE^{x}}{x}", "exp(x)/x"],
  ["2\\sqrt{2}", "2\\sqrt{2}", "2*sqrt(2)"],
  // R67: a CAS result drawn by tidy keeps the constant i, and the letters e and i stay the names e_ and i_
  [tidyGiacLatex("2+3*i"), "\\left(2+3\\imaginaryI\\right)", "(2+3*i)"],
  [tidyGiacLatex("\\mathrm{e\\_}\\cdot 2+e^{1}"), "\\left(e\\cdot 2+\\exponentialE^{1}\\right)", "(e_*2+exp(1))"],
  [tidyGiacLatex("\\mathrm{i\\_}\\cdot i"), "i\\imaginaryI", "i_*i"],
];

describe("resultToEntry", () => {
  for (const [display, entry, giac] of cases)
    it(display, () => {
      expect(resultToEntry(display)).toBe(entry);
      expect(latexToGiac(entry).replace(/\s/g, "")).toBe(giac);
    });
});

// R746: an exact result drawn as a fraction, root, power or matrix goes on the line as its maths; the drawn LaTeX
// (as the probe of 2026-11-19 read it from Session.display) must parse to the chip's exact value (derived).
const plain: [string, string, string][] = [
  // drawn, entry latex, Giac text our parser makes of it
  ["\\frac{5}{6}", "\\frac{5}{6}", "5/6"],
  ["-\\frac{5}{6}", "\\left(-\\frac{5}{6}\\right)", "(-5/6)"], // Home's fraction form
  ["\\frac{\\mathrm{-5}}{6}", "\\frac{-5}{6}", "(-5)/6"], // CAS
  ["\\frac{1}{300000000000000000000}", "\\frac{1}{300000000000000000000}", "1/300000000000000000000"],
  ["2\\sqrt{2}", "2\\sqrt{2}", "2*sqrt(2)"],
  ["\\mathrm{e}^{2}", "\\exponentialE^{2}", "exp(2)"],
  ["x^{2}+1", "\\left(x^{2}+1\\right)", "(x^2+1)"],
  ["\\frac{1+2\\mathrm{i}}{2}", "\\frac{1+2\\imaginaryI}{2}", "(1+2*i)/2"],
  ["\\begin{pmatrix}1 & 2 \\\\ 3 & 4\\end{pmatrix}", "\\begin{pmatrix}1 & 2 \\\\ 3 & 4\\end{pmatrix}", "[[1,2],[3,4]]"],
  [
    "\\begin{pmatrix}\\mathrm{-2} & 1 \\\\ \\frac{3}{2} & \\frac{\\mathrm{-1}}{2}\\end{pmatrix}",
    "\\begin{pmatrix}-2 & 1 \\\\ \\frac{3}{2} & \\frac{-1}{2}\\end{pmatrix}",
    "[[-2,1],[3/2,(-1)/2]]",
  ],
  // a CAS vector (Giac's latex([1/2,1/3]), latex([-1/2,sqrt(2)]), latex([x^2,1/2])): a bracket group the caret enters
  ["[\\frac{1}{2},\\frac{1}{3}]", "\\left[\\frac{1}{2},\\frac{1}{3}\\right]", "[1/2,1/3]"],
  ["[\\frac{\\mathrm{-1}}{2},\\sqrt{2}]", "\\left[\\frac{-1}{2},\\sqrt{2}\\right]", "[(-1)/2,sqrt(2)]"],
  ["[x^{2}-1,\\frac{1}{2}]", "\\left[x^{2}-1,\\frac{1}{2}\\right]", "[x^2-1,1/2]"],
  ["[1,2]", "\\left[1,2\\right]", "[1,2]"],
];
// a chip still: no structure, a rounded or mixed drawing, a name or anything outside the plain maths
const chip = ["5", "0.833333333333", "\\pi", "2\\frac{5}{6}", "-2\\frac{5}{6}", "\\frac{ab}{2}", "\\sqrt{\\mathrm{undef}}", "\\ln\\left(2\\right)^{2}", "[[1,2],[3,4]]", "\\frac{1}{2},\\frac{1}{3}", "[\\frac{1}{2},\\ln\\left(2\\right)]", "[1,]"];

describe("exactMaths", () => {
  for (const [drawn, entry, giac] of plain)
    it(drawn, () => {
      expect(exactMaths(drawn)).toBe(entry);
      expect(latexToGiac(entry).replace(/\s/g, "")).toBe(giac);
    });
  for (const drawn of chip) it(`${drawn} stays a chip`, () => expect(exactMaths(drawn)).toBeUndefined());
});
