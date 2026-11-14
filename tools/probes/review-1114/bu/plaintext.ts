// SPDX-License-Identifier: GPL-3.0-or-later
// bu hunt (night review 2026-11-14): clipboard/plaintext.ts entryText on the keypad's templates that R199's test does not
// hold (spec/keyboard.yaml: the list braces d8 line 277, Shift + 5's matrix line 311, Tmpl's matrix, piecewise and
// integral lines 488-522), and on the line a matrix grid's write puts in the history (R189/R190). entryText is what the
// work report (R130) writes as a step's Input, what Share session and a hold on a row's input copy (R276).
// Run: env -C <review worktree>/app npx tsx <this file>
import { entryText } from "../../../../app/src/clipboard/plaintext.ts";

const lines = [
  "\\left\\{1,2,3\\right\\}",
  "\\operatorname{stats1}\\left(\\left\\{1,2,3,4\\right\\}\\right)",
  "\\operatorname{linreg}\\left(\\left\\{1,2,3\\right\\},\\left\\{2,4,7\\right\\}\\right)",
  "\\begin{pmatrix}1 & 2\\\\ 3 & 4\\end{pmatrix}",
  "M:=\\begin{pmatrix}1&2\\\\9&4\\end{pmatrix}",
  "\\begin{cases}x & \\text{if }x=0\\\\ 1 & \\text{if }x=1\\end{cases}",
  "\\int_{-1}^{10}x^2\\,\\mathrm{d}x",
  "\\left|x\\right|",
];
for (const l of lines) console.log(`${l}\n    -> ${entryText(l)}`);
