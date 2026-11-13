// SPDX-License-Identifier: GPL-3.0-or-later
// G306 probe: Home's display and mark for LaTeX entries (as the keys type them), RAD or DEG, and the median Enter time.
//   node tools/probes/g306/home.mts            # the G306 rows
//   TIMES=7 node tools/probes/g306/home.mts    # also the median of 7 Enters each (warm)
const W = new URL("../../../app/src", import.meta.url).pathname;
const { nodeHost } = await import(`${W}/engine/nodeGiac.ts`);
const { giacOfEntry } = await import(`${W}/input/entry.ts`);
const { defaultHomeSettings, precisionFacts } = await import(`${W}/engine/homeEval.ts`);
const { markOf } = await import(`${W}/engine/format.ts`);
const ROWS: [string, "rad" | "deg"][] = (process.argv.slice(2).length ? process.argv.slice(2).map((a) => (a.startsWith("deg:") ? [a.slice(4), "deg"] : [a, "rad"]) as [string, "rad" | "deg"]) : [
  ["\\sqrt[3]{\\pi-3.1415926535897932384626433832795028841971693993751}", "rad"],
  ["\\sqrt[3]{\\sin\\left(10^{70}\\right)}", "rad"],
  ["\\sqrt[5]{\\sin\\left(10^{70}\\right)}", "rad"],
  ["\\operatorname{atan2}\\left(\\sin\\left(10^{70}\\right),-1\\right)", "rad"],
  ["\\operatorname{atan2}\\left(\\sin\\left(10^{70}\\right),-1\\right)", "deg"],
  ["\\ln\\left(\\sin\\left(10^{70}\\right)^{2}\\right)", "rad"],
  ["\\log\\left(\\sin\\left(10^{70}\\right)^{2}\\right)", "rad"],
  ["\\log_{2}\\left(\\sin\\left(10^{70}\\right)^{2}\\right)", "rad"],
  ["\\ln\\left(\\sin\\left(10^{70}\\right)^{3}\\right)", "rad"],
  ["\\operatorname{sort}\\left(\\lbrace\\sin\\left(10^{70}\\right),0,\\cos\\left(10^{70}\\right)\\rbrace\\right)", "rad"],
]);
const h = await nodeHost();
const times = Number(process.env.TIMES ?? 0);
for (const [latex, angle] of ROWS) {
  const g = giacOfEntry(latex, "home").giac;
  const s = { ...defaultHomeSettings, digits: 12, angle };
  const r = h.home(g, s).result;
  const m = r.ok ? markOf(precisionFacts(r), { format: "STD", digits: 12 }) : null;
  let t = "";
  if (times) {
    const ms: number[] = [];
    for (let k = 0; k < times; k++) { const t0 = performance.now(); h.home(g, s); ms.push(performance.now() - t0); }
    ms.sort((a, b) => a - b);
    t = ` median ${ms[ms.length >> 1]!.toFixed(1)} ms`;
  }
  console.log(`${angle} ${g} => ${r.ok ? `${m ? m.mark + (m.n !== undefined ? ` ${m.n}` : "") : "(no mark)"} ${r.display}` : `error ${r.error}`}${t}`);
}
