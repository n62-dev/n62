// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (night review 2026-11-16, fh): two app paths an engineer meets daily, run on the review worktree's code.
// 1. Solve's Num value line (apps/solve/app.svelte.ts:161) takes a known only through plainNumber (apps/decimal.ts:29):
//    which typed knowns does it take, which become "Not a number"?
// 2. Function's Plot draws a slot only when compileDefinition (apps/function/compile.ts) gives a JS evaluator `fn`
//    (FunctionPlot.svelte:88 skips the slot otherwise): which definitions get none?
//   env -C <review>/app npx tsx <this>
import { plainNumber } from "../../../app/src/apps/decimal.ts";
import { compileDefinition } from "../../../app/src/apps/function/compile.ts";

const knowns = ["50", "4.7\\times10^{3}", "4.7\\emark3", "-0.25", "2\\pi\\cdot50", "\\frac{1}{3}", "\\sqrt{2}", "R", "\\operatorname{Ans}", "1/3", "2*50"];
for (const k of knowns) console.log(`solve known ${JSON.stringify(k).padEnd(30)} -> ${plainNumber(k) ?? "REFUSED (Not a number)"}`);

const defs = ["x^{2}", "A\\cdot x^{2}", "Ax^{2}", "\\sin\\left(x\\right)", "\\pi x", "R\\cdot x", "f\\left(x\\right)", "\\operatorname{abs}\\left(x\\right)"];
for (const d of defs) {
  const c = compileDefinition(d);
  console.log(`function def ${JSON.stringify(d).padEnd(36)} -> giac ${JSON.stringify(c.giac)} drawn: ${c.fn ? "yes" : "NO"}${c.error ? ` error ${c.error}` : ""}`);
}
