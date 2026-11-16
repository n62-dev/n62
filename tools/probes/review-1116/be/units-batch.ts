// SPDX-License-Identifier: GPL-3.0-or-later
// be hunt (night review 2026-11-16): unit-view cases in one engine load, as tools/probes/unit-result.ts runs one.
// Each argument is `input` or `input => end slot`; app/scripts/unit-case.ts syntax ({k:m} a slot, pasupm(v,σ) a ± value).
//   GIAC_OUT=… FIND_INDEX_JSON=… node units-batch.ts '20*{oC}-10*{oC}' '20*{oC}-10*{oC} => oF'
import { readFileSync } from "node:fs";
const R = new URL("../../../..", import.meta.url).pathname.replace(/\/$/, "");
const { EngineHost } = await import(`${R}/app/src/engine/host.ts`);
const { loadNodeGiac } = await import(`${R}/app/src/engine/nodeGiac.ts`);
const { defaultHomeSettings, precisionFacts } = await import(`${R}/app/src/engine/homeEval.ts`);
const { markOf } = await import(`${R}/app/src/engine/format.ts`);
const { buildJob } = await import(`${R}/app/src/units/build.ts`);
const { factorTable } = await import(`${R}/app/src/units/factors.ts`);
const { unitErrorMessage, unitNoteText, unitWhyText } = await import(`${R}/app/src/units/messages.ts`);
const { isUnitError } = await import(`${R}/app/src/units/types.ts`);
const { requestOf } = await import(`${R}/app/scripts/unit-case.ts`);

const items = JSON.parse(readFileSync(process.env.FIND_INDEX_JSON!, "utf8"));
const table = factorTable(items);
const { giac, bridge } = await loadNodeGiac();
const host = new EngineHost(giac, bridge);
const s = { ...defaultHomeSettings, angle: process.env.ANGLE === "deg" ? "deg" : "rad" };
for (const arg of process.argv.slice(2)) {
  const [input, to] = arg.split(" => ").map((x) => x.trim());
  let job;
  try {
    job = buildJob(requestOf(input!, to, table), table);
  } catch (e) {
    console.log(`${arg}\n  THREW ${(e as Error).message}`);
    continue;
  }
  const q = isUnitError(job) ? job : host.units(job, s);
  if (isUnitError(q)) {
    console.log(`${arg}\n  refused: ${unitErrorMessage(q)}  [${q.error}]`);
    continue;
  }
  const mark = markOf(precisionFacts(q.value), { format: "STD", digits: 12 })?.mark ?? "?";
  const unc = q.unc ? `  σ ${q.unc.text}, shown "${q.unc.shown}"${q.unc.why ? ` ⚠ ${unitWhyText(q.unc.why)}` : ""}` : "";
  const note = q.note ? `  note: ${unitNoteText(q.note)}` : "";
  console.log(`${arg}\n  ${mark} ${q.value.display} ${q.unit}   dim ${q.dimension ?? "-"}   si ${q.si ?? "-"}   exact ${q.value.exact ?? "-"}${unc}${note}`);
}
