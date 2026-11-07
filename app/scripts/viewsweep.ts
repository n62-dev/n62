// SPDX-License-Identifier: GPL-3.0-or-later
// G63: the view sweep as a gate stage (r16 Appendix B "Plot comparison"): expressions in x are asked for the same value from Home (x stored),
// CAS evalf, Num, the plot evaluator (against Giac's evalf(…, 20)), Solve (residual), Slope and Area (against Home's diff and int), each
// compared within the digits it claims (tools/probes/sweep/views.ts, viewrun.ts).
//   node scripts/viewsweep.ts                 # the gate stage: fixed seed, exit 1 on a new failure or a known one that now passes
//   node scripts/viewsweep.ts --nightly [--seed N] [--count N]   # rotating seed, more trees, report only (exit 0)
//   In pieces (G188; each under `tools/devlock.sh slice <name> …`, at most 10 minutes; count 300 takes longer):
//     node scripts/viewsweep.ts --nightly --seed N --count N --part i/n   # the i-th of n slices of the expressions, in a fresh engine;
//       its result goes to .tasks/viewsweep-part-<seed>-<count>-<i>of<n>.json (VIEWSWEEP_TASKS_DIR: another folder)
//     node scripts/viewsweep.ts --join --seed N --count N                 # every part of that run (a missing one is named, exit 1): the findings and the summary line
// G188: the engine runs in a worker thread; a call that traps it is a `crash` finding, one past its deadline a `hang` finding (id
// "<angle> <view and x> <keyboard LaTeX>"), and the sweep goes on with a fresh engine. Each engine's Giac calls go to a call log in
// VIEWSWEEP_LOG_DIR (default tools/probes/_out/viewsweep/<seed>, emptied first); a crashed or hung engine's log is kept (the finding
// names it), the others are deleted. Replay one: node ../tools/probes/sweep/replay.ts <log> (tools/probes/README.md).
// Known failures: tests/golden/viewsweep-known.yaml (id = "<angle> <x> <keyboard LaTeX>", check = num|cas|plot|slope|area|root|leak|crash|hang, package = the open backlog id).
// Environment: GIAC_OUT as for the golden gate; VIEWSWEEP_HOST (tests) a stand-in host module instead of Giac, VIEWSWEEP_HOST_ARG its argument (JSON).
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { invariantsStage } from "./invariants.ts";
import { parsePart } from "./sweep-parts.ts";
import { loadViewKnown } from "./viewsweep-known.ts";
import { joinViewParts, readViewParts, writeViewPart } from "./viewsweep-parts.ts";
import { viewSweep, type ViewSweepResult } from "../../tools/probes/sweep/viewrun.ts";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const mainCheckout = ((): string => {
  const common = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: repo, encoding: "utf8" }).stdout.trim();
  return common ? resolve(common, "..") : repo;
})();
const args = process.argv.slice(2);
const join = args.includes("--join");
const nightly = args.includes("--nightly") || join;
const part = args.includes("--part") ? parsePart(args[args.indexOf("--part") + 1]) : null;
const tasksDir = process.env["VIEWSWEEP_TASKS_DIR"] ?? resolve(mainCheckout, ".tasks");
const flag = (name: string): number | null => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? Number(args[i + 1]) : null;
};
const GATE_SEED = 20261022;
const seed = flag("--seed") ?? (nightly ? Math.floor(Date.now() / 86_400_000) : GATE_SEED);
const count = flag("--count") ?? (nightly ? 600 : 100);
if (args.includes("--part") && !part) {
  console.error("--part wants i/n with 1 <= i <= n");
  process.exit(2);
}
if (part && !args.includes("--nightly")) {
  console.error("--part needs --nightly");
  process.exit(2);
}
if ((part || join) && flag("--seed") === null) {
  console.error("--part and --join need an explicit --seed (every part must sweep the same expressions)");
  process.exit(2);
}
const limits = nightly ? { roots: 200, slopes: 300, areas: 200 } : { roots: 12, slopes: 40, areas: 20 };
const statsOf = (r: ViewSweepResult, secs: number): { stats: string; engines: string } => ({
  stats: `${r.cases} expressions (seed ${seed}), ${r.compared} comparisons, total ${secs.toFixed(1)} s`,
  engines: `${r.restarts} engine restarts, ${r.calls} Giac calls, heap up to ${(r.maxHeap / 2 ** 20).toFixed(0)} MB`,
});
const reportNightly = (r: ViewSweepResult, secs: number, parts = ""): never => {
  const { stats, engines } = statsOf(r, secs);
  for (const f of r.failures) console.log(`FINDING ${f.id} [${f.check}]: ${f.detail}`);
  console.log(`VIEWSWEEP NIGHTLY: ${r.failures.length} findings; ${stats}; ${engines}${parts}`);
  return process.exit(0);
};
if (join) {
  const got = readViewParts(tasksDir, seed, count);
  if (!got.ok) {
    console.error(`VIEWSWEEP JOIN: ${got.message}`);
    process.exit(1);
  }
  const j = joinViewParts(got.files);
  reportNightly(j, j.secs, `; ${got.files.length} parts (a fresh engine each: ${got.files.map((f) => f.calls).join(", ")} Giac calls)`);
}

const t0 = performance.now();
const logDir = process.env["VIEWSWEEP_LOG_DIR"] ?? resolve(repo, "tools/probes/_out/viewsweep", part ? `${seed}-${part.i}of${part.n}` : String(seed));
const r = await viewSweep(seed, count, limits, {
  logDir,
  ...(part ? { part } : {}),
  ...(nightly ? { onFailed: (f) => console.error(`ENGINE ${f.check.toUpperCase()} ${f.id}: ${f.detail}`) } : {}),
  ...(process.env["VIEWSWEEP_HOST"] ? { host: process.env["VIEWSWEEP_HOST"], hostArg: JSON.parse(process.env["VIEWSWEEP_HOST_ARG"] ?? "null") as unknown } : {}),
});
const secs = (performance.now() - t0) / 1000;
const { stats, engines } = statsOf(r, secs);

if (part) {
  const out = writeViewPart(tasksDir, { ...r, seed, count, part: part.i, of: part.n, secs });
  console.log(`VIEWSWEEP PART ${part.i}/${part.n}: ${r.failures.length} findings; ${stats}; ${engines}; ${out}`);
  process.exit(0);
}
if (nightly) reportNightly(r, secs);
const v = invariantsStage(r.failures, loadViewKnown(repo));
for (const l of v.lines) console.log(`  viewsweep ${l}`);
const ok = v.ok && secs < 30;
console.log(`${ok ? "VIEWSWEEP PASSED" : "VIEWSWEEP FAILED"}: ${stats}; ${v.summary}${secs < 30 ? "" : " (over 30 s)"}; ${engines}`);
process.exit(ok ? 0 : 1);
