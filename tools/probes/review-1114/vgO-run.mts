// SPDX-License-Identifier: GPL-3.0-or-later
// vg hunter fork (night review 2026-11-14): run inputs through the real EngineHost (Home and CAS) and print the result.
// Usage: GIAC_OUT=<abs> npx tsx vgO-run.mts 'H:1+2' 'C:x^2' 'H*:...' (H/C = Home/CAS; a line starting with # is skipped)
// Inputs are Giac text (what latexToGiac emits); "L:" prefix = LaTeX through latexToGiac then Home.
const W = new URL("../../../app/src/", import.meta.url).pathname;
const { EngineHost } = await import(W + "engine/host.ts");
const { loadNodeGiac } = await import(W + "engine/nodeGiac.ts");
const { defaultHomeSettings, precisionFacts } = await import(W + "engine/homeEval.ts");
const { markOf } = await import(W + "engine/format.ts");
const { defaultCasSettings } = await import(W + "engine/types.ts");
const { latexToGiac } = await import(W + "input/latex-to-giac.ts");
const { giac, bridge } = await loadNodeGiac();
const h = new EngineHost(giac, bridge);
const extra = process.env["HOMESET"] ? JSON.parse(process.env["HOMESET"]) : {};
const hs = { ...defaultHomeSettings, ...extra };
const cs = { ...defaultCasSettings, ...(process.env["CASSET"] ? JSON.parse(process.env["CASSET"]) : {}) };
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith("#")) continue;
  const [k, ...rest] = arg.split(":");
  let input = rest.join(":");
  try {
    if (k === "L") input = latexToGiac(input);
    const r = k === "C" ? h.cas(input, cs) : h.home(input, hs);
    const res = r.result as any;
    const f = res.facts ?? res.numeric?.facts;
    let mk = "";
    try { const m = k === "C" ? null : markOf(precisionFacts(res), { format: "STD", digits: 12 }); mk = m ? `${m.mark}${m.n ?? ""}` : "(none)"; } catch (e) { mk = "markerr"; }
    console.log(`${k} ${input} => mark=${mk} items=${JSON.stringify(res.items?.map((x: any) => x.facts ?? x) ?? null)?.slice(0, 300)} ok=${res.ok} display=${JSON.stringify(res.display ?? res.text)} err=${res.error ?? ""} exact=${f?.exact} warn=${f?.warn ?? ""} why=${JSON.stringify(f?.why ?? {})}`);
  } catch (e) {
    console.log(`${k} ${input} => THROW ${(e as Error).message}`);
  }
}
