// SPDX-License-Identifier: GPL-3.0-or-later
// sofia, verifier of vr (night review 2026-11-09): the real paths for vr-1 and vr-2, from the LaTeX the keys type.
const W = new URL("../../../app/src/", import.meta.url).pathname;
const { EngineHost } = await import(W + "engine/host.ts");
const { loadNodeGiac } = await import(W + "engine/nodeGiac.ts");
const { applyDefChanges } = await import(W + "engine/defs.ts");
const { defaultHomeSettings } = await import(W + "engine/homeEval.ts");
const { defaultCasSettings } = await import(W + "engine/types.ts");
const { exportLibrary, parseLibrary, importText } = await import(W + "engine/library.ts");
const { LIBRARY_FORMAT } = await import(W + "state/libraryFormat.ts");
const { latexToGiac } = await import(W + "input/latex-to-giac.ts");
const { buildJob } = await import(W + "units/build.ts");
const { factorTable } = await import(W + "units/factors.ts");
const { shownOf } = await import(W + "units/result.ts");

const { giac, bridge } = await loadNodeGiac();
const h = new EngineHost(giac, bridge);
let log: any[] = [];

// what the keys type, Home first, then the CAS view
const home = ["2\\blacktriangleright\\beta", "3\\blacktriangleright e", "5\\blacktriangleright A"];
const cas = ["\\gamma\\left(x\\right):=x+1", "\\Gamma:=7"];
for (const l of home) {
  const g = latexToGiac(l);
  const r = h.home(g, defaultHomeSettings);
  console.log("HOME", l, "=>", g, "ok", JSON.stringify(r.result?.ok ?? r.result?.display), JSON.stringify(r.defs));
  log = applyDefChanges(log, r.defs);
}
for (const l of cas) {
  try {
    const g = latexToGiac(l);
    const r = h.cas(g, defaultCasSettings);
    console.log("CAS", l, "=>", g, JSON.stringify(r.result?.ok), JSON.stringify(r.defs));
    log = applyDefChanges(log, r.defs);
  } catch (e) { console.log("CAS", l, "ERROR", (e as Error).message); }
}
const out = exportLibrary(log, LIBRARY_FORMAT);
console.log("--- EXPORT\n" + out.text + "--- SKIPPED " + JSON.stringify(out.skipped));
try {
  const lib = parseLibrary(out.text, h.parse, LIBRARY_FORMAT);
  console.log("READ BACK", lib.defs.map((d: any) => d.name));
} catch (e) { console.log("REFUSED:", (e as Error).message); }
const reply = importText(h, out.text, LIBRARY_FORMAT.version, log, true);
console.log("IMPORT REPLY", JSON.stringify(reply.result).slice(0, 300));

// the control: the same log without the stand-in names
const ascii = log.filter((e) => !e.name.endsWith("_"));
const a = exportLibrary(ascii, LIBRARY_FORMAT);
try { console.log("CONTROL READ BACK", parseLibrary(a.text, h.parse, LIBRARY_FORMAT).defs.map((d: any) => d.name)); }
catch (e) { console.log("CONTROL REFUSED:", (e as Error).message); }

// vr-2: the note, from the same store
const item = (kind: string, id: string, x: Record<string, string>): any => ({ id: `${kind}:${id}`, kind, names: [id], title: id, tier: 0, insert: "", ...x });
const TABLE = factorTable([item("unit", "A", { dim: "A1", si: "1" })]);
const A = { tokens: [{ unit: "A" }] };
for (const f of ["beta_*3*pasu1", "e_*3*pasu1", "A*3*pasu1"]) {
  const job = buildJob({ formula: f, slots: [A] }, TABLE);
  const q = h.units(job, defaultHomeSettings);
  const s: any = shownOf(q, { format: "STD", digits: 12 });
  console.log("UNITS", f, "display", q.value?.display, "unit", q.unit, "names", JSON.stringify(q.names), "note", JSON.stringify(s.names), "error", q.error);
}
process.exit(0);
