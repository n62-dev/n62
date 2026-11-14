// SPDX-License-Identifier: GPL-3.0-or-later
// vvr (verifier of vr): vr-2, a store into a Giac reserved word through the store sheet's \operatorname{name}, in Home.
import { EngineHost } from "../../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings } from "../../../app/src/engine/homeEval.ts";
import { latexToGiac } from "../../../app/src/input/latex-to-giac.ts";
const { giac, bridge } = await loadNodeGiac();
const host = new EngineHost(giac, bridge);
const home = (t: string): string => { const r = host.home(t, { ...defaultHomeSettings }).result; return JSON.stringify(r).slice(0, 300); };
for (const n of ["mean", "size", "rate"]) {
  let g: string; try { g = latexToGiac(`5\\blacktriangleright\\operatorname{${n}}`, { userValues: new Set([n]) }); } catch (e) { g = "PARSE " + (e as Error).message; }
  console.log(n, "giac:", g, "| Home:", g.startsWith("PARSE") ? "-" : home(g));
}
console.log("mean([1,2,3]) after:", home("mean([1,2,3])"));
console.log("rate after:", home("rate"));
