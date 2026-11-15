// SPDX-License-Identifier: GPL-3.0-or-later
// G215: Copy as Python runs and agrees with N62, a gate stage. Each group of scripts/pydiff-rows.yaml is one Home session
// on a fresh engine: every row is run through N62's engine and written as its session line (G210, state/sessionLine.ts),
// the lines become Copy as Python's script (clipboard/python.ts translateRows), the script runs in tests/golden/.venv,
// and each translated row's Python value (sympy's N at 30 digits) must give N62's value at 12 significant digits (at
// n for a `⚠ n` row), both written by N62's own realText. A row the yaml marks `comment: true` must come out NOT
// TRANSLATED, every other row translated; the file as copied must run as it is. G216: a row with `slots` is a unit-view
// row (its slots in scripts/unit-case.ts's text, by prompt id), run through the unit evaluator as the view runs it and
// written by units/row.ts; its Python Quantity is compared in the unit N62 shows. The stage runs pyunits-check.ts first.
//   node scripts/pydiff.ts                      # the gate stage: exit 1 on any problem
//   node scripts/pydiff.ts --corrupt sin=cos    # the same with one function-table entry changed: it must go red
// Environment: GIAC_OUT; the venv's Python (this checkout's tests/golden/.venv, else the main checkout's), which must
// hold the pinned sympy, pint and uncertainties (INSTALL_LINE): without them the stage fails, it never skips.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import type { EngineHost } from "../src/engine/host.ts";
import { defaultHomeSettings, type HomeSettings } from "../src/engine/homeEval.ts";
import { decimalFromString, isZero, type ComplexValue, type DecimalValue } from "../src/engine/format.ts";
import { giacOfEntry } from "../src/input/entry.ts";
import { ANS_KEY, type Chip } from "../src/input/chips.ts";
import { chipOf } from "../src/state/results.ts";
import { chipFactsOf, homeItem } from "../src/state/resultItem.ts";
import { sessionLine } from "../src/state/sessionLine.ts";
import type { HistoryItem } from "../src/state/session.svelte.ts";
import { realText } from "../src/clipboard/text.ts";
import { FUNCTIONS, translateCells, translateRows, type PyRow } from "../src/clipboard/python.ts";
import { PyUnitMissing, pintText } from "../src/clipboard/pyUnits.ts";
import { constKey, type ChipTable } from "../src/input/chips.ts";
import { latexToGiacInfo } from "../src/input/latex-to-giac.ts";
import { END, slotFormula } from "../src/input/unitFormula.ts";
import type { IndexItem } from "../src/find/types.ts";
import { buildJob } from "../src/units/build.ts";
import { factorTable, type FactorTable } from "../src/units/factors.ts";
import { unitRow } from "../src/units/row.ts";
import { isUnitError, type UnitRequest, type UnitSlot } from "../src/units/types.ts";
import { VENV_PINS, oracleVenvPython } from "./g2check.ts";
import { pyunitsCheck } from "./pyunits-check.ts";
import { slotOf } from "./unit-case.ts";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(app, "..");

export const INSTALL_LINE = `tests/golden/.venv/bin/pip install ${VENV_PINS}`;
/** The versions of the three the stage checks, from the venv's pins (tests/golden/README.md's line; THIRD_PARTY.md, test-only). */
export const PINNED: Readonly<Record<string, string>> = Object.fromEntries(
  ["sympy", "pint", "uncertainties"].map((k) => [k, new RegExp(`(?:^| )${k}==(\\S+)`).exec(VENV_PINS)?.[1] ?? "unpinned"]),
);
/** The digits a row is compared at (docs/04: STD 12). */
export const DIGITS = 12;
/** Fewer translated rows than this compared fails the stage: the translator must not go quiet on the row set. */
export const MIN_COMPARED = 30;

export interface RowIn {
  input: string;
  angle?: "rad" | "deg";
  /** The row must come out NOT TRANSLATED (a comment). */
  comment?: boolean;
  /** G216: a unit-view row: its filled slots and end slot by prompt id (`u1`, `end`), each as unit-case.ts writes one. */
  slots?: Record<string, string>;
}
export interface Group {
  id: string;
  rows: RowIn[];
}

export function readGroups(path = join(app, "scripts/pydiff-rows.yaml")): Group[] {
  return (parse(readFileSync(path, "utf8")) as { groups: Group[] }).groups;
}

/** One row as N62 gave it: its session line as the translator reads it, and the value N62 shows (absent: no number).
 *  G216: a unit row's unit as pint's text (`''` for a pure number), the unit `value` is in. */
export interface N62Row {
  line: PyRow;
  value?: ComplexValue;
  shown?: string;
  /** G216: N62's unit has no pint text in the table. */
  noShown?: string;
}

/** G216: the Find index's units and constants (npm run index), the factors the unit view builds its jobs with. */
export interface UnitIndex {
  table: FactorTable;
  items: readonly IndexItem[];
}
export function unitIndex(path = join(app, "src/find/_gen/find-index.json")): UnitIndex {
  let items: IndexItem[];
  try {
    items = JSON.parse(readFileSync(path, "utf8")) as IndexItem[];
  } catch {
    throw new Error(`no Find index at ${path}: run npm run index`);
  }
  return { table: factorTable(items), items };
}

/** G216: a unit row as the unit view runs it (units/view.ts request): the line with a prompt per slot, the empty ones
 *  dropped, the parser's units mode, the job on the engine; the history row units/row.ts writes. */
function unitItem(host: EngineHost, row: RowIn, k: number, s: HomeSettings, ix: UnitIndex): { item: HistoryItem; shown?: string; noShown?: string; value?: ComplexValue } {
  const filled: Record<string, UnitSlot> = Object.fromEntries(Object.entries(row.slots ?? {}).map(([id, t]) => [id, slotOf(t, ix.table)]));
  const chips: ChipTable = {};
  for (const m of row.input.matchAll(/\\const\{([^{}]*)\}/g)) {
    const it = ix.items.find((x) => x.id === `const:${m[1]}`);
    if (it?.value !== undefined) chips[constKey(m[1] as string)] = it.unc === undefined ? { value: it.value, exact: true } : { value: it.value, exact: false, unc: it.unc };
  }
  const f = slotFormula(row.input);
  let latex = f.latex;
  for (const id of [...f.slots, END]) if (!filled[id]) latex = latex.replace(id === END ? `\\to\\placeholder[${END}]{}` : `\\placeholder[${id}]{}`, "");
  const info = latexToGiacInfo(latex, { units: true, chips });
  const u = info.units ?? { slots: [], consts: [] };
  const end = u.end !== undefined ? filled[u.end] : undefined;
  const req: UnitRequest = { formula: info.giac, slots: u.slots.map((id) => filled[id] as UnitSlot), ...(u.consts.length ? { consts: u.consts } : {}), ...(end ? { end } : {}) };
  const job = buildJob(req, ix.table);
  const q = isUnitError(job) ? job : host.units(job, s);
  if (isUnitError(q)) return { item: { id: k + 1, view: "home", latex: row.input, status: "error", resultLatex: "", text: JSON.stringify(q), startedAt: 0, approximate: false } };
  const item: HistoryItem = { id: k + 1, ...unitRow({ line: row.input, chips, q, slots: filled, input: row.input, digits: DIGITS }) };
  let shown: string | undefined;
  let noShown: string | undefined;
  try {
    shown = q.shownSlot ? pintText(q.shownSlot) : "";
  } catch (err) {
    if (!(err instanceof PyUnitMissing)) throw err;
    noShown = `${q.unit} (${err.reason})`;
  }
  return { item, ...(shown !== undefined ? { shown } : {}), ...(noShown ? { noShown } : {}), ...(q.value.ok && q.value.value ? { value: q.value.value } : {}) };
}

/** The rows of one group on `host`, in order, as the session runs them (session.svelte.ts finish; goldenRun.ts runSteps):
 *  the entry through our parser with Ans the last result's chip, the item by results.ts's rule, the line by sessionLine. */
export function n62Rows(host: EngineHost, rows: readonly RowIn[], units?: UnitIndex): N62Row[] {
  let ans: Chip | undefined;
  let ix = units;
  return rows.map((row, k) => {
    const s: HomeSettings = { ...defaultHomeSettings, angle: row.angle ?? "rad" };
    if (row.slots) {
      const u = unitItem(host, row, k, s, (ix ??= unitIndex()));
      const text = sessionLine(u.item, { t: new Date(0), app: "pydiff" });
      if (u.item.status === "done") ans = chipOf(u.item) ?? ans;
      return { line: JSON.parse(text ?? "null") as PyRow, ...(u.value ? { value: u.value } : {}), ...(u.shown !== undefined ? { shown: u.shown } : {}), ...(u.noShown ? { noShown: u.noShown } : {}) };
    }
    const readsAns = /\\ans(?![A-Za-z])/.test(row.input);
    const p = giacOfEntry(row.input, "home", { chips: ans ? { [ANS_KEY]: ans } : {} });
    const r = (p.named || p.consts ? host.home(p.giac, s, p.consts, p.named && chipFactsOf(p.named)) : host.home(p.giac, s)).result;
    const item: HistoryItem = {
      id: k + 1,
      view: "home",
      latex: row.input,
      status: r.ok ? "done" : "error",
      resultLatex: "",
      text: r.display,
      startedAt: 0,
      ...(p.inexact ? { inexactInput: true } : {}),
      ...(readsAns && ans ? { ans: { value: ans.value, exact: ans.exact } } : {}),
      ...homeItem(r, p.inexact, p.giac, s),
    };
    const text = sessionLine(item, { t: new Date(0), app: "pydiff" });
    if (r.ok) ans = chipOf(item) ?? ans;
    return { line: JSON.parse(text ?? "null") as PyRow, ...(r.ok && r.value ? { value: r.value } : {}) };
  });
}

/** The Python that prints a probed name's value: sympy's N at 30 digits, its parts as text, one JSON line. */
const PRELUDE = [
  "import json as _n62_json",
  "from sympy import N as _n62_N, im as _n62_im, re as _n62_re, sympify as _n62_sympify",
  "def _n62_probe(line, v):",
  "    z = _n62_N(_n62_sympify(v), 30, chop=True)",
  '    print(_n62_json.dumps({"line": line, "re": str(_n62_N(_n62_re(z), 30)), "im": str(_n62_N(_n62_im(z), 30))}), flush=True)',
  // G216: a unit row's Quantity in the unit N62 shows ('' a pure number)
  "def _n62_in(v, u):",
  '    return v.to(u or "dimensionless").magnitude if hasattr(v, "to") else v',
];

/** A translated line of the file: its number in the file, its text, the name it binds and the row it is. */
export interface Probe {
  fileLine: number;
  code: string;
  name: string;
  row: number;
}

/** The file Copy as Python gives for `rows`, and the same file with a probe after each translated line. `scriptLine[i]`:
 *  the file's line that line i+1 of the script is (0: the prelude or a probe). */
export function probed(rows: readonly PyRow[], shown: readonly (string | undefined)[] = []): { file: string; script: string; probes: Probe[]; comments: number[]; scriptLine: number[] } {
  const file = translateRows(rows, { app: "pydiff" });
  const cells = translateCells(rows);
  const all = file.replace(/\n$/, "").split("\n");
  const cellLines = cells.flatMap((c) => c.code.split("\n"));
  const head = all.slice(0, all.length - cellLines.length);
  // the stage reads the file the user gets: its cells are translateCells', after the head and the imports
  if ([...head, ...cellLines].join("\n") !== all.join("\n")) throw new Error("translateRows is not its head and its cells: the probes would not be the file's");
  const script: string[] = [...PRELUDE];
  const scriptLine: number[] = PRELUDE.map(() => 0);
  const probes: Probe[] = [];
  const comments: number[] = [];
  const push = (s: string, fileLine: number): void => {
    script.push(s);
    scriptLine.push(fileLine);
  };
  head.forEach((l, i) => push(l, i + 1));
  let n = head.length;
  cells.forEach((c, row) => {
    const lines = c.code.split("\n");
    for (const l of lines) push(l, ++n);
    const last = lines[lines.length - 1] ?? "";
    const m = /^([A-Za-z_][A-Za-z0-9_]*) = /.exec(last);
    if (m && !c.code.startsWith("# N62 NOT TRANSLATED")) {
      probes.push({ fileLine: n, code: last, name: m[1] as string, row });
      const unit = shown[row];
      push(unit === undefined ? `_n62_probe(${n}, ${m[1]})` : `_n62_probe(${n}, _n62_in(${m[1]}, ${JSON.stringify(unit)}))`, 0);
    } else comments.push(row);
  });
  return { file, script: `${script.join("\n")}\n`, probes, comments, scriptLine };
}

export interface PyRun {
  code: number;
  out: string;
  err: string;
}

/** Runs a Python file, isolated (-I), with a time limit. */
export function runPython(py: string, path: string, text: string): PyRun {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  const r = spawnSync(py, ["-I", path], { encoding: "utf8", timeout: 120_000 });
  return { code: r.status ?? 1, out: r.stdout ?? "", err: `${r.stderr ?? ""}${r.error ? r.error.message : ""}` };
}

/** v at n significant digits as N62 writes it, the imaginary part after the real one when it is not zero. */
export function complexAt(re: DecimalValue, im: DecimalValue, n: number): string {
  return isZero(im) ? realText(re, n) : `${realText(re, n)} ${im.neg ? "-" : "+"} ${realText({ ...im, neg: false }, n)} i`;
}

/** The digits row `l` is compared at: 12, or n for a `⚠ n` row. */
const digitsOf = (l: PyRow & { reliableDigits?: number | null }): number =>
  l.mark === "⚠" && typeof l.reliableDigits === "number" ? Math.max(1, Math.min(DIGITS, l.reliableDigits)) : DIGITS;

export interface GroupResult {
  problems: string[];
  compared: number;
  comments: number;
  file: string;
}

/** One group's verdict: the file as copied runs; every translated row agrees with N62; `comment` rows and only they are
 *  comments. Each problem names the file's line and its text. */
export function judgeGroup(group: Group, n62: readonly N62Row[], py: string, dir: string): GroupResult {
  const rows = n62.map((r) => r.line);
  const { file, script, probes, comments, scriptLine } = probed(rows, n62.map((r) => r.shown));
  const problems: string[] = [];
  const slug = group.id.replace(/[^A-Za-z0-9]+/g, "-");
  const plain = runPython(py, join(dir, `${slug}.py`), file);
  if (plain.code !== 0) problems.push(`the file as copied does not run: ${lastLine(plain.err)}`);
  const run = runPython(py, join(dir, `${slug}.probed.py`), script);
  const got = new Map<number, { re: string; im: string }>();
  for (const l of run.out.split("\n")) {
    if (!l.startsWith("{")) continue;
    const o = JSON.parse(l) as { line: number; re: string; im: string };
    got.set(o.line, o);
  }
  if (run.code !== 0) {
    const at = [...run.err.matchAll(/line (\d+)/g)].map((m) => Number(m[1])).pop();
    const fileLine = at !== undefined ? (scriptLine[at - 1] ?? 0) : 0;
    const text = fileLine > 0 ? file.split("\n")[fileLine - 1] : undefined;
    problems.push(`${text !== undefined ? `line ${fileLine}: ${text}: ` : ""}Python stopped: ${lastLine(run.err)}`);
  }
  let compared = 0;
  for (const p of probes) {
    const want = group.rows[p.row];
    if (want?.comment) problems.push(`line ${p.fileLine}: ${p.code}: translated, the row set says NOT TRANSLATED`);
    const n = n62[p.row];
    const v = got.get(p.fileLine);
    if (!v) {
      if (run.code === 0) problems.push(`line ${p.fileLine}: ${p.code}: no Python value`);
      continue;
    }
    if (!n?.value) {
      problems.push(`line ${p.fileLine}: ${p.code}: N62 gave no number to compare`);
      continue;
    }
    if (n.noShown) {
      problems.push(`line ${p.fileLine}: ${p.code}: N62 shows ${n.noShown}, which the table does not write`);
      continue;
    }
    const re = decimalFromString(v.re.replace("E", "e"));
    const im = decimalFromString(v.im.replace("E", "e"));
    if (!re || !im) {
      problems.push(`line ${p.fileLine}: ${p.code}: Python's value ${v.re} ${v.im} i is not a number`);
      continue;
    }
    const digits = digitsOf(n.line);
    const pyText = complexAt(re, im, digits);
    const n62Text = complexAt(n.value.re, n.value.im, digits);
    compared++;
    if (pyText !== n62Text) problems.push(`line ${p.fileLine}: ${p.code}: Python ${pyText}, N62 ${n62Text} (${digits} digits)`);
  }
  for (const row of comments) {
    if (group.rows[row]?.comment) continue;
    const text = cellText(file, rows, row);
    problems.push(`row ${row + 1} (${group.rows[row]?.input ?? "?"}) is not translated: ${text}`);
  }
  return { problems, compared, comments: comments.length, file };
}

const lastLine = (s: string): string => s.trim().split("\n").filter(Boolean).pop()?.slice(0, 160) ?? "(no message)";
/** A NOT TRANSLATED row's comment line in the file. */
function cellText(file: string, rows: readonly PyRow[], row: number): string {
  const input = rows[row]?.input ?? "";
  return file.split("\n").find((l) => l.startsWith("# N62 NOT TRANSLATED") && l.endsWith(`: ${input.replace(/\s*[\r\n]+\s*/g, " ")}`)) ?? "(no comment line)";
}

/** The venv's versions of the three packages; null and why when Python or a package is missing. */
export function venvVersions(py: string | null): { ok: true; versions: Record<string, string> } | { ok: false; why: string } {
  if (!py) return { ok: false, why: `no tests/golden/.venv; set it up (tests/golden/README.md), then: ${INSTALL_LINE}` };
  const r = spawnSync(py, ["-I", "-c", "import json, sympy, pint, uncertainties; print(json.dumps({'sympy': sympy.__version__, 'pint': pint.__version__, 'uncertainties': uncertainties.__version__}))"], { encoding: "utf8", timeout: 60_000 });
  if (r.status !== 0) return { ok: false, why: `sympy, pint and uncertainties are not all in ${py} (${lastLine(r.stderr ?? "")}); install them: ${INSTALL_LINE}` };
  const versions = JSON.parse(r.stdout.trim()) as Record<string, string>;
  const off = Object.entries(PINNED).filter(([k, v]) => versions[k] !== v);
  return off.length ? { ok: false, why: `pinned ${off.map(([k, v]) => `${k} ${v}`).join(", ")}, the venv has ${off.map(([k]) => `${k} ${versions[k]}`).join(", ")}: ${INSTALL_LINE}` } : { ok: true, versions };
}

/** The main checkout (the first worktree), whose tests/golden/.venv a worktree uses. */
function mainCheckout(): string {
  const common = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: repo, encoding: "utf8" }).stdout.trim();
  return common ? resolve(common, "..") : repo;
}

/** The venv's Python, as g2check and oraclecheck find it. */
export const venvPython = (): string | null => oracleVenvPython(repo, mainCheckout());

/** `--corrupt name=py`: the function table's entry `name` writes `py` instead (to see the stage go red). */
export function corrupt(spec: string): () => void {
  const [name, py] = spec.split("=");
  const table = FUNCTIONS as Map<string, { py: string; args: number }>;
  const was = name !== undefined ? table.get(name) : undefined;
  if (!was || !py) throw new Error(`--corrupt ${spec}: not an entry name=py of the function table`);
  table.set(name as string, { ...was, py });
  return () => table.set(name as string, was);
}

async function main(): Promise<number> {
  const t0 = performance.now();
  const args = process.argv.slice(2);
  const ci = args.indexOf("--corrupt");
  if (ci >= 0) corrupt(args[ci + 1] ?? "");
  const py = venvPython();
  const venv = venvVersions(py);
  if (!venv.ok) {
    console.log(`PYDIFF FAILED: ${venv.why}`);
    return 1;
  }
  const { nodeHost } = await import("../src/engine/nodeGiac.ts");
  const { pasdegCommand } = await import("../src/engine/homeEval.ts");
  const dir = join(app, "_out/pydiff");
  const groups = readGroups();
  // G216: the unit table against pint and find/factors.yaml (scripts/pyunits-check.ts)
  const pu = pyunitsCheck(py as string);
  for (const p of pu.problems) console.log(`  pyunits: ${p}`);
  let problems = pu.problems.length;
  const units = groups.some((g) => g.rows.some((r) => r.slots)) ? unitIndex() : undefined;
  let compared = 0;
  let comments = 0;
  let rows = 0;
  for (const g of groups) {
    const host = await nodeHost();
    host.giac.eval(pasdegCommand("rad")); // R64: as the golden runner's fresh engine (scripts/golden/lib.ts)
    const r = judgeGroup(g, n62Rows(host, g.rows, units), py as string, dir);
    for (const p of r.problems) console.log(`  pydiff ${g.id}: ${p}`);
    problems += r.problems.length;
    compared += r.compared;
    comments += r.comments;
    rows += g.rows.length;
  }
  if (compared < MIN_COMPARED) problems++, console.log(`  pydiff: ${compared} rows compared, fewer than ${MIN_COMPARED}`);
  const s = ((performance.now() - t0) / 1000).toFixed(1);
  const pins = Object.entries(venv.versions).map(([k, v]) => `${k} ${v}`).join(", ");
  const counts = `${groups.length} groups, ${rows} rows: ${compared} compared at ${DIGITS} digits, ${comments} not translated; ${pu.checked} unit table entries; ${pins}; total ${s} s`;
  console.log(problems === 0 ? `PYDIFF PASSED: ${counts}` : `PYDIFF FAILED: ${problems} problem${problems > 1 ? "s" : ""}; ${counts}`);
  return problems === 0 ? 0 : 1;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(await main());
