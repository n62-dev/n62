// SPDX-License-Identifier: GPL-3.0-or-later
// vfh, night review 2026-11-09: the fh report's divider example through the real unit evaluator, and the row text of `±`.
//   GIAC_OUT=<dir> npx tsx <this file>
import { readFileSync } from "node:fs";
import { EngineHost } from "../../../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings } from "../../../../app/src/engine/homeEval.ts";
import { buildJob } from "../../../../app/src/units/build.ts";
import { factorTable } from "../../../../app/src/units/factors.ts";
import { unitErrorMessage } from "../../../../app/src/units/messages.ts";
import { isUnitError } from "../../../../app/src/units/types.ts";
import { requestOf } from "../../../../app/scripts/unit-case.ts";

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
const R = "pasupm(10,0.5)*{k:ohm}";
const CASES: [string, string, string | undefined][] = [
  ["literal, R2 typed twice (three independent inputs)", `12*{V}*${R}/(${R}+${R})`, undefined],
  ["each resistor once: 12/(1+R1/R2)", `12*{V}/(1+${R}/(${R}))`, undefined],
  ["10 +- 5 % kOhm", R, undefined],
];
for (const [label, input, to] of CASES) {
  try {
    const job = buildJob(requestOf(input, to, table), table);
    const q = isUnitError(job) ? job : host.units(job, { ...defaultHomeSettings });
    if (isUnitError(q)) { console.log(label, "| refused:", unitErrorMessage(q), `[${q.error}]`); continue; }
    console.log(label, "|", q.value.display, q.unit, q.unc ? `σ ${q.unc.text} (${q.unc.value.display})` : "no σ");
  } catch (e) {
    console.log(label, "| THROW", (e as Error).message.slice(0, 200));
  }
}
