// SPDX-License-Identifier: GPL-3.0-or-later
// be hunt: inputs (LaTeX as the keys write it, or giac: raw Giac text) through EngineHost.home or .cas, one line each.
//   npx tsx home.ts <file of lines: angle ;; tex-or-giac:text [;; expected]>   (MODE=cas for CAS)
import { readFileSync } from "node:fs";
import { EngineHost } from "../../../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings, precisionFacts } from "../../../../app/src/engine/homeEval.ts";
import { defaultCasSettings } from "../../../../app/src/engine/types.ts";
import { markOf } from "../../../../app/src/engine/format.ts";
import { latexToGiac } from "../../../../app/src/input/latex-to-giac.ts";
const mode = process.env.MODE ?? "home";
const digits = Number(process.env.DIGITS ?? 12);
const { giac, bridge } = await loadNodeGiac();
const host = new EngineHost(giac, bridge);
for (const line of readFileSync(process.argv[2]!, "utf8").split("\n")) {
  if (!line.trim() || line.startsWith("#")) continue;
  const [a, t, exp] = line.split(";;").map((x) => x.trim());
  const angle = a === "deg" ? "deg" : "rad";
  let gt = "";
  try { gt = t!.startsWith("giac:") ? t!.slice(5) : latexToGiac(t!); } catch (e) { console.log(a, t, "=> PARSE", (e as Error).message); continue; }
  try {
    if (mode === "cas") {
      const r = host.cas(gt, { ...defaultCasSettings, digits, angle }).result;
      console.log(a, "|", t, "|", gt.slice(0, 80), "=>", r.ok ? r.text : "ERR " + r.error, r.approximate ? "(approx)" : "", exp ? "| exp " + exp : "");
    } else {
      const r = host.home(gt, { ...defaultHomeSettings, digits, angle, workDigits: Math.max(30, digits + 10) }).result;
      const m = r.ok && (r.value || r.items) ? markOf(precisionFacts(r), { format: "STD", digits }) : null;
      console.log(a, "|", t, "=>", m ? m.mark + (m.n ?? "") : (r.ok ? "(nomark)" : "ERR"), r.display, r.error ? "[" + r.error + "]" : "", exp ? "| exp " + exp : "");
    }
  } catch (e) { console.log(a, t, "=> THROW", (e as Error).message); }
}
