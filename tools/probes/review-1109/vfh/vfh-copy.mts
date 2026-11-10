// SPDX-License-Identifier: GPL-3.0-or-later
// vfh, night review 2026-11-09: what the Copy path writes for a unit row (fh-11's premise), through the real row builder.
//   GIAC_OUT=<dir> npx tsx <this file>
import { readFileSync } from "node:fs";
import { EngineHost } from "../../../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings } from "../../../../app/src/engine/homeEval.ts";
import { buildJob } from "../../../../app/src/units/build.ts";
import { factorTable } from "../../../../app/src/units/factors.ts";
import { isUnitError } from "../../../../app/src/units/types.ts";
import { requestOf } from "../../../../app/scripts/unit-case.ts";
import { unitRow } from "../../../../app/src/units/row.ts";
import { copyFull, sessionText } from "../../../../app/src/clipboard/text.ts";

const text = readFileSync(new URL("../../../../find/factors.yaml", import.meta.url).pathname, "utf8");
const items: unknown[] = [];
let section = "";
for (const line of text.split("\n")) {
  const h = /^(prefixes|units|constants):/.exec(line);
  if (h) { section = h[1]!; continue; }
  const m = /^  "([^"]+)": \{(.*)\}/.exec(line);
  if (!m) continue;
  const si = /\bsi: "([^"]*)"/.exec(m[2]!)?.[1];
  const dim = /\bdim: "([^"]*)"/.exec(m[2]!)?.[1];
  if (section === "prefixes") items.push({ kind: "pfx", id: `pfx:${m[1]}`, si, names: [m[1]] });
  if (section === "units") items.push({ kind: "unit", id: `unit:${m[1]}`, si, dim, names: [m[1]] });
}
const table = factorTable(items as never[]);
const { giac, bridge } = await loadNodeGiac();
const host = new EngineHost(giac, bridge);
for (const input of ["20*{m/s}", "pasupm(39.5,1.2)*{m^2}", "1/3*{m}"]) {
  const job = buildJob(requestOf(input, undefined, table), table);
  const q = isUnitError(job) ? job : host.units(job, { ...defaultHomeSettings });
  if (isUnitError(q)) { console.log(input, "refused", JSON.stringify(q)); continue; }
  const row = unitRow({ line: "x", chips: {}, q, slots: [], input: "x", digits: 12 } as never) as never;
  console.log(input, "| q.unit:", (q as { unit: string }).unit);
  console.log("  Copy (copyFull):", JSON.stringify(copyFull(row as never, {})));
  console.log("  units.text:", JSON.stringify((row as { units: { text: string } }).units.text));
  console.log("  Share session:", JSON.stringify(sessionText([{ ...(row as object), id: 1 } as never], {}, { format: "std", digits: 12, angle: "rad" } as never)));
}
