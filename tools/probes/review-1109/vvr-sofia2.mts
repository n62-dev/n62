// SPDX-License-Identifier: GPL-3.0-or-later
// sofia, verifier of vr: a function named by a Greek letter, typed on the keys, in CAS and Home.
const W = new URL("../../../app/src/", import.meta.url).pathname;
const { EngineHost } = await import(W + "engine/host.ts");
const { loadNodeGiac } = await import(W + "engine/nodeGiac.ts");
const { defaultHomeSettings } = await import(W + "engine/homeEval.ts");
const { defaultCasSettings } = await import(W + "engine/types.ts");
const { latexToGiac } = await import(W + "input/latex-to-giac.ts");
const { giac, bridge } = await loadNodeGiac();
const h = new EngineHost(giac, bridge);
for (const l of ["f\\left(x\\right):=x+1", "\\alpha\\left(x\\right):=x+1", "\\gamma\\left(x\\right):=x+1", "\\gamma\\left(2\\right)", "e\\left(x\\right):=x+1"]) {
  let g = "";
  try { g = latexToGiac(l); } catch (e) { console.log(l, "PARSE ERROR", (e as Error).message); continue; }
  const c = h.cas(g, defaultCasSettings);
  console.log("CAS", l, "=>", g, JSON.stringify({ ok: c.result?.ok, error: c.result?.error, display: c.result?.display }), JSON.stringify(c.defs).slice(0, 120));
  const r = h.home(g, defaultHomeSettings);
  console.log("HOME", l, "=>", g, JSON.stringify({ ok: r.result?.ok, error: r.result?.error, display: r.result?.display }), JSON.stringify(r.defs).slice(0, 120));
}
process.exit(0);
