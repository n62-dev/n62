// SPDX-License-Identifier: GPL-3.0-or-later
// vca verifier probe (night review 2026-11-16): what the units-mode parser makes of a power typed on a σ, beside the
// number-with-ᴇ case the parser refuses for the same ambiguity (parse.ts putTheNumber).
//   env -C <review>/app npx tsx <this file>
import { latexToGiacInfo } from "../../../app/src/input/latex-to-giac.ts";
import { slotFormula } from "../../../app/src/input/unitFormula.ts";

const lines = [
  "3\\pm0.1^{2}",
  "-3\\pm0.1^{2}",
  "3\\pm0.1^{2}\\times2",
  "\\left(3\\pm0.1\\right)^{2}",
  "3\\pm0.1",
  "1.5\\emark3^{2}",
  "3\\pm1\\emark-2^{2}",
];
for (const line of lines) {
  const f = slotFormula(line).latex;
  try {
    console.log(`${line}\n   formula ${f}\n   giac    ${latexToGiacInfo(f, { units: true }).giac}`);
  } catch (e) {
    console.log(`${line}\n   formula ${f}\n   REFUSED ${(e as Error).message}`);
  }
}
