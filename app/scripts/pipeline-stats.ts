// SPDX-License-Identifier: GPL-3.0-or-later
// A132: the pipeline's rates from .coord/log.md (read-only), per band of run numbers, per agent and per model: how many runs
// ended not merged, how many merged with no fix round, fix rounds and audit FIX per run, e2e failures, failures per check, not
// merged after an APPROVED audit; and the lock waits per lane (integ, host-cpu, host-cpu held by a pass). Only erasable
// TypeScript syntax and the standard library (Node runs this file):
//   node app/scripts/pipeline-stats.ts [--from N] [--to N] [--band SIZE] [--log PATH]
// The log defaults to the main checkout's .coord/log.md (from `git rev-parse --git-common-dir`); without --band the range is one band.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** A band with fewer finished runs than this gets a line saying its rates are too few to compare. */
export const TOO_FEW = 50;

export interface Run {
  n: number;
  id: string;
  agent: string;
  model: string;
  lane: string;
  outcome: "merged" | "not-merged" | null;
  fixRounds: number;
  auditFix: number;
  lastAudit: "APPROVED" | "FIX" | null;
  e2e: boolean;
  /** the checks named by `pre-flight failed` and `checks failed` lines, one entry per such line and check */
  fails: string[];
}
export interface Refusal {
  n: number;
  id: string;
  why: string;
}
export interface Wait {
  n: number;
  lane: string;
  kind: "integ" | "host-cpu" | "held-by-pass" | "held-by-run";
  s: number;
}
export interface Parsed {
  runs: Run[];
  refusals: Refusal[];
  waits: Wait[];
}

const START = /^- \d\d:\d\d (?:\[([A-Z])\] )?pipeline #(\d+) (\S+) \(([^,)]+), ([^,)]+)[^)]*\) on \S+: started/;
const LINE = /^- \d\d:\d\d (?:\[([A-Z])\] )?pipeline #(\d+) ([^\s:]+): (.*)$/;

/** The runs of a log (a run is a `started` line), the numbers that ended with no start line (refusals) and the lock waits. */
export function parseLog(text: string): Parsed {
  const runs = new Map<number, Run>();
  const outcomes = new Map<number, { id: string; outcome: "merged" | "not-merged"; rest: string }>();
  const fixSeen = new Set<string>();
  const auditSeen = new Set<string>();
  const extra = new Map<number, { fixRounds: number; auditFix: number; lastAudit: Run["lastAudit"]; e2e: boolean; fails: string[] }>();
  const waits: Wait[] = [];
  const get = (n: number) => {
    let e = extra.get(n);
    if (!e) extra.set(n, (e = { fixRounds: 0, auditFix: 0, lastAudit: null, e2e: false, fails: [] }));
    return e;
  };
  for (const line of text.split(/\r?\n/)) {
    const s = START.exec(line);
    if (s) {
      const n = Number(s[2]);
      if (!runs.has(n)) runs.set(n, { n, id: s[3]!, agent: s[4]!, model: s[5]!, lane: s[1] ?? "", outcome: null, fixRounds: 0, auditFix: 0, lastAudit: null, e2e: false, fails: [] });
      continue;
    }
    const m = LINE.exec(line);
    if (!m) continue;
    const lane = m[1] ?? "";
    const n = Number(m[2]);
    const id = m[3]!;
    const msg = m[4]!;
    let w: RegExpExecArray | null;
    if ((w = /^(integ|host-cpu) taken after a wait of (\d+) s/.exec(msg))) waits.push({ n, lane, kind: w[1] as "integ" | "host-cpu", s: Number(w[2]) });
    else if ((w = /^host-cpu held by (\S+) for (\d+) s;/.exec(msg))) waits.push({ n, lane, kind: /^pipeline-\d+$/.test(w[1]!) ? "held-by-run" : "held-by-pass", s: Number(w[2]) });
    else if ((w = /^(MERGED|NOT MERGED)\b(.*)$/.exec(msg))) outcomes.set(n, { id, outcome: w[1] === "MERGED" ? "merged" : "not-merged", rest: w[2]!.trim() });
    else if ((w = /^fix round (\d+) done/.exec(msg))) {
      if (!fixSeen.has(`${n}/${w[1]}`)) { fixSeen.add(`${n}/${w[1]}`); get(n).fixRounds++; }
    } else if ((w = /^audit (APPROVED|FIX) \(round (\d+)\)/.exec(msg))) {
      const e = get(n);
      e.lastAudit = w[1] as "APPROVED" | "FIX";
      if (w[1] === "FIX" && !auditSeen.has(`${n}/${w[2]}`)) { auditSeen.add(`${n}/${w[2]}`); e.auditFix++; }
    } else if (/^(?:pre-flight|checks) failed \(round \d+\):/.test(msg)) {
      const e = get(n);
      const names = [...msg.matchAll(/## (\S+) failed/g)].map((x) => x[1]!);
      if (/checks failed: red-first/.test(msg)) names.push("red-first");
      for (const c of new Set(names)) {
        e.fails.push(c);
        if (c === "e2e") e.e2e = true;
      }
    }
  }
  const refusals: Refusal[] = [];
  for (const [n, o] of outcomes) {
    const r = runs.get(n);
    if (r) r.outcome = o.outcome;
    else refusals.push({ n, id: o.id, why: /^\((.*?)\)/.exec(o.rest)?.[1] ?? o.rest });
  }
  for (const r of runs.values()) Object.assign(r, get(r.n));
  const byN = (a: { n: number }, b: { n: number }) => a.n - b.n;
  return { runs: [...runs.values()].sort(byN), refusals: refusals.sort(byN), waits };
}

export interface Row {
  kind: "all" | "agent" | "model";
  name: string;
  runs: number;
  notMerged: number;
  firstPass: number;
  fixRounds: number;
  auditFix: number;
  e2eRuns: number;
  approvedNotMerged: number;
  fails: Record<string, number>;
}
export interface Total {
  n: number;
  s: number;
}
export interface LockRow {
  lane: string;
  integ: Total;
  hostCpu: Total;
  heldByPass: Total;
  heldByRun: Total;
}
export interface Band {
  label: string;
  rows: Row[];
  locks: LockRow[];
}
export interface Report {
  bands: Band[];
  unfinished: Run[];
  refusals: Refusal[];
}
export interface Options {
  from?: number;
  to?: number;
  band?: number;
}

function summarise(kind: Row["kind"], name: string, finished: Run[]): Row {
  const fails: Record<string, number> = {};
  for (const r of finished) for (const c of r.fails) fails[c] = (fails[c] ?? 0) + 1;
  const nm = finished.filter((r) => r.outcome === "not-merged");
  return {
    kind,
    name,
    runs: finished.length,
    notMerged: nm.length,
    firstPass: finished.filter((r) => r.outcome === "merged" && r.fixRounds === 0).length,
    fixRounds: finished.reduce((a, r) => a + r.fixRounds, 0),
    auditFix: finished.reduce((a, r) => a + r.auditFix, 0),
    e2eRuns: finished.filter((r) => r.e2e).length,
    approvedNotMerged: nm.filter((r) => r.lastAudit === "APPROVED").length,
    fails,
  };
}

/** The rates of a parsed log for the run numbers in [from, to], cut into bands of `band` numbers (one band without it). */
export function stats(p: Parsed, o: Options): Report {
  const lo = o.from ?? -Infinity;
  const hi = o.to ?? Infinity;
  const inRange = (n: number) => n >= lo && n <= hi;
  const runs = p.runs.filter((r) => inRange(r.n));
  const refusals = p.refusals.filter((r) => inRange(r.n));
  const waits = p.waits.filter((w) => inRange(w.n));
  const nums = [...runs.map((r) => r.n), ...refusals.map((r) => r.n)];
  const size = o.band && o.band > 0 ? o.band : 0;
  const key = (n: number) => (size ? Math.floor(n / size) : 0);
  const keys = [...new Set(nums.map(key))].sort((a, b) => a - b);
  if (keys.length === 0) keys.push(0);
  const bands: Band[] = keys.map((k) => {
    const first = size ? k * size : Math.min(o.from ?? Infinity, ...nums);
    const last = size ? k * size + size - 1 : Math.max(o.to ?? -Infinity, ...nums);
    const inBand = (n: number) => key(n) === k;
    const label = Number.isFinite(first) && Number.isFinite(last) ? `#${size ? Math.max(first, o.from ?? first) : first}–${size ? Math.min(last, o.to ?? last) : last}` : "#–";
    const finished = runs.filter((r) => inBand(r.n) && r.outcome !== null);
    const rows = [summarise("all", "all", finished)];
    for (const kind of ["agent", "model"] as const) {
      const names = [...new Set(finished.map((r) => r[kind]))].sort();
      for (const name of names) rows.push(summarise(kind, name, finished.filter((r) => r[kind] === name)));
    }
    const lanes = [...new Set(waits.filter((w) => inBand(w.n)).map((w) => w.lane))].sort();
    const locks: LockRow[] = lanes.map((lane) => {
      const t = (kind: Wait["kind"]): Total => {
        const ws = waits.filter((w) => inBand(w.n) && w.lane === lane && w.kind === kind);
        return { n: ws.length, s: ws.reduce((a, w) => a + w.s, 0) };
      };
      return { lane, integ: t("integ"), hostCpu: t("host-cpu"), heldByPass: t("held-by-pass"), heldByRun: t("held-by-run") };
    });
    return { label, rows, locks };
  });
  return { bands, unfinished: runs.filter((r) => r.outcome === null), refusals };
}

const pct = (a: number, b: number) => (b === 0 ? "-" : `${((100 * a) / b).toFixed(1)} %`);
const per = (a: number, b: number) => (b === 0 ? "-" : (a / b).toFixed(2));

/** Left-aligned first column, the others right-aligned, two spaces between. */
function table(head: string[], body: string[][]): string[] {
  const all = [head, ...body];
  const w = head.map((_, i) => Math.max(...all.map((r) => r[i]!.length)));
  return all.map((r) => r.map((c, i) => (i === 0 ? c.padEnd(w[i]!) : c.padStart(w[i]!))).join("  ").trimEnd());
}

/** The report as plain text. */
export function render(r: Report): string {
  const out: string[] = [];
  for (const b of r.bands) {
    out.push(`== runs ${b.label} ==`);
    out.push(...table(
      ["", "runs", "not merged", "merged, no fix", "fix rounds/run", "audit FIX/run", "e2e failed runs", "NM after APPROVED"],
      b.rows.map((x) => [x.kind === "all" ? "all" : x.name, String(x.runs), `${x.notMerged} (${pct(x.notMerged, x.runs)})`, String(x.firstPass), per(x.fixRounds, x.runs), per(x.auditFix, x.runs), String(x.e2eRuns), String(x.approvedNotMerged)]),
    ));
    const checks = [...new Set(b.rows.flatMap((x) => Object.keys(x.fails)))].sort();
    if (checks.length > 0) {
      out.push("", "failures per check (runs' failed lines in the log, pre-flight and queue)");
      out.push(...table(["", ...checks], b.rows.map((x) => [x.kind === "all" ? "all" : x.name, ...checks.map((c) => String(x.fails[c] ?? 0))])));
    }
    const finished = b.rows[0]!.runs;
    if (finished < TOO_FEW) out.push("", `${b.label}: ${finished} finished runs, fewer than ${TOO_FEW} runs: the rates are too few to compare.`);
    if (b.locks.length > 0) {
      const t = (x: Total) => `${x.n} / ${x.s} s`;
      out.push("", "lock waits per lane (count / seconds)");
      out.push(...table(["lane", "integ taken", "host-cpu taken", "host-cpu held by a pass", "host-cpu held by a run"], b.locks.map((l) => [l.lane || "-", t(l.integ), t(l.hostCpu), t(l.heldByPass), t(l.heldByRun)])));
    }
    out.push("");
  }
  out.push(r.unfinished.length ? `unfinished: ${r.unfinished.map((x) => `#${x.n} ${x.id}`).join(", ")}` : "unfinished: none");
  out.push(r.refusals.length ? `no start line: ${r.refusals.map((x) => `#${x.n} ${x.id} (${x.why})`).join(", ")}` : "no start line: none");
  return out.join("\n");
}

/** The main checkout's .coord/log.md, found from the git common dir. */
function defaultLog(): string {
  const common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" }).trim();
  return join(dirname(resolve(common)), ".coord", "log.md");
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const a = process.argv.slice(2);
  const opt = (name: string) => {
    const i = a.indexOf(name);
    return i >= 0 ? a[i + 1] : undefined;
  };
  const num = (name: string) => {
    const v = opt(name);
    if (v === undefined) return undefined;
    if (!/^\d+$/.test(v)) { console.error(`pipeline-stats: ${name} needs a whole number`); process.exit(2); }
    return Number(v);
  };
  const known = new Set(["--from", "--to", "--band", "--log"]);
  if (a.some((x, i) => (i % 2 === 0 ? !known.has(x) : false)) || a.length % 2 !== 0) {
    console.error("usage: pipeline-stats.ts [--from N] [--to N] [--band SIZE] [--log PATH]");
    process.exit(2);
  }
  const text = readFileSync(opt("--log") ?? defaultLog(), "utf8");
  console.log(render(stats(parseLog(text), { from: num("--from"), to: num("--to"), band: num("--band") })));
}
