// SPDX-License-Identifier: GPL-3.0-or-later
// G63: the view sweep as a gate stage (r16 Appendix B "Plot comparison"): expressions in x are asked for the same value from Home (x stored),
// CAS evalf, Num, the plot evaluator (against Giac's evalf(…, 20)), Solve (residual), Slope and Area (against Home's diff and int), each
// compared within the digits it claims (tools/probes/sweep/views.ts, viewrun.ts).
//   node scripts/viewsweep.ts                 # the gate stage: fixed seed, exit 1 on a new failure or a known one that now passes
//   node scripts/viewsweep.ts --nightly [--seed N] [--count N]   # rotating seed, more trees, report only (exit 0)
// G188: the engine runs in a worker thread; a call that traps it is a `crash` finding, one past its deadline a `hang` finding (id
// "<angle> <view and x> <keyboard LaTeX>"), and the sweep goes on with a fresh engine. Each engine's Giac calls go to a call log in
// VIEWSWEEP_LOG_DIR (default tools/probes/_out/viewsweep/<seed>, emptied first); a crashed or hung engine's log is kept (the finding
// names it), the others are deleted. Replay one: node ../tools/probes/sweep/replay.ts <log> (tools/probes/README.md).
// Known failures: tests/golden/viewsweep-known.yaml (id = "<angle> <x> <keyboard LaTeX>", check = num|cas|plot|slope|area|root|leak|crash|hang, package = the open backlog id).
// Environment: GIAC_OUT as for the golden gate; VIEWSWEEP_HOST (tests) a stand-in host module instead of Giac, VIEWSWEEP_HOST_ARG its argument (JSON).
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { invariantsStage } from "./invariants.ts";
import { loadViewKnown } from "./viewsweep-known.ts";
import { viewSweep } from "../../tools/probes/sweep/viewrun.ts";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const nightly = args.includes("--nightly");
const flag = (name: string): number | null => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? Number(args[i + 1]) : null;
};
const GATE_SEED = 20261022;
const seed = flag("--seed") ?? (nightly ? Math.floor(Date.now() / 86_400_000) : GATE_SEED);
const count = flag("--count") ?? (nightly ? 600 : 100);
const limits = nightly ? { roots: 200, slopes: 300, areas: 200 } : { roots: 12, slopes: 40, areas: 20 };
const t0 = performance.now();
const logDir = process.env["VIEWSWEEP_LOG_DIR"] ?? resolve(repo, "tools/probes/_out/viewsweep", String(seed));
const r = await viewSweep(seed, count, limits, { logDir, ...(process.env["VIEWSWEEP_HOST"] ? { host: process.env["VIEWSWEEP_HOST"], hostArg: JSON.parse(process.env["VIEWSWEEP_HOST_ARG"] ?? "null") as unknown } : {}) });
const secs = (performance.now() - t0) / 1000;
const stats = `${r.cases} expressions (seed ${seed}), ${r.compared} comparisons, total ${secs.toFixed(1)} s`;
const engines = `${r.restarts} engine restarts, heap up to ${(r.maxHeap / 2 ** 20).toFixed(0)} MB`;

if (nightly) {
  for (const f of r.failures) console.log(`FINDING ${f.id} [${f.check}]: ${f.detail}`);
  console.log(`VIEWSWEEP NIGHTLY: ${r.failures.length} findings; ${stats}; ${engines}`);
  process.exit(0);
}
const v = invariantsStage(r.failures, loadViewKnown(repo));
for (const l of v.lines) console.log(`  viewsweep ${l}`);
const ok = v.ok && secs < 30;
console.log(`${ok ? "VIEWSWEEP PASSED" : "VIEWSWEEP FAILED"}: ${stats}; ${v.summary}${secs < 30 ? "" : " (over 30 s)"}; ${engines}`);
process.exit(ok ? 0 : 1);
