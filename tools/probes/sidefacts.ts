// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (G328, F215): the facts a name set beside the result stores ((A:=5)*approx(1)), then what A*2 shows.
const A = new URL("../../app/src/engine/", import.meta.url).href;
const { EngineHost } = await import(A + "host.ts");
const { defaultHomeSettings } = await import(A + "homeEval.ts");
const { defaultCasSettings } = await import(A + "types.ts");
const { loadNodeGiac } = await import(A + "nodeGiac.ts");
for (const [mode, line] of [["home", "(A:=5)*approx(1)"], ["home", "(A:=5)*0.5"], ["home", "(A:=1/3)*approx(2)"], ["home", "A,B:=5,approx(2)"], ["cas", "(A:=5)*approx(1)"], ["home", "A:=5"]]) {
  const L = await loadNodeGiac(); const h = new EngineHost(L.giac, L.bridge);
  const out = mode === "cas" ? h.cas(line, defaultCasSettings) : h.home(line, defaultHomeSettings);
  console.log(mode, line, "=>", JSON.stringify(out.defs.flatMap((c) => ("set" in c ? [{ n: c.set.name, p: c.set.preview, m: c.set.mark, f: c.set.facts }] : []))));
  const r = h.home("A*2", defaultHomeSettings).result;
  console.log("   then A*2:", r.display, JSON.stringify(r.facts));
}
