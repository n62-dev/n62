// SPDX-License-Identifier: GPL-3.0-or-later
// R185: the rows of a matrix as MathLive writes it (matgrow.ts rowCount); the growth itself is test/matgrow.spec.ts.
import { describe, expect, test } from "vitest";
import { rowCount } from "./matgrow.ts";

describe("rowCount", () => {
  test.each([
    ["\\begin{pmatrix}\\placeholder{}\\end{pmatrix}", 1],
    ["\\begin{pmatrix}1 & 2\\end{pmatrix}", 1],
    ["\\begin{pmatrix}1 & 2\\\\ 3 & 4\\end{pmatrix}", 2],
    ["\\begin{pmatrix}1 & 2 & \\\\ 3 & 4 & \\end{pmatrix}", 2],
    ["\\begin{pmatrix}1\\\\ 2\\\\ 3\\end{pmatrix}", 3],
    // a matrix in a cell: its rows are not the outer one's
    ["\\begin{pmatrix}\\begin{pmatrix}1\\\\ 2\\end{pmatrix} & 3\\end{pmatrix}", 1],
    // a brace pair and the list braces in a cell
    ["\\begin{pmatrix}\\frac{1}{2} & \\left\\{1,2\\right\\}\\\\ 3 & 4\\end{pmatrix}", 2],
  ])("%s has %i rows", (latex, n) => {
    expect(rowCount(latex)).toBe(n);
  });
});
