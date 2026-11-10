// SPDX-License-Identifier: GPL-3.0-or-later
// vr probe: a library export of a user name that is a Greek letter Giac keeps (beta_), read back by parseLibrary.
const W = new URL("../../../app/src/", import.meta.url).pathname;
const { EngineHost } = await import(W + "engine/host.ts");
const { loadNodeGiac } = await import(W + "engine/nodeGiac.ts");
const { applyDefChanges } = await import(W + "engine/defs.ts");
const { defaultCasSettings } = await import(W + "engine/types.ts");
const { exportLibrary, parseLibrary } = await import(W + "engine/library.ts");
const { giac, bridge } = await loadNodeGiac();
const h = new EngineHost(giac, bridge);
let log: any[] = [];
for (const c of ["beta_:=5", "a1:=7", "gamma_(x):=x+1"]) {
  const r = h.cas(c, defaultCasSettings);
  console.log(c, "->", JSON.stringify(r.result?.ok), JSON.stringify(r.defs));
  log = applyDefChanges(log, r.defs);
}
const fmt = { version: 99, migrate: (t: string) => t };
const out = exportLibrary(log, fmt);
console.log(out.text, JSON.stringify(out.skipped));
try { const lib = parseLibrary(out.text, (t: string) => bridge.parse(t), fmt); console.log("read back", lib.defs.map((d: any) => d.name)); }
catch (e: any) { console.log("REFUSED:", e.message); }
