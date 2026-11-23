// SPDX-License-Identifier: GPL-3.0-or-later
// G82 (A20): a result must not depend on the speed of the device. Every home.yaml and precision.yaml case runs on the
// desktop twice: on the real clock and on a clock that runs SLOW× fast, which is how a device SLOW× slower looks to every
// budget (Giac's `timeout` reads performance.now through emscripten_get_now; Home's own deadlines, HOME_DEADLINE_MS, the
// WALK_BUDGET_MS of nonsquare.ts and novalue.ts and EXTRA_BUDGET_MS of numeric.ts, read performance.now and Date.now).
// Display, mark and copy text must agree; a case that still differs is in SPEED_KNOWN with its reason (decisions.md).
// A `status: pending` case is listed when it differs, never failed (as golden/precision.ts treats it): its fix makes it active.
//   GIAC_OUT=<dir> node scripts/golden-speed.ts      # SLOW=8 (default; the Tab One is 5-8× slower than the desktop); also the golden gate's stage `steps`
//   ONLY=a20 GIAC_OUT=<dir> node scripts/golden-speed.ts   # A20's cases only
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse } from "yaml";
import { EngineHost } from "../src/engine/host.ts";
import { pasdegCommand } from "../src/engine/homeEval.ts";
import { giacMjsPath, loadNodeGiac } from "../src/engine/nodeGiac.ts";
import { goldenRecords, typed, type Case } from "../src/goldenRun.ts";
import { compareGolden, describe, type Finding } from "./golden-compare.ts";

/** A20's findings (decisions.md, the A20 entry), by stage and case id. */
export const A20_CASES: { home: readonly string[]; precision: readonly string[] } = {
  home: ["sum-1.1^k-500", "fn-int-sinx/x", "g39-int-tan-plus-x", "g44f2-seq-normald_icdf-1e-30-x3", "rad-asin0.5"],
  precision: [
    "prec-2-normald_icdf-value", "prec-g44-normald_icdf-1e-10-30", "prec-g44-normald_icdf-1-1e-12-12", "prec-g44-normald_icdf-1-1e-12-30",
    "prec-g44-chisquare_icdf-3-0.95-12", "prec-g44-chisquare_icdf-3-0.95-30", "prec-g44f1-fisher_icdf-3-4-1-1e-20-12",
    "prec-g44f1-fisher_icdf-3-4-1-1e-20-30", "prec-g44f2-chisquare_icdf-3-1-1e-30-12", "prec-g44f2-chisquare_icdf-3-1-1e-30-30",
    "prec-g44f2f1-chisquare_icdf-3-0.9-12", "prec-g44f2f1-chisquare_icdf-1-0.95-12", "prec-g44-student_icdf-5-0.975-30",
  ],
};

/** Runs `fn` with performance.now and Date.now running `k`× fast (continuous at the switch), then puts them back. */
export async function withFastClock<T>(k: number, fn: () => Promise<T>): Promise<T> {
  const perf = performance.now.bind(performance);
  const date = Date.now;
  const p0 = perf();
  const d0 = date();
  performance.now = () => p0 + (perf() - p0) * k;
  Date.now = () => Math.round(d0 + (date() - d0) * k);
  try {
    return await fn();
  } finally {
    performance.now = perf;
    Date.now = date;
  }
}

/** Cases that still differ between the real clock and one 8× fast, by stage/id, with the limit that makes them differ
 *  (decisions.md, Needs the user, "Home's clocks after G82"). They are listed by the gate, never hidden; a new one fails. */
export const SPEED_KNOWN: Record<string, string> = {
  // factorial(10^6): one GMP call of 1.0 s that never looks at the interrupt; 8× slower it passes HOME_DEADLINE_MS (2 s)
  "precision/g58-factorial-1e6-12": "HOME_DEADLINE_MS",
  "precision/g58-factorial-1e6-30": "HOME_DEADLINE_MS",
  // int((cosh(x))^tanh(x),x,0,1) (G188, patch 0037): Giac's numeric integral is one call of 444 ms (229,554 checks, step-budget.ts);
  // 8× slower it passes HOME_CLOCK_S (1.5 s), so the Tab One shows the time-out where the desktop shows ⚠ 1.10413519221
  "precision/g188-int-cosh-pow-tanh": "HOME_CLOCK_S",
  // G186 (F145, hangs before patch 0040): Giac's exact path is one call of 186 ms (the exact modulus of cos(pi/10^7)+acosh(10^-300))
  // and of 461 ms (DEG: Giac's cos of pi/180*i*tan(…) of acosh(10^-1000)'s 4 kB form, 15,302 checks; RAD's cos(i*tan(…)) takes 1 ms);
  // 8× slower they pass HOME_CLOCK_S (1.5 s): the Tab One shows the time-out (abs) and the float path's No value found (DEG, where the
  // desktop shows Overflow)
  "precision/g186-abs-cos-acosh-1e-300-30": "HOME_CLOCK_S",
  "precision/g186-deg-cos-tanh-acosh-1e-1000-12": "HOME_CLOCK_S",
  // its RAD row, the same Giac text: Home's exact path is 33-55 ms on a quiet host (5 fresh engines, key-e466fa36e786613f,
  // 2026-11-22) and keeps Overflow up to a clock ×40, No value found from ×48 on (3 fresh engines each); so at ×8 it differs
  // only on a host 5-6× slower than quiet, under the load of other runs' checks (runs 1054 and 1475)
  "precision/g186-cos-tanh-acosh-1e-1000-12": "HOME_CLOCK_S",
  // G340 (F228, patch 0045): normal and simplify of sqrt(2^(1/3)+3^(2/3)) are one Giac call of 171-225 ms (about 98,800
  // checks, step-budget.ts BUDGET=home, 2026-11-13), the degree-18 rootof of the nested root; 8× slower that is 1.4-1.8 s
  // against HOME_CLOCK_S (1.5 s), so under load the Tab One shows the time-out (normal) or the input back (simplify)
  "home/g340-normal-sqrt-cbrt2-plus-cbrt9": "HOME_CLOCK_S",
  "home/g340-simplify-sqrt-cbrt2-plus-cbrt9": "HOME_CLOCK_S",
  // their 2^(1/4) rows: normal and simplify of sqrt(1+sqrt(1+2^(1/4))) take 127-136 ms on a quiet host (exactMs, median of 7
  // fresh engines, key-81219a110c1c4e19, 2026-11-16) and 151-273 ms under load 32, the degree-16 rootof: 1.0-2.2 s 8× slower, the same
  // way past the clock
  "home/g340-normal-sqrt-root4-2": "HOME_CLOCK_S",
  "home/g340-simplify-sqrt-root4-2": "HOME_CLOCK_S",
  // G331 (F214, patch 0047): Home's exact path of evalf(simplify(sqrt(ln(1+sqrt(1+2^(1/3)))))) is one Giac simplify of
  // 164-239 ms (exactMs, median 168 of 7 fresh engines, key-81219a110c1c4e19, 2026-11-16; 285 ms under load), the degree-6 rootof
  // under ln; 8× slower that is 1.3-2.3 s
  // against HOME_CLOCK_S (1.5 s): in time it shows ⚠ 12 0.957920253119 (simplify unaudited, its double and P agree to 12
  // digits), past it the float path's ⚠ 0.957920253118554998403493714904; both are the oracle's digits
  "precision/g331-evalf-simplify-sqrt-ln-nested-root-30": "HOME_CLOCK_S",
  // G331 (F214): simplify of asinh(surd(1/2,3))^… is a Home case of 250 ms on a quiet host (5 fresh engines each,
  // key-4361f213c1035daa, 2026-11-22); it keeps Underflow at a clock ×8 and stops (took too long, ≈) from ×10 on, so ×8
  // differs on a host only 1.25× slower than quiet, under the load of other runs' checks (runs 1475 and 1490)
  "precision/g331-simplify-f214-12": "HOME_CLOCK_S",
  // Home's whole Enter, not one Giac call, against HOME_DEADLINE_MS (2 s): acos(sqrt(-2)/10^400-2) (G325f1) is 195-206 ms on a
  // quiet host (3 fresh engines, 2026-11-23), its largest Giac call 75 ms (11,111 checks); sum(1/(k*(4*k+1)),k,1,inf) (G618) is
  // 162-169 ms, its largest call 82 ms (131,000 checks, the same on phase-1's engine). The golden row keeps its answer up to a
  // clock ×10 (acos) and ×12 (sum) and stops from ×12 and ×14 on, so ×8 differs on a host 1.25-1.5× slower than quiet, under
  // the load of other runs' checks (run 1494, which also stopped G340's and G331's rows)
  "home/g325f1-acos-sqrt-neg2-1e-400-minus-2": "HOME_DEADLINE_MS",
  "home/g618-sum-k(4k+1)": "HOME_DEADLINE_MS",
};

const root = fileURLToPath(new URL("../../", import.meta.url));
const load = (file: string): Case[] => (parse(readFileSync(`${root}tests/golden/${file}`, "utf8")) as { cases: Case[] }).cases;
const cases = (file: string, ids?: readonly string[]): Case[] => {
  const all = load(file);
  if (!ids) return all.map(typed);
  return ids.map((id) => {
    const c = all.find((x) => x.id === id);
    if (!c) throw new Error(`golden-speed: no case ${id} in ${file}`);
    return typed(c);
  });
};

/** The cases (all, or A20's) on the real clock and on a `slow`× fast one; the findings between the two runs, split into
 *  the known ones (SPEED_KNOWN), the pending cases' (listed, never failed) and the new ones. */
export async function speedFindings(
  slow: number,
  mjs: string = giacMjsPath(),
  only: "all" | "a20" = "all",
): Promise<{ findings: Finding[]; known: Finding[]; pending: Finding[]; records: number }> {
  const fresh = async (): Promise<EngineHost> => {
    const { giac, bridge } = await loadNodeGiac(mjs);
    giac.eval(pasdegCommand("rad"));
    return new EngineHost(giac, bridge);
  };
  const home = cases("home.yaml", only === "a20" ? A20_CASES.home : undefined);
  const precision = cases("precision.yaml", only === "a20" ? A20_CASES.precision : undefined);
  const normal = await goldenRecords(home, precision, fresh);
  const slowed = await withFastClock(slow, () => goldenRecords(home, precision, fresh));
  const all = compareGolden(normal, slowed);
  const pendingIds = new Set([
    ...home.filter((c) => c.status === "pending").map((c) => `home/${c.id}`),
    ...precision.filter((c) => c.status === "pending").map((c) => `precision/${c.id}`),
  ]);
  return { ...splitSpeed(all, pendingIds), records: normal.length };
}

/** G137: splits the findings into the known ones (SPEED_KNOWN), the pending cases' (stage/id in `pendingIds`: listed, never
 *  failed, so no exemption outlives a case's pending status) and the new ones. */
export function splitSpeed(all: Finding[], pendingIds: ReadonlySet<string>): { findings: Finding[]; known: Finding[]; pending: Finding[] } {
  const isKnown = (f: Finding): boolean => `${f.stage}/${f.id}` in SPEED_KNOWN;
  const isPending = (f: Finding): boolean => !isKnown(f) && pendingIds.has(`${f.stage}/${f.id}`);
  return { findings: all.filter((f) => !isKnown(f) && !isPending(f)), known: all.filter(isKnown), pending: all.filter(isPending) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const slow = Number(process.env.SLOW ?? 8);
  const { findings, known, pending, records } = await speedFindings(slow, giacMjsPath(), process.env.ONLY === "a20" ? "a20" : "all");
  const show = (f: Finding): string => describe(f).replace("desktop", "clock ×1").replace("device", `clock ×${slow}`);
  for (const f of known) console.log(`known (${SPEED_KNOWN[`${f.stage}/${f.id}`]}): ${show(f)}`);
  for (const f of pending) console.log(`pending: ${show(f)}`);
  for (const f of findings) console.log(show(f));
  console.log(`${findings.length === 0 ? "SAME" : "DIFFERENT"}: ${records} cases, clock ×1 and ×${slow}, ${findings.length} new findings, ${known.length} known, ${pending.length} pending`);
  process.exit(findings.length === 0 ? 0 : 1);
}
