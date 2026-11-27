// SPDX-License-Identifier: GPL-3.0-or-later
// G800: the unit sweep as a gate stage (a family test, owner-style hunt 2026-11-23; docs/release-0.1.0.md point 3): random unit-view
// requests (scripts/unitsweep-gen.ts: a value with or without σ, a prefix, a compound unit, a constant) through the evaluator as the
// view calls it (EngineHost.units on the Find index's factors), then three checks (scripts/unitsweep-checks.ts):
//   trip     the value converted to another unit of its dimension and back reads the same at the digits shown (the view's headline,
//            STD); σ/value is the same in both units;
//   sigma    σ of a product, quotient or power of independent inputs against the GUM, first order plus G41's second-order term, and
//            its ⚠ (a singular point reached; else the second order over 10 % of σ²);
//   drawing  every result with σ, in STD, SCI, ENG and PFX at the case's digits: Home's unit row (units/row.ts unitRow drawn as
//            Session.display draws it: renderNumeric with the tidy chunk's sigmaRow and muter, then withSigma), the view's headline
//            (units/result.ts shownOf) and Copy as shown (clipboard/text.ts copyShownText) draw value and σ by the one rule (R885),
//            and a σ ⚠ in the view is in the row (R886).
//   node scripts/unitsweep.ts                       # the gate stage: fixed seed, UNITSWEEP_COUNT cases (default 200), exit 1 on a new
//                                                   # failure, a known one that now passes, or a run over 30 s
//   node scripts/unitsweep.ts --nightly [--seed N] [--count N]   # report only (exit 0): the seed is the clock (seconds), 2000 cases;
//     each failure not in the known file is a FINDING line, and the last line `UNITSWEEP NIGHTLY: <f> failures (<new> not in the
//     known files); <r> runs of <c> cases (seed <s>), <t> s`, which `scripts/pipeline.sh nightly` logs (NIGHTLY_TOOLS, A273)
// Known failures: tests/golden/unitsweep-known.yaml (id = "<case>" for trip and sigma, "<FORMAT> <case>" for a drawing; <case> is
// "<digits> <input>[ -> <end slot>]"; check = copy|row|head|cut|value|sigma|form|same|warn|trip|tripsigma|sigma1|sigmawarn|refused,
// package = the open backlog id): the gate's exact list; --nightly reads it too.
// Environment: GIAC_OUT as for the golden gate; the Find index (npm run index; FIND_INDEX_JSON another file).
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { freshHost, root } from "./golden/lib.ts";
import { invariantsStage, type InvariantFailure, type KnownFailure } from "./invariants.ts";
import { requestOf } from "./unit-case.ts";
import { drawingCheck, sigmaCheck, sigmaOracle, tripCheck, type SigmaCase } from "./unitsweep-checks.ts";
import { generateUnitCases, poolsOf, type UnitCase } from "./unitsweep-gen.ts";
import { copyShownText } from "../src/clipboard/text.ts";
import { decimalToString, type DecimalValue } from "../src/engine/format.ts";
import { defaultHomeSettings } from "../src/engine/homeEval.ts";
import type { EngineHost } from "../src/engine/host.ts";
import type { IndexItem } from "../src/find/types.ts";
import { muter, sigmaRow, withSigma } from "../src/render/tidy.ts";
import { renderNumeric, type DisplayContext, type NumericResult } from "../src/state/displayMode.ts";
import { buildJob } from "../src/units/build.ts";
import { factorTable, type FactorTable } from "../src/units/factors.ts";
import { shownOf, type UnitShown } from "../src/units/result.ts";
import { unitRow } from "../src/units/row.ts";
import { isUnitError, type Quantity } from "../src/units/types.ts";

export const KNOWN_FILE = "tests/golden/unitsweep-known.yaml";
const GATE_SEED = 20261123;
const BUDGET_S = 30;
const FORMATS = ["std", "sci", "eng", "pfx"] as const;

const num = (d: DecimalValue): number => Number(decimalToString(d));

/** Home's unit row of `q` as Session.display draws it at `format` and `digits` (the tidy chunk in), and Copy as shown of it. */
export function rowOf(q: Quantity, format: (typeof FORMATS)[number], digits: number): { text: string; copy: string } {
  const item = { ...unitRow({ line: "", chips: {}, q, slots: {}, input: "", digits }), id: 1 };
  const ctx: DisplayContext = { format, digits, fixDecimals: 4, angle: "rad", mute: muter, sigma: sigmaRow, round: false };
  const r = renderNumeric(item as unknown as NumericResult, undefined, ctx);
  const text = r ? withSigma(r, item.units as { text?: unknown; latex?: unknown; unc?: unknown }).text : "";
  return { text, copy: copyShownText(text) };
}

const headOf = (q: Quantity, format: string, digits: number): UnitShown => shownOf(q, { format: format.toUpperCase() as "STD", digits }) as UnitShown;

/** The sweep's cases run and checked: the failures (id, check, detail) and the number of checks made. */
export async function unitSweep(cases: readonly UnitCase[], table: FactorTable, host: EngineHost): Promise<{ failures: InvariantFailure[]; runs: number }> {
  const failures: InvariantFailure[] = [];
  let runs = 0;
  const fail = (id: string, f: { check: string; detail: string }[]): void => {
    for (const x of f) failures.push({ id, check: x.check, detail: x.detail });
  };
  const ask = (input: string, to: string | undefined, digits: number, id: string): Quantity | null => {
    const job = buildJob(requestOf(input, to, table), table);
    const q = isUnitError(job) ? job : host.units(job, { ...defaultHomeSettings, digits });
    if (!isUnitError(q) && q.value.value) return q;
    fail(id, [{ check: "refused", detail: `${input}${to ? ` → ${to}` : ""}: ${JSON.stringify(q).slice(0, 160)}` }]);
    return null;
  };
  const drawings = (q: Quantity, digits: number, id: string): void => {
    const sv = q.unc?.value.value?.re, v = q.value.value;
    if (!sv || !v || sv.digits === "" || v.im.digits !== "" || q.unc?.value.value?.im.digits !== "") return;
    for (const f of FORMATS) {
      const row = rowOf(q, f, digits);
      const h = headOf(q, f, digits);
      runs++;
      fail(`${f.toUpperCase()} ${id}`, drawingCheck({ value: v.re, sigma: sv, reliable: q.value.facts.reliableDigits ?? null, row: row.text, unit: q.unit, copy: row.copy, head: h.text, viewWarn: h.warn }));
    }
  };
  for (const c of cases) {
    if (c.kind === "trip") {
      const input = c.s ? `pasupm(${c.v},${c.s})*{${c.from}}` : `${c.v}*{${c.from}}`;
      const id = `${c.digits} ${input} -> ${c.to}`;
      const q0 = ask(input, c.from, c.digits, id);
      const q1 = q0 && ask(input, c.to, c.digits, id);
      if (!q0 || !q1) continue;
      // back from what the evaluator gave in B: its exact value (its every digit where Giac has no exact text), σ to 40 digits
      const v1 = q1.value.exact ?? decimalToString(q1.value.value!.re);
      const s1 = q1.unc?.value.value?.re;
      const q2 = ask(s1 ? `pasupm(${v1},${decimalToString(s1)})*{${c.to}}` : `(${v1})*{${c.to}}`, c.from, c.digits, id);
      if (!q2) continue;
      runs++;
      const rel = (q: Quantity): number | undefined => (q.unc?.value.value ? num(q.unc.value.value.re) / Math.abs(num(q.value.value!.re)) : undefined);
      const r0 = rel(q0), r1 = rel(q1);
      fail(id, tripCheck({ from: headOf(q0, "std", c.digits).text, back: headOf(q2, "std", c.digits).text, ...(r0 !== undefined && r1 !== undefined && num(q0.value.value!.re) !== 0 ? { relFrom: r0, relThere: r1 } : {}) }));
      for (const q of [q0, q1]) drawings(q, c.digits, id);
      continue;
    }
    const id = `${c.digits} ${c.input}`;
    const q = ask(c.input, undefined, c.digits, id);
    if (!q) continue;
    const sc: SigmaCase = c.shape === "power" ? { kind: "power", a: c.a, n: c.n! } : c.b ? { kind: c.shape, a: c.a, b: c.b } : { kind: "power", a: c.a, n: 1 };
    const sv = q.unc?.value.value?.re, v = q.value.value!.re;
    runs++;
    if (!sv) fail(id, [{ check: "sigma1", detail: "no σ" }]);
    else if (num(v) !== 0) fail(id, sigmaCheck(sigmaOracle(sc), { rel: num(sv) / Math.abs(num(v)), ...(q.unc?.why ? { why: q.unc.why } : {}) }));
    drawings(q, c.digits, id);
  }
  return { failures, runs };
}

/** The known rows (the gate's exact list). */
export function loadUnitKnown(dir: string): KnownFailure[] {
  return (parse(readFileSync(resolve(dir, KNOWN_FILE), "utf8")) as { known?: KnownFailure[] } | null)?.known ?? [];
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flag = (name: string): number | null => {
    const i = args.indexOf(name);
    return i >= 0 && args[i + 1] !== undefined ? Number(args[i + 1]) : null;
  };
  const nightly = args.includes("--nightly");
  const seed = flag("--seed") ?? (nightly ? Math.floor(Date.now() / 1000) : GATE_SEED);
  const count = flag("--count") ?? (nightly ? 2000 : Number(process.env["UNITSWEEP_COUNT"] ?? 200));
  const indexFile = process.env["FIND_INDEX_JSON"] ?? `${root}app/src/find/_gen/find-index.json`;
  if (!existsSync(indexFile)) {
    console.log(`UNITSWEEP FAILED: no Find index at ${indexFile}: run npm run index (N62_QALC_DL_DIR=<main checkout>/engine/qalc/_downloads in a worktree)`);
    process.exit(1);
  }
  const items = JSON.parse(readFileSync(indexFile, "utf8")) as IndexItem[];
  if (nightly) console.log(`UNITSWEEP SEED ${seed} (repeat: node scripts/unitsweep.ts --nightly --seed ${seed} --count ${count})`);
  const cases = generateUnitCases(seed, count, poolsOf(items));
  const host = await freshHost();
  const t0 = performance.now();
  const { failures, runs } = await unitSweep(cases, factorTable(items), host);
  const secs = (performance.now() - t0) / 1000;
  const known = loadUnitKnown(root);
  if (nightly) {
    const keys = new Set(known.map((k) => `${k.id} ${k.check}`));
    const fresh = failures.filter((f) => !keys.has(`${f.id} ${f.check}`));
    for (const f of fresh) console.log(`FINDING ${f.id} [${f.check}]: ${f.detail}`);
    console.log(`UNITSWEEP NIGHTLY: ${failures.length} failures (${fresh.length} not in the known files); ${runs} runs of ${cases.length} cases (seed ${seed}), ${secs.toFixed(1)} s`);
    process.exit(0);
  }
  const r = invariantsStage(failures, known);
  for (const l of r.lines) console.log(`  unitsweep ${l}`);
  const ok = r.ok && secs <= BUDGET_S;
  console.log(`${ok ? "UNITSWEEP PASSED" : "UNITSWEEP FAILED"}: ${runs} runs of ${cases.length} cases (seed ${seed}), ${secs.toFixed(1)} s; ${r.summary}${secs <= BUDGET_S ? "" : ` (over ${BUDGET_S} s)`}`);
  process.exit(ok ? 0 : 1);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(root, "app/scripts/unitsweep.ts")) await main();
