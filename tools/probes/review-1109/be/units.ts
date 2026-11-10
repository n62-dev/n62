// SPDX-License-Identifier: GPL-3.0-or-later
// be hunt: many unit-view cases through buildJob and EngineHost.units in one engine, one line each.
//   FIND_INDEX_JSON=<index> npx tsx units.ts <file of lines: input | to | angle>
import { readFileSync } from "node:fs";
import { EngineHost } from "../../../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings, precisionFacts } from "../../../../app/src/engine/homeEval.ts";
import { markOf } from "../../../../app/src/engine/format.ts";
import { buildJob } from "../../../../app/src/units/build.ts";
import { factorTable } from "../../../../app/src/units/factors.ts";
import { isUnitError } from "../../../../app/src/units/types.ts";
import { requestOf } from "../../../../app/scripts/unit-case.ts";
const items = JSON.parse(readFileSync(process.env.FIND_INDEX_JSON!, "utf8"));
const table = factorTable(items);
const { giac, bridge } = await loadNodeGiac();
const host = new EngineHost(giac, bridge);
for (const line of readFileSync(process.argv[2]!, "utf8").split("\n")) {
  if (!line.trim() || line.startsWith("#")) continue;
  const [input, to, ang] = line.split("|").map((x) => x.trim());
  const angle = ang === "deg" ? "deg" : "rad";
  const s = { ...defaultHomeSettings, angle } as typeof defaultHomeSettings;
  try {
    const req = requestOf(input!, to || undefined, table);
    const job = buildJob(req, table);
    if (isUnitError(job)) { console.log(line, "=> JOBERR", JSON.stringify(job)); continue; }
    const r = host.units(job, s);
    if (isUnitError(r)) { console.log(line, "=> ERR", JSON.stringify(r)); continue; }
    const q = r;
    const m = markOf(precisionFacts(q.value), { format: "STD", digits: 12 });
    console.log(line, "=>", m?.mark ?? "(none)", m?.n ?? "", q.value.display, "|", q.unit, "| dim", q.dimension, q.unc ? "| unc " + q.unc.shown + " why " + (q.unc.why ?? "") : "", q.note ? "| note " + JSON.stringify(q.note) : "");
  } catch (e) { console.log(line, "=> THROW", (e as Error).message); }
}
