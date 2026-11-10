// SPDX-License-Identifier: GPL-3.0-or-later
// author probe: which Home path a limit at a jump takes; the exact text the step gets
import { EngineHost } from "../../../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings, toExactLiterals } from "../../../../app/src/engine/homeEval.ts";
import { defaultCasSettings } from "../../../../app/src/engine/types.ts";
import { latexToGiac } from "../../../../app/src/input/latex-to-giac.ts";
const { giac, bridge } = await loadNodeGiac();
const host = new EngineHost(giac, bridge);
const tex = ["\\lim_{x\\to1.5}\\left(\\operatorname{round}\\left(x\\right)\\right)", "\\lim_{x\\to1.0}\\left(\\operatorname{floor}\\left(x\\right)\\right)", "\\lim_{x\\to1.5}\\left(\\operatorname{floor}\\left(2x\\right)\\right)", "\\lim_{x\\to0.0}\\left(\\operatorname{sign}\\left(x\\right)\\right)", "\\lim_{x\\to0.5}\\left(x^2\\right)"];
for (const t of tex) {
  const g = latexToGiac(t);
  const r = (host.home(g, { ...defaultHomeSettings, angle: "rad" } as never) as { result: unknown }).result;
  console.log(JSON.stringify(g), "| exact:", toExactLiterals(g), "| path:", (r as { path?: string }).path, "| ok:", (r as { ok?: boolean }).ok, "| display:", (r as { display?: string; error?: string }).display ?? (r as { error?: string }).error);
}
for (const g of ["limit(round(x),x,1.5)", "limit(floor(x),x,1)", "limit(x^2,x,0.5)"]) {
  const r = host.cas(g, { ...defaultCasSettings, angle: "rad" } as never);
  console.log("CAS", g, JSON.stringify(r).slice(0, 300));
}
