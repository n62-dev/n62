// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (R286, F218): σ's confirmed digits against the value's: a unit row ± a 3-digit σ chip, its chip in Home and twice in the unit view.
const A = new URL("../../app/src/", import.meta.url).href;
const { EngineHost } = await import(A + "engine/host.ts");
const { defaultHomeSettings, precisionFacts } = await import(A + "engine/homeEval.ts");
const { markOf } = await import(A + "engine/format.ts");
const { loadNodeGiac } = await import(A + "engine/nodeGiac.ts");
const { sigmaChipOf, uncChipsIn } = await import(A + "input/chipUnit.ts");
const { latexToGiacInfo } = await import(A + "input/latex-to-giac.ts");
const { chipFactsOf } = await import(A + "state/results.ts");
const { buildJob } = await import(A + "units/build.ts");
const { quantityChip } = await import(A + "units/chip.ts");
const { factorTable } = await import(A + "units/factors.ts");
const { shownOf } = await import(A + "units/result.ts");
const { isUnitError } = await import(A + "units/types.ts");
const L = await loadNodeGiac();
const host = new EngineHost(L.giac, L.bridge);
const M = { tokens: [{ unit: "m" }] };
const TABLE = factorTable([{ id: "unit:m", kind: "unit", names: ["m"], title: "m", si: "1", dim: "m1", tier: 0, insert: "" }]);
const FEW = { value: "0.0707106781187", exact: false, reliableDigits: 3 };
function request(latex, chips, slots) {
  const r = latexToGiacInfo(latex, { units: true, chips });
  const sigmas = r.units?.sigmas?.map((c) => sigmaChipOf(chips[c.key], c.slot));
  const uncChips = uncChipsIn(latex, chips);
  return { formula: r.giac, slots, ...(sigmas ? { sigmas } : {}), ...(uncChips.length ? { uncChips } : {}) };
}
const units = (latex, chips) => { const job = buildJob(request(latex, chips, [M]), TABLE); if (isUnitError(job)) throw new Error(JSON.stringify(job)); return host.units(job, defaultHomeSettings); };
const o = { format: "STD", digits: 12 };
for (const v of ["10.1", "1000.5", "123456.25"]) {
  const q = units(`${v}\\pm\\res{3}{0.0707}\\placeholder[u1]{}`, { "res:3": FEW });
  const s = shownOf(q, o);
  console.log("view", v, "± FEW:", s.markText, s.text);
  const chip = quantityChip(q);
  console.log("  chip", JSON.stringify(chip));
  const home = host.home("pasr_7*2", defaultHomeSettings, undefined, chipFactsOf({ "7": chip })).result;
  console.log("  Home chip*2:", home.display, JSON.stringify(markOf(precisionFacts(home), o)), home.facts.uncSigma);
  const again = units(`2\\times\\res{7}{${v}}\\placeholder[u1]{}`, { "res:7": chip });
  const s2 = shownOf(again, o);
  console.log("  view 2×chip:", s2.markText, s2.text);
}
