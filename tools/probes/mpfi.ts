// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (S20): MPFI intervals as a second check of the mark (docs/04 2.4). For every non-rational Home case of
// tests/golden/home.yaml and precision.yaml (an `input` and an `oracle`, mark ≈ or ⚠, no `before`, no status) and the
// G141 / F155 rows below, it asks Giac built WITH_MPFI=1 for an interval of the value at P = max(40, digits+10) decimal
// digits (convert(…,interval,P): 3.2·P bits, prog.cc convert_interval), then the oracle (tests/golden/oracle.py, via
// tools/probes/mpfi-oracle.py) whether the interval holds the value and how many digits it confirms; beside that, what
// today's check gives on the normal engine (the host's reliableDigits and the case's mark).
//   GIAC_OUT=<normal build> node tools/probes/mpfi.ts            # all cases; summary and the lists
//   … node tools/probes/mpfi.ts --only 'sqrt(2)' 'tan(10^1000)'   # chosen inputs (Home text) instead of the files
//   MPFI_MJS=<mpfi build>/giac.mjs …                              # default engine/giac/_out/mpfi/giac.mjs
//   JSON=1 …                                                      # every row as one JSON line instead of the lists
//   PART=i/n …                                                    # every n-th case from the i-th (one 10-minute slice each;
//                                                                 # all of them take about 9 minutes), rows to _out/mpfi/rows-<i>of<n>.jsonl
//   … node tools/probes/mpfi.ts --judge                            # no engine: the oracle and the summary over every part's rows
// Then the raise: when the interval at P is not an interval that confirms the shown digits, the same call at 2P, 4P …
// (ZIV_MAX=1200 digits, past MAX_EVAL_DIGITS = 1000 so tan(10^1000) can be reached), and the digits it took.
// What goes in: the host's exact form when Home took the exact path (the value today's check evaluates at P and P+20),
// else the typed input quoted, its decimals read as exact fractions. The interval of an exact form is certified only as
// far as Giac's interval functions are: a miss of the oracle value is a Giac bug (the report lists them).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { EngineHost } from "../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings } from "../../app/src/engine/homeEval.ts";

type Case = { id: string; input: string; oracle: string; mark?: string; settings?: { digits?: number; angle?: "rad" | "deg"; shown?: number } };
type Row = {
  id: string; input: string; oracle: string; digits: number; P: number; mark: string;
  today: { display: string; path: string; reliable: number | null; ms: number };
  form: "exact" | "typed" | "none"; sent: string; got: string; kind: "interval" | "complex" | "cannot" | "error";
  re: [string, string] | null; im: [string, string] | null; ms: number; evalfMs: number;
  /** The raise (Ziv's loop): P, 2P, 4P … up to ZIV_MAX digits until the interval confirms the shown digits. */
  ziv: { at: number; got: string; re: [string, string] | null; im: [string, string] | null; ms: number } | null;
};

const here = (p: string): string => fileURLToPath(new URL(p, import.meta.url));
const require = createRequire(here("../../app/package.json"));
const { parse } = require("yaml") as { parse: (s: string) => unknown };
const MPFI_MJS = process.env.MPFI_MJS ?? here("../../engine/giac/_out/mpfi/giac.mjs");
const ZIV_MAX = Number(process.env.ZIV_MAX ?? 1200);
/** The oracle's venv: this checkout's, else the main checkout's (a worktree has none of its own). */
function venvPython(): string {
  const own = here("../../tests/golden/.venv/bin/python");
  if (existsSync(own)) return own;
  const common = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: here("."), encoding: "utf8" }).stdout.trim();
  return `${dirname(common)}/tests/golden/.venv/bin/python`;
}
const PY = process.env.ORACLE_PY ?? venvPython();

// G141's rows (the literal guard), its report's cases the guard cannot see, and F155's tan(1ᴇ1000) (backlog); oracle
// at 200 digits (D200), source: oracle.
const EXTRA: Case[] = [
  { id: "g141-e", input: "(1+10^-100)^(10^100)", oracle: "D200(lambda: exp(power(10,100)*ln(1+power(10,-100))))", mark: "⚠" },
  { id: "g141-cos", input: "(1-cos(10^-90))*10^180+1", oracle: "D200(lambda: (1-cos(power(10,-90)))*power(10,180)+1)", mark: "⚠" },
  { id: "g141-sin", input: "(sin(1+10^-100)-sin(1))*10^100+1", oracle: "D200(lambda: (sin(1+power(10,-100))-sin(1))*power(10,100)+1)", mark: "⚠" },
  { id: "g141-exp300", input: "(1+exp(-300))^exp(300)", oracle: "D200(lambda: exp(exp(300)*ln(1+exp(-300))))", mark: "≈" },
  { id: "g141-cos600", input: "(1-cos(10^-600))*10^1200+1", oracle: "F(3,2)", mark: "≈" },
  { id: "g141-floor", input: "floor((1+10^-100)^(10^100))", oracle: "F(2)", mark: "=" },
  { id: "f155-tan", input: "tan(10^1000)", oracle: "D200(lambda: tan(power(10,1000)))", mark: "⚠" },
];

function loadCases(): Case[] {
  const only = process.argv.indexOf("--only");
  if (only >= 0) return process.argv.slice(only + 1).map((input, k) => ({ id: `only-${k}`, input, oracle: "None" }));
  const out: Case[] = [];
  for (const f of ["home.yaml", "precision.yaml"]) {
    const all = (parse(readFileSync(here(`../../tests/golden/${f}`), "utf8")) as { cases: Record<string, unknown>[] }).cases;
    for (const c of all) {
      if (typeof c.input !== "string" || typeof c.oracle !== "string" || c.kind || c.before || c.status) continue;
      if (c.mark !== "≈" && c.mark !== "⚠") continue;
      out.push(c as unknown as Case);
    }
  }
  return [...out, ...EXTRA];
}

/** A decimal literal as an exact fraction (1.5e3 → (1500), 0.1 → (1/10)); integers stay. */
function rationalized(s: string): string {
  return s.replace(/(?<![\w.])(\d+\.\d*|\.\d+|\d+)[eE]([+-]?\d+)|(?<![\w.])(\d+\.\d*|\.\d+)(?![\d.eE])/g, (m, a, e, b) => {
    const lit = (a ?? b) as string;
    const [ip, fp = ""] = lit.split(".");
    const ex = Number(e ?? 0) - fp.length;
    const n = (ip + fp).replace(/^0+(?=\d)/, "");
    return ex >= 0 ? `(${n}*10^${ex})` : `(${n}/10^${-ex})`;
  });
}

const NUM = String.raw`[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?`;
const BOUND = String.raw`[-+]?infinity|${NUM}`;
const IV = String.raw`\[(${BOUND})\.\.(${BOUND})\]`;
const REAL = new RegExp(`^${IV}$`);
const CPLX = new RegExp(`^${IV}\\+${IV}\\*i$`);
const IMAG = new RegExp(`^${IV}\\*i$`);

function classify(got: string): Pick<Row, "kind" | "re" | "im"> {
  let m = REAL.exec(got);
  if (m) return { kind: "interval", re: [m[1]!, m[2]!], im: null };
  m = CPLX.exec(got);
  if (m) return { kind: "complex", re: [m[1]!, m[2]!], im: [m[3]!, m[4]!] };
  m = IMAG.exec(got);
  if (m) return { kind: "complex", re: ["0", "0"], im: [m[1]!, m[2]!] };
  return { kind: /error|Error|not compiled/.test(got) ? "error" : "cannot", re: null, im: null };
}

const pick = (k: Pick<Row, "re" | "im">): Pick<Row, "re" | "im"> => ({ re: k.re, im: k.im });
/** Leading digits two printed bounds share (mantissa text, a rough count; the oracle side gives the real one). */
function roughDigits(k: Pick<Row, "re" | "im">): number {
  const one = (b: [string, string]): number => {
    if (Number(b[0]) === 0 && Number(b[1]) === 0) return 99;
    const m = (t: string): string => t.replace(/^[-+]?0*\.?0*/, "").replace(/e.*$/i, "").replace(".", "");
    const [a, z] = [m(b[0]), m(b[1])];
    if (b[0].replace(/[^-]/g, "") !== b[1].replace(/[^-]/g, "") || b[0].replace(/^.*e/i, "") !== b[1].replace(/^.*e/i, "")) return 0;
    let n = 0;
    while (n < a.length && a[n] === z[n]) n++;
    return n - 1;
  };
  return Math.min(...[k.re, k.im].filter((b): b is [string, string] => b !== null).map(one));
}

const time = <T>(f: () => T): [T, number] => { const t0 = performance.now(); const r = f(); return [r, performance.now() - t0]; };

const OUT = here("_out/mpfi");
const judgeOnly = process.argv.includes("--judge");
const [partI, partN] = (process.env.PART ?? "1/1").split("/").map(Number) as [number, number];
const rows: Row[] = judgeOnly ? readRows() : await engineRows();

/** Every part's rows (`--judge`). */
function readRows(): Row[] {
  return readdirSync(OUT).filter((f) => /^rows-\d+of\d+\.jsonl$/.test(f)).sort()
    .flatMap((f) => readFileSync(`${OUT}/${f}`, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as Row));
}

async function engineRows(): Promise<Row[]> {
const cases = loadCases().filter((_, k) => k % partN === partI - 1);
const normal = await loadNodeGiac();
const host = new EngineHost(normal.giac, normal.bridge);
const mp = await loadNodeGiac(MPFI_MJS);
const rows: Row[] = [];
for (const c of cases) {
  const digits = c.settings?.digits ?? 12;
  const P = Math.max(40, digits + 10);
  const angle = c.settings?.angle ?? "rad";
  const [r, todayMs] = time(() => host.home(c.input, { ...defaultHomeSettings, digits, angle, workDigits: Math.max(30, digits + 10) }).result);
  const reliable = (r.facts as { reliableDigits?: number | null } | undefined)?.reliableDigits ?? null;
  const exact = r.path === "exact" && r.exact ? r.exact : null;
  const sent = exact ?? rationalized(c.input);
  mp.giac.eval(`Digits:=${P}`);
  mp.giac.eval(`angle_radian:=${angle === "deg" ? 0 : 1}`);
  const call = exact ? `convert(${sent},interval,${P})` : `convert(quote(${sent}),interval,${P})`;
  const [got, ms] = time(() => mp.giac.eval(call));
  // Today's cost for the same form: one evalf at P on the normal engine (the second of the check's two).
  normal.giac.eval(`angle_radian:=${angle === "deg" ? 0 : 1}`);
  const [, evalfMs] = time(() => normal.giac.eval(`evalf(${exact ?? c.input},${P})`));
  normal.giac.eval("angle_radian:=1");
  // The raise: a quick digits estimate from the printed bounds (the oracle side recounts them).
  let ziv: Row["ziv"] = null;
  const short = (g: string): boolean => { const k = classify(g.trim()); return k.re === null || roughDigits(k) < digits; };
  if (short(got) && !/^(error|cannot)$/.test(classify(got.trim()).kind)) {
    let at = 2 * P;
    for (;;) {
      mp.giac.eval(`Digits:=${at}`);
      const z = exact ? `convert(${sent},interval,${at})` : `convert(quote(${sent}),interval,${at})`;
      const [g, zms] = time(() => mp.giac.eval(z));
      ziv = { at, got: g.slice(0, 160), ...pick(classify(g.trim())), ms: zms };
      if (!short(g) || at >= ZIV_MAX) break;
      at = Math.min(ZIV_MAX, 2 * at);
    }
  }
  rows.push({
    ziv,
    id: c.id, input: c.input, oracle: c.oracle, digits, P, mark: c.mark ?? "",
    today: { display: r.display, path: r.path, reliable, ms: todayMs },
    form: exact ? "exact" : "typed", sent: sent.slice(0, 400), got: got.slice(0, 160), ...classify(got.trim()), ms, evalfMs,
  });
}
mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/rows-${partI}of${partN}.jsonl`, rows.map((x) => JSON.stringify(x)).join("\n") + "\n");
return rows;
}

// The oracle side: containment and the interval's digits.
const py = spawnSync(PY, ["-I", here("mpfi-oracle.py")], {
  input: rows.flatMap((x) => [
    JSON.stringify({ id: x.id, oracle: x.oracle, P: x.P, re: x.re, im: x.im }),
    ...(x.ziv ? [JSON.stringify({ id: `${x.id}#ziv`, oracle: x.oracle, P: x.ziv.at, re: x.ziv.re, im: x.ziv.im })] : []),
  ]).join("\n"),
  encoding: "utf8", maxBuffer: 1 << 26, timeout: 600_000,
});
if (py.status !== 0) { console.error(py.error?.message ?? "", (py.stderr ?? "").slice(0, 2000)); process.exit(1); }
const judged = new Map(py.stdout.trim().split("\n").map((l) => { const j = JSON.parse(l) as { id: string }; return [j.id, j] as const; }));
type J = { value: string | null; contains: string; digits: number | null; error?: string };
const all = rows.map((x) => ({ ...x, j: judged.get(x.id) as J, z: judged.get(`${x.id}#ziv`) as J | undefined }));

writeFileSync(`${OUT}/judged.jsonl`, all.map((x) => JSON.stringify(x)).join("\n") + "\n");
if (process.env.JSON === "1") {
  for (const x of all) console.log(JSON.stringify(x));
  process.exit(0);
}

const fn = (s: string): string[] => [...new Set([...s.matchAll(/([A-Za-z_][A-Za-z_0-9]*)\(/g)].map((m) => m[1]!))];
const withIv = all.filter((x) => x.re);
const median = (a: number[]): number => { const s = [...a].sort((p, q) => p - q); return s.length ? s[Math.floor(s.length / 2)]! : 0; };
const pct = (n: number, d: number): string => `${n}/${d} (${d ? ((100 * n) / d).toFixed(0) : 0} %)`;
console.log(`cases ${all.length}; an interval for ${pct(withIv.length, all.length)} (complex ${withIv.filter((x) => x.kind === "complex").length}); P = max(40, digits+10) digits`);
const miss = withIv.filter((x) => x.j.contains === "no");
const edge = withIv.filter((x) => x.j.contains === "edge");
console.log(`containment: holds ${withIv.filter((x) => x.j.contains === "yes").length}, within a printed digit ${edge.length}, MISSES ${miss.length}, no oracle value ${withIv.filter((x) => x.j.contains === "n/a").length}`);
for (const x of [...miss, ...edge]) console.log(`  ${x.j.contains.padEnd(4)} ${x.id}: ${x.input} -> ${x.got.slice(0, 100)} (oracle ${x.j.value})`);
// Too pessimistic: today's mark ≈ (every shown digit confirmed) but the interval confirms fewer than the digits shown.
const today = withIv.filter((x) => x.j.digits !== null);
const pess = today.filter((x) => x.mark === "≈" && (x.j.digits ?? 0) < x.digits);
const fewer = today.filter((x) => x.today.reliable !== null && (x.j.digits ?? 0) < (x.today.reliable ?? 0));
const gain = today.filter((x) => x.mark === "⚠" && (x.j.digits ?? 0) >= x.digits && x.j.contains === "yes");
console.log(`pessimistic: today ≈, the interval confirms fewer than the shown digits: ${pct(pess.length, today.filter((x) => x.mark === "≈").length)}`);
for (const x of pess) console.log(`  ${x.id}: ${x.input} interval ${x.j.digits} digits, shown ${x.digits}, today ${x.today.reliable}: ${x.got.slice(0, 90)}`);
console.log(`fewer digits than today's reliableDigits: ${pct(fewer.length, today.filter((x) => x.today.reliable !== null).length)}`);
console.log(`more: today ⚠, the interval confirms the shown digits: ${pct(gain.length, today.filter((x) => x.mark === "⚠").length)}`);
for (const x of gain) console.log(`  ${x.id}: ${x.input} interval ${x.j.digits} digits, today ${x.today.display} (${x.today.reliable})`);
const cannot = all.filter((x) => !x.re);
const names = new Map<string, number>();
for (const x of cannot) for (const n of fn(x.got)) names.set(n, (names.get(n) ?? 0) + 1);
console.log(`no interval: ${cannot.length} (error ${cannot.filter((x) => x.kind === "error").length}); names left in Giac's answer: ${[...names].sort((a, b) => b[1] - a[1]).map(([n, k]) => `${n} ${k}`).join(", ")}`);
for (const x of cannot.slice(0, Number(process.env.SHOW ?? 25))) console.log(`  ${x.id}: ${x.form} ${x.sent.slice(0, 50)} -> ${x.got.slice(0, 90)}`);
console.log(`time: interval median ${median(withIv.map((x) => x.ms)).toFixed(2)} ms, p95 ${median(withIv.map((x) => x.ms).sort((a, b) => a - b).slice(Math.floor(withIv.length * 0.9))).toFixed(2)} ms; evalf at P median ${median(withIv.map((x) => x.evalfMs)).toFixed(2)} ms (desktop, one run)`);
// The raise: how many cases reach the shown digits, at which precision, and its containment.
const raised = all.filter((x) => x.ziv);
const reached = raised.filter((x) => (x.z?.digits ?? 0) >= x.digits);
const zmiss = raised.filter((x) => x.z?.contains === "no");
console.log(`raise (2P, 4P … ${ZIV_MAX}): ${raised.length} cases short at P; ${reached.length} reach the shown digits, MISSES ${zmiss.length}; precision needed: ${[...new Set(reached.map((x) => x.ziv!.at))].sort((a, b) => a - b).map((a) => `${a} (${reached.filter((x) => x.ziv!.at === a).length})`).join(", ")}; time median ${median(reached.map((x) => x.ziv!.ms)).toFixed(1)} ms, max ${Math.max(0, ...reached.map((x) => x.ziv!.ms)).toFixed(1)} ms`);
for (const x of zmiss) console.log(`  MISS ${x.id}: ${x.input} at ${x.ziv!.at}: ${x.ziv!.got.slice(0, 100)} (oracle ${x.z?.value})`);
for (const x of raised.filter((y) => !reached.includes(y)).slice(0, Number(process.env.SHOW ?? 25))) console.log(`  not reached ${x.id}: ${x.input} at ${x.ziv!.at}: ${x.ziv!.got.slice(0, 90)}`);
for (const x of all.filter((y) => y.id.startsWith("g141") || y.id.startsWith("f155"))) {
  console.log(`  ${x.id}: ${x.input} today ${x.today.display} [${x.mark}] (${x.today.reliable}); at P ${x.j.digits ?? "-"} digits ${x.j.contains}; raised to ${x.ziv?.at ?? "-"}: ${x.z?.digits ?? "-"} digits ${x.z?.contains ?? ""} ${x.ziv?.ms.toFixed(1) ?? ""} ms; oracle ${x.j.value?.slice(0, 20)}`);
}
