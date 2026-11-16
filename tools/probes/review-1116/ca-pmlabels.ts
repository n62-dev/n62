// SPDX-License-Identifier: GPL-3.0-or-later
// ca hunter probe (night review 2026-11-16): budget/rows.ts typedInputs (the uncertainty sheet's row labels, a second
// reader of ± over the LaTeX) against the parser's typed pasupm calls, on lines past rows.test.ts:181's five.
// Same comparison as that test: count, order and value of each typed input.
//   env -C <review>/app npx tsx <this file>
import { latexToGiacInfo } from "../../../app/src/input/latex-to-giac.ts";
import { slotFormula } from "../../../app/src/input/unitFormula.ts";
import { typedInputs } from "../../../app/src/budget/rows.ts";

const lines = [
  "\\left(-20\\pm0.5\\right)\\times\\left(3\\pm0.1\\right)", // control: rows.test.ts:184
  "\\frac{3\\pm0.1}{2}",
  "\\sqrt{4\\pm0.1}",
  "2^{1\\pm0.1}",
  "\\left(1+2\\right)\\pm0.1",
  "\\pi\\pm0.1",
  "2\\pi\\pm0.1",
  "3\\pm0.1\\times2\\pm0.2",
  ".5\\pm.1",
  "\\frac{1}{3\\pm0.1}",
  "\\left|-3\\pm0.1\\right|",
  "\\left|-3\\pm0.1\\right|\\,\\mathrm{m}",
  "2\\times\\left|-3\\pm0.1\\right|",
  "\\left(-3\\pm0.1\\right)\\,\\mathrm{m}",
  "2^{-3\\pm0.1}",
  "\\sqrt{-3\\pm0.1}",
  "-3\\pm0.1^{2}",
  "\\left(3\\pm0.1\\right)^{2}\\pm0.5",
  "\\sin\\left(-0.5\\pm0.1\\right)",
  "1-\\left(-2\\pm0.1\\right)",
  "3\\pm\\left(0.1\\right)",
  "\\frac{-3\\pm0.1}{2}",
  "2\\times\\frac{-3\\pm0.1}{2}",
  "\\left[1\\pm0.1,2\\pm0.2\\right]",
  "\\res{4}{7}\\pm0.1",
  "2\\times\\res{4}{7}\\pm0.1",
];
for (const line of lines) {
  let giac: string;
  try {
    giac = latexToGiacInfo(slotFormula(line).latex, { units: true, chips: { "res:4": { value: "7", exact: true } } }).giac;
  } catch (e) {
    console.log(`REFUSED  ${line}  (${(e as Error).message.slice(0, 60)})`);
    continue;
  }
  const typed = [...giac.matchAll(/pasupm\(([^,()]+|\([^()]*\)),([^,()]+|\([^()]*\))(?:,(\w+))?\)/g)]
    .filter((m) => m[3] === undefined || m[3].startsWith("pasws"))
    .map((m) => Number(m[1]!.replace(/[()]/g, "")));
  const all = (giac.match(/pasupm\(/g) ?? []).length;
  const labels = typedInputs(line, false);
  const vals = labels.map((l) => Number(l.split(" ± ")[0]!.replace("−", "-").replace("ᴇ", "e")));
  const same = JSON.stringify(vals) === JSON.stringify(typed) && all === typed.length;
  console.log(`${same ? "same" : "DIFF"}  ${line}\n      giac ${giac}\n      parser ${JSON.stringify(typed)} (pasupm calls ${all})  labels ${JSON.stringify(labels)}`);
}
