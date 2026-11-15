// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (S20): MPFI intervals as a second check of the mark (docs/04 2.4). For every non-rational Home case of
// tests/golden/home.yaml and precision.yaml (an `input` and an `oracle`, mark ≈ or ⚠, no `before`, no status) and the
// G141 / F155 rows below, it asks Giac built WITH_MPFI=1 for an interval of the value at P = max(40, digits+10) decimal
// digits, raised as today's check raises it past the form's longest exact integer + 20 (convert(…,interval,P): 3.2·P
// bits, prog.cc convert_interval), then the oracle (tests/golden/oracle.py, via
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
// (ZIV_MAX=2500 digits, past MAX_EVAL_DIGITS = 1000 so tan(10^1000) can be reached), and the digits it took.
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
  id: string; input: string; oracle: string; digits: number; P: number; mark: string; angle: "rad" | "deg";
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
const ZIV_MAX = Number(process.env.ZIV_MAX ?? 2500);
/** The oracle's venv: this checkout's, else the main checkout's (a worktree has none of its own). */
function venvPython(): string {
  const own = here("../../tests/golden/.venv/bin/python");
  if (existsSync(own)) return own;
  const common = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: here("."), encoding: "utf8" }).stdout.trim();
  return `${dirname(common)}/tests/golden/.venv/bin/python`;
}
const PY = process.env.ORACLE_PY ?? venvPython();

// G141's rows (the literal guard), its report's cases the guard cannot see, and F155's tan(1ᴇ1000) (backlog); oracle
// via D200, which mpfi-oracle.py runs at 1200 digits or more, source: oracle. `mark`: what Home shows on 2026-11-15.
const EXTRA: Case[] = [
  { id: "g141-e", input: "(1+10^-100)^(10^100)", oracle: "D200(lambda: exp(power(10,100)*ln(1+power(10,-100))))", mark: "≈" },
  { id: "g141-cos", input: "(1-cos(10^-90))*10^180+1", oracle: "D200(lambda: (1-cos(power(10,-90)))*power(10,180)+1)", mark: "≈" },
  { id: "g141-sin", input: "(sin(1+10^-100)-sin(1))*10^100+1", oracle: "D200(lambda: (sin(1+power(10,-100))-sin(1))*power(10,100)+1)", mark: "≈" },
  { id: "g141-exp300", input: "(1+exp(-300))^exp(300)", oracle: "D200(lambda: exp(exp(300)*ln(1+exp(-300))))", mark: "≈" },
  { id: "g141-cos600", input: "(1-cos(10^-600))*10^1200+1", oracle: "D200(lambda: (1-cos(power(10,-600)))*power(10,1200)+1)", mark: "⚠" },
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
/** Leading digits two printed bounds share (mantissa text, a rough count; the oracle side gives the real one). A part
 *  whose interval holds 0 and is 10^(P0-5) times smaller than the other counts as zero (99), P0 the unraised working
 *  precision, as mpfi-oracle.py's rule. */
function roughDigits(k: Pick<Row, "re" | "im">, P0: number): number {
  const lg = (t: string): number => {
    if (/infinity/.test(t)) return Infinity;
    const m = /^[-+]?(\d*\.?\d*)(?:e([-+]?\d+))?$/i.exec(t);
    const v = Math.abs(parseFloat(m?.[1] ?? "0"));
    return v === 0 ? -Infinity : Math.log10(v) + Number(m?.[2] ?? 0);
  };
  const parts = [k.re, k.im].filter((b): b is [string, string] => b !== null);
  const size = parts.map((b) => Math.max(lg(b[0]), lg(b[1])));
  const one = (b: [string, string], at: number): number => {
    if (Number(b[0]) === 0 && Number(b[1]) === 0) return 99;
    const neg = (t: string): boolean => t.startsWith("-");
    const holdsZero = neg(b[0]) !== neg(b[1]) || Number(b[0]) === 0 || Number(b[1]) === 0;
    const other = parts.length === 2 ? size[1 - at]! : -Infinity;
    if (holdsZero && size[at]! < other - (P0 - 5)) return 99;
    const m = (t: string): string => t.replace(/^[-+]?0*\.?0*/, "").replace(/e.*$/i, "").replace(".", "");
    const [a, z] = [m(b[0]), m(b[1])];
    if (neg(b[0]) !== neg(b[1]) || b[0].replace(/^[^e]*e?/i, "") !== b[1].replace(/^[^e]*e?/i, "")) return 0;
    let n = 0;
    while (n < a.length && a[n] === z[n]) n++;
    return n - 1;
  };
  return Math.min(...parts.map((b, at) => one(b, at)));
}

const time = <T>(f: () => T): [T, number] => { const t0 = performance.now(); const r = f(); return [r, performance.now() - t0]; };

const OUT = process.env.MPFI_OUT ?? here("_out/mpfi");
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
  const P0 = Math.max(40, digits + 10);
  const angle = c.settings?.angle ?? "rad";
  const [r, todayMs] = time(() => host.home(c.input, { ...defaultHomeSettings, digits, angle, workDigits: Math.max(30, digits + 10) }).result);
  const reliable = (r.facts as { reliableDigits?: number | null } | undefined)?.reliableDigits ?? null;
  const exact = r.path === "exact" && r.exact ? r.exact : null;
  const sent = exact ?? rationalized(c.input);
  // Where today's check starts (G141, docs/04 2.4): past the longest exact integer of the form + 20, so a long literal
  // is exact at the interval's precision too (convert_interval rounds an integer to a point, prog.cc:8773).
  const P = Math.max(P0, Math.max(0, ...[...sent.matchAll(/\d+/g)].map((m) => m[0].length)) + 20);
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
  const short = (g: string): boolean => { const k = classify(g.trim()); return k.re === null || roughDigits(k, P0) < digits; };
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
    id: c.id, input: c.input, oracle: c.oracle, digits, P, mark: c.mark ?? "", angle,
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
    JSON.stringify({ id: x.id, oracle: x.oracle, P: x.P, P0: Math.max(40, x.digits + 10), re: x.re, im: x.im }),
    ...(x.ziv ? [JSON.stringify({ id: `${x.id}#ziv`, oracle: x.oracle, P: x.ziv.at, P0: Math.max(40, x.digits + 10), re: x.ziv.re, im: x.ziv.im })] : []),
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
const median = (a: number[]): number => { const s = [...a].sort((p, q) => p - q); return s.length ? s[Math.floor(s.length / 2)]! : 0; };
const p95 = (a: number[]): number => { const s = [...a].sort((p, q) => p - q); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * 0.95))]! : 0; };
const pct = (n: number, d: number): string => `${n}/${d} (${d ? ((100 * n) / d).toFixed(0) : 0} %)`;
const SHOW = Number(process.env.SHOW ?? 25);
// The groups: an exact rational needs no check (BigInt, 2.4 rule 1); in DEG the host's exact form is not the value shown
// (Giac's interval functions read radians); a float literal in the form makes its interval certify that float, not the
// value; a typed form (Home took no exact path) goes through Giac's functions as typed. The rest is the comparison.
type All = (typeof all)[number];
const extra = (x: All): boolean => /^(g141|f155)-/.test(x.id);
const group = (x: All): string => {
  if (extra(x)) return "extra";
  if (/^-?\(?\d+(\/\d+)?\)?$/.test(x.sent)) return "rational";
  if (x.angle === "deg") return "deg";
  if (x.form === "exact" && /(?<![\w])\d*\.\d+|\d[eE][-+]?\d/.test(x.sent)) return "float";
  return x.form === "typed" ? "typed" : "counted";
};
const groups = new Map<string, All[]>();
for (const x of all) groups.set(group(x), [...(groups.get(group(x)) ?? []), x]);
const G = (k: string): All[] => groups.get(k) ?? [];
console.log(`cases ${all.length}: counted ${G("counted").length} (the host's exact form, radians, no float in it), float in the form ${G("float").length}, typed ${G("typed").length}, DEG ${G("deg").length}, exact rational ${G("rational").length}, G141/F155 ${G("extra").length}; P = max(40, digits+10, longest integer+20) digits, convert(…,interval,P) = 3.2·P bits`);
for (const k of ["counted", "float", "typed", "deg"]) {
  const xs = G(k), iv = xs.filter((x) => x.re), miss = iv.filter((x) => x.j.contains === "no");
  console.log(`[${k}] an interval for ${pct(iv.length, xs.length)} (complex ${iv.filter((x) => x.kind === "complex").length}); containment MISSES ${miss.length}`);
  for (const x of miss.slice(0, k === "counted" ? 99 : 6)) console.log(`  miss ${x.id}: ${x.input} | ${x.sent.slice(0, 70)} -> ${x.got.slice(0, 90)} (oracle ${x.j.value?.slice(0, 24)})`);
}
const C = G("counted").filter((x) => x.re && x.j.contains === "yes" && x.j.digits !== null);
// Too pessimistic (Parisse): today's mark ≈ (every shown digit confirmed), the interval at P confirms fewer than shown.
const approx = C.filter((x) => x.mark === "≈");
const pess = approx.filter((x) => x.j.digits! < x.digits);
console.log(`counted with a holding interval: ${C.length}. Pessimistic at P: today ≈, the interval confirms fewer than the shown digits: ${pct(pess.length, approx.length)}`);
for (const x of pess.slice(0, SHOW)) console.log(`  ${x.id}: ${x.input} interval ${x.j.digits} digits, shown ${x.digits}, today ${x.today.reliable}; raised: ${x.ziv?.at ?? "-"} -> ${x.z?.digits ?? "-"}`);
const withRd = C.filter((x) => x.today.reliable !== null);
const fewer = withRd.filter((x) => x.j.digits! < x.today.reliable!), more = withRd.filter((x) => x.j.digits! > x.today.reliable!);
console.log(`against today's reliableDigits (both at P): interval fewer ${pct(fewer.length, withRd.length)}, more ${pct(more.length, withRd.length)}; median loss ${median(fewer.map((x) => x.today.reliable! - x.j.digits!))} digits`);
const warned = C.filter((x) => x.mark === "⚠"), gain = warned.filter((x) => x.j.digits! >= x.digits);
console.log(`more: today ⚠, the interval at P confirms the shown digits: ${pct(gain.length, warned.length)}`);
for (const x of gain.slice(0, SHOW)) console.log(`  ${x.id}: ${x.input} interval ${x.j.digits} digits, today ${x.today.display} (${x.today.reliable})`);
const cannot = [...G("counted"), ...G("typed"), ...G("float")].filter((x) => !x.re);
const names = new Map<string, number>();
for (const x of cannot) for (const n of fn(x.got)) names.set(n, (names.get(n) ?? 0) + 1);
console.log(`no interval: ${cannot.length} (Giac error ${cannot.filter((x) => x.kind === "error").length}); names left in Giac's answer: ${[...names].sort((a, b) => b[1] - a[1]).map(([n, k]) => `${n} ${k}`).join(", ")}`);
for (const x of cannot.slice(0, SHOW)) console.log(`  ${x.id}: ${x.form} ${x.sent.slice(0, 50)} -> ${x.got.slice(0, 80)}`);
const T = G("counted").filter((x) => x.re);
console.log(`time per call (desktop, one run each): convert(…,interval,P) median ${median(T.map((x) => x.ms)).toFixed(2)} ms, p95 ${p95(T.map((x) => x.ms)).toFixed(2)} ms; evalf(…,P) median ${median(T.map((x) => x.evalfMs)).toFixed(2)} ms, p95 ${p95(T.map((x) => x.evalfMs)).toFixed(2)} ms; Home today median ${median(T.map((x) => x.today.ms)).toFixed(2)} ms`);
// The raise: how many short cases reach the shown digits, at which precision, and its containment.
const raised = G("counted").filter((x) => x.ziv);
const reached = raised.filter((x) => x.z?.contains === "yes" && (x.z?.digits ?? 0) >= x.digits);
const zmiss = raised.filter((x) => x.z?.contains === "no");
console.log(`raise (2P, 4P … ${ZIV_MAX}) on counted: ${raised.length} short at P; ${reached.length} reach the shown digits, MISSES ${zmiss.length}; precision: ${[...new Set(reached.map((x) => x.ziv!.at))].sort((a, b) => a - b).map((a) => `${a} (${reached.filter((x) => x.ziv!.at === a).length})`).join(", ")}; time median ${median(reached.map((x) => x.ziv!.ms)).toFixed(1)} ms, max ${Math.max(0, ...reached.map((x) => x.ziv!.ms)).toFixed(1)} ms`);
for (const x of raised.filter((y) => !reached.includes(y)).slice(0, SHOW)) console.log(`  not reached ${x.id}: ${x.input} at ${x.ziv!.at}: ${x.ziv!.got.slice(0, 80)} (${x.z?.contains})`);
for (const x of G("extra")) {
  console.log(`  ${x.id}: ${x.input} today ${x.today.display} [${x.mark}] (${x.today.reliable}); ${x.form}; at P ${x.j.digits ?? "-"} digits ${x.j.contains}; raised to ${x.ziv?.at ?? "-"}: ${x.z?.digits ?? "-"} digits ${x.z?.contains ?? ""} ${x.ziv?.ms.toFixed(1) ?? ""} ms; oracle ${x.j.value?.slice(0, 20)}`);
}
