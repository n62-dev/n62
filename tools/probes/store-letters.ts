// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (S53, docs/research/store-design.md): can every one-letter name a store sheet would offer take a value?
// For each letter, the keys' LaTeX `7/2 ▶ L` goes through our parser (as Store ▶ then the letter types it), then the
// engine host stores it in Home (or CAS) and reads `L*2` back; a second store over it (`5 ▶ L`) checks the overwrite.
//   node tools/probes/store-letters.ts            # Home, A-Z and a-z
//   MODE=cas node tools/probes/store-letters.ts   # the CAS view (one shared Giac context)
// Engine: $GIAC_MJS, else $GIAC_OUT/giac.mjs, else engine/giac/_out/gsl (app/src/engine/nodeGiac.ts).
import { EngineHost } from "../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings } from "../../app/src/engine/homeEval.ts";
import { defaultCasSettings } from "../../app/src/engine/types.ts";
import { latexToGiac } from "../../app/src/input/latex-to-giac.ts";

const cas = process.env.MODE === "cas";
const { giac, bridge } = await loadNodeGiac();
const host = new EngineHost(giac, bridge);
const run = (text: string): { ok: boolean; shown: string } => {
  if (cas) {
    const r = host.cas(text, defaultCasSettings).result;
    return { ok: r.ok, shown: r.ok ? r.text : `ERROR ${r.error}` };
  }
  const r = host.home(text, { ...defaultHomeSettings, workDigits: 30 }).result;
  return { ok: r.ok, shown: r.ok ? r.display : `ERROR ${r.error}` };
};
const toGiac = (latex: string): string => {
  try {
    return latexToGiac(latex);
  } catch (e) {
    return `PARSE ERROR ${(e as Error).message}`;
  }
};

const letters = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", ..."abcdefghijklmnopqrstuvwxyz"];
const bad: string[] = [];
for (const L of letters) {
  const store = toGiac(`\\frac{7}{2}\\blacktriangleright ${L}`);
  const s = store.startsWith("PARSE") ? { ok: false, shown: store } : run(store);
  const read = s.ok ? run(toGiac(`${L}\\times2`)) : { ok: false, shown: "-" };
  const over = s.ok ? run(toGiac(`5\\blacktriangleright ${L}`)) : { ok: false, shown: "-" };
  const back = over.ok ? run(toGiac(L)) : { ok: false, shown: "-" };
  const good = s.ok && read.ok && read.shown === "7" && over.ok && back.shown === "5";
  if (!good) bad.push(L);
  console.log(`${good ? "ok " : "BAD"} ${L}: ${JSON.stringify(store)} -> ${s.shown}; ${L}×2 -> ${read.shown}; 5▶${L} -> ${over.shown}; ${L} -> ${back.shown}`);
}
console.log(`${cas ? "CAS" : "Home"}: ${letters.length - bad.length}/${letters.length} letters store and read back${bad.length ? `; not: ${bad.join(" ")}` : ""}`);
