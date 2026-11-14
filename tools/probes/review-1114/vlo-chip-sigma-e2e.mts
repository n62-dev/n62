// SPDX-License-Identifier: GPL-3.0-or-later
// Verifier of lo-1 (night review 2026-11-14): end to end through the real EngineHost, as goldenRun.ts runSteps does it.
// Row 1: G (Find, 6.67430E-11 ± 0.00015E-11) × 5.972e24 × 70 / 6371000^2 at 12 digits. Its item (homeItem) and chip
// (chipOf, chipFactsOf) by the session's rule; row 2: that chip × 2. Prints both rows' display and facts.
// Run: GIAC_OUT=<abs> env -C <worktree>/app npx tsx <this file>
const W = new URL("../../../app/src/", import.meta.url).pathname;
const { EngineHost } = await import(W + "engine/host.ts");
const { loadNodeGiac } = await import(W + "engine/nodeGiac.ts");
const { defaultHomeSettings } = await import(W + "engine/homeEval.ts");
const { homeItem } = await import(W + "state/resultItem.ts");
const { chipOf, chipFactsOf } = await import(W + "state/results.ts");
const { giac, bridge } = await loadNodeGiac();
const h = new EngineHost(giac, bridge);
const s = { ...defaultHomeSettings, digits: 12 };
const consts = { G: { value: "6.67430E-11", unc: "0.00015E-11" } };
const r1 = h.home("pasc_G*5.972e24*70/6371000^2", s, consts).result;
console.log("row1", JSON.stringify({ ok: r1.ok, display: r1.display, facts: r1.facts }));
const item = homeItem(r1, true);
const chip = chipOf({ status: "done", ...item });
console.log("chip", JSON.stringify(chip));
const named = chipFactsOf({ c: chip! });
const r2 = h.home("pasr_1*2", s, undefined, { "1": named["c"]! }).result;
console.log("row2", JSON.stringify({ ok: r2.ok, display: r2.display, facts: r2.facts }));
