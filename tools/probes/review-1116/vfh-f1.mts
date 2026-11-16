// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (night review 2026-11-16, verifier of fh, fh-7): Home's parse of a typed F1(2.5) with F stored as a value, and
// what the engine answers for it. Expected (derived): 10*1*2.5 = 25 if read as a product; F1(2.5) of x^2+1 would be 7.25.
//   env -C <review>/app GIAC_OUT=… npx tsx <this>
import { latexToGiacInfo } from "../../../app/src/input/latex-to-giac.ts";
import { EngineHost } from "../../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings } from "../../../app/src/engine/homeEval.ts";

const { giac, bridge } = await loadNodeGiac();
const host = new EngineHost(giac, bridge);
const s = { ...defaultHomeSettings };
for (const l of ["F1\\left(2.5\\right)", "F1(2.5)"]) {
  const before = latexToGiacInfo(l, {}).giac;
  const withF = latexToGiacInfo(l, { userValues: new Set(["F"]) }).giac;
  console.log(JSON.stringify(l), "no F:", JSON.stringify(before), " F stored:", JSON.stringify(withF));
}
console.log("F unset, F*1*(2.5) ->", host.home("F*1*(2.5)", s).result.display);
console.log("Home F:=10 ->", host.home("F:=10", s).result.display);
const r = host.home(latexToGiacInfo("F1\\left(2.5\\right)", { userValues: new Set(["F"]) }).giac, s).result;
console.log("F1(2.5) with F=10 ->", r.display, JSON.stringify(r.facts));
