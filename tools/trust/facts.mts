// SPDX-License-Identifier: GPL-3.0-or-later
// A93: the facts behind README.md's "Why trust it" section and tests/golden/README.md's table, read from the files so no
// number is typed by hand: the golden cases (rows, sources, `status: pending`), oracle-counts.json (G202), the Giac patch
// files and the Status column of engine/giac/patches/README.md, and the trap rows `trust-*` / `g39-int-1/x-pv`.
// Pure reading: no clock, no host. `node tools/trust/cli.mts check|refresh` (npm run trust:check / trust:refresh, from app/).
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
/** `yaml` lives in app/node_modules; this file sits in tools/, so it is found through app/package.json. */
const { parse } = createRequire(join(HERE, "..", "..", "app", "package.json"))("yaml") as { parse: (text: string) => unknown };

/** The checkout this file belongs to. */
export const REPO_ROOT = resolve(HERE, "..", "..");

/** The golden files that hold recorded answers, and the two that do not (their rows are counted, not claimed). */
export const ANSWER_FILES = ["home.yaml", "precision.yaml", "units.yaml", "solve.yaml", "function.yaml"] as const;
export const OTHER_FILES = ["parser.yaml", "bench.yaml"] as const;

/** The fixed forms of the Status column in engine/giac/patches/README.md. */
export const PATCH_STATUS_FORMS = ["author says integrated", "applied, with differences", "sent <YYYY-MM-DD>", "not sent"] as const;
const STATUS_RE = /^(author says integrated|applied, with differences|sent \d{4}-\d{2}-\d{2}|not sent)$/;
/** The date of the author's source that the sentence names ("his 7 Nov source"); the one constant beside the Status column. */
export const AUTHOR_SOURCE_DATE = "7 Nov";

export interface FileFacts {
  readonly rows: number;
  /** Rows with `status: pending`. */
  readonly pending: number;
}
export interface GoldenFacts {
  readonly files: Readonly<Record<string, FileFacts>>;
  /** Rows of home, precision, units, solve and function. */
  readonly answers: number;
  /** Of those, `status: pending`. */
  readonly open: number;
  /** `source: oracle`. */
  readonly computed: number;
  /** oracle-counts.json: a computed value that is an int or a Fraction. */
  readonly exact: number;
  /** oracle-counts.json: the other computed values. */
  readonly mpmath: number;
  /** Another source with an `oracle:` field. */
  readonly crossChecked: number;
  /** The rest. */
  readonly handOrGuard: number;
  /** The rows the trap table reads, by id. */
  readonly traps: Readonly<Record<string, { readonly expect: string; readonly note: string }>>;
}
export interface PatchFacts {
  readonly files: readonly string[];
  readonly rows: readonly { readonly patch: string; readonly status: string }[];
  readonly total: number;
  /** author says integrated + applied + waiting. */
  readonly sent: number;
  readonly reported: number;
  readonly applied: number;
  readonly waiting: number;
  readonly notSent: number;
  /** Rows without a file, files without a row, values outside the fixed forms. */
  readonly problems: readonly string[];
}
export interface TrustFacts {
  readonly golden: GoldenFacts;
  readonly patches: PatchFacts;
}

interface Row {
  id?: unknown;
  source?: unknown;
  status?: unknown;
  oracle?: unknown;
  expect?: unknown;
  note?: unknown;
}

function casesOf(path: string): Row[] {
  const doc = parse(readFileSync(path, "utf8")) as { cases?: Row[] } | null;
  return doc?.cases ?? [];
}

const TRAP_IDS = (id: string): boolean => id.startsWith("trust-") || id === "g39-int-1/x-pv";

export function goldenFacts(root: string = REPO_ROOT): GoldenFacts {
  const dir = join(root, "tests", "golden");
  const files: Record<string, FileFacts> = {};
  const traps: Record<string, { expect: string; note: string }> = {};
  let answers = 0, open = 0, computed = 0, crossChecked = 0;
  for (const name of [...ANSWER_FILES, ...OTHER_FILES]) {
    const rows = casesOf(join(dir, name));
    files[name] = { rows: rows.length, pending: rows.filter((r) => r.status === "pending").length };
    if (!(ANSWER_FILES as readonly string[]).includes(name)) continue;
    for (const r of rows) {
      answers += 1;
      if (r.status === "pending") open += 1;
      if (r.source === "oracle") computed += 1;
      else if (typeof r.oracle === "string") crossChecked += 1;
      if (typeof r.id === "string" && TRAP_IDS(r.id)) traps[r.id] = { expect: String(r.expect ?? ""), note: String(r.note ?? "") };
    }
  }
  const counts = JSON.parse(readFileSync(join(dir, "oracle-counts.json"), "utf8")) as { exact: number; mpmath: number };
  return {
    files, answers, open, computed, exact: counts.exact, mpmath: counts.mpmath, crossChecked,
    handOrGuard: answers - computed - crossChecked, traps,
  };
}

/** The cells of a table row; `\|` stays inside its cell. */
function cells(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((c) => c.trim());
}

export function patchFacts(root: string = REPO_ROOT): PatchFacts {
  const dir = join(root, "engine", "giac", "patches");
  const files = readdirSync(dir).filter((f) => f.endsWith(".patch")).sort();
  const problems: string[] = [];
  const rows: { patch: string; status: string }[] = [];
  const lines = readFileSync(join(dir, "README.md"), "utf8").split("\n");
  const start = lines.findIndex((l) => l.startsWith("| Patch |"));
  if (start < 0) problems.push("patches/README.md: no table with a Patch column");
  else {
    const head = cells(lines[start] ?? "").map((h) => h.toLowerCase());
    const col = head.indexOf("status");
    if (col < 0) problems.push("patches/README.md: the table has no Status column");
    for (let i = start + 2; i < lines.length && (lines[i] ?? "").startsWith("|"); i += 1) {
      const c = cells(lines[i] ?? "");
      const patch = (c[0] ?? "").replace(/`/g, "");
      const status = col < 0 ? "" : (c[col] ?? "");
      rows.push({ patch, status });
      if (c.length !== head.length) problems.push(`${patch}: ${c.length} cells, the table has ${head.length}`);
      if (col >= 0 && !STATUS_RE.test(status)) problems.push(`${patch}: Status "${status}" is not one of ${PATCH_STATUS_FORMS.join(", ")}`);
    }
  }
  for (const f of files) if (!rows.some((r) => r.patch === f)) problems.push(`${f}: no row in patches/README.md`);
  for (const r of rows) if (!files.includes(r.patch)) problems.push(`${r.patch}: a row without a patch file`);
  const n = (re: RegExp): number => rows.filter((r) => re.test(r.status)).length;
  const reported = n(/^author says integrated$/), applied = n(/^applied, with differences$/), waiting = n(/^sent \d/);
  return { files, rows, total: files.length, sent: reported + applied + waiting, reported, applied, waiting, notSent: n(/^not sent$/), problems };
}

export function trustFacts(root: string = REPO_ROOT): TrustFacts {
  return { golden: goldenFacts(root), patches: patchFacts(root) };
}

/** 1966 → "1,966". */
export function group(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** The three paragraphs of the section's prose, separated by a blank line. */
export function trustSentences(f: TrustFacts): string {
  const g = f.golden, p = f.patches;
  return [
    `${group(g.answers)} recorded answers, ${group(g.open)} of them open cases. ${group(g.computed)} expected values are computed independently of Giac (${group(g.mpmath)} by mpmath, ${group(g.exact)} by exact arithmetic); ${group(g.crossChecked)} more are hand-derived or reference values cross-checked by machine; the other ${group(g.handOrGuard)} are hand-derived expected results or behaviour guards.`,
    `${group(p.total)} Giac patches. ${group(p.sent)} sent to the author: he wrote that ${group(p.reported)} should be integrated and applied ${group(p.applied)} in his ${AUTHOR_SOURCE_DATE} source, with differences being resolved; ${group(p.waiting)} more wait for his answer; ${group(p.notSent)} not sent.`,
    "When the engine, the parser or the units change, the golden gate re-runs the answers; when a golden file changes, the oracle recomputes the expected values.",
  ].join("\n\n");
}

/** What an ordinary IEEE double gives for each trap (not measured by the repo's tests; a literal beside the traps). */
const TRAPS: readonly {
  readonly label: string;
  readonly id: string;
  readonly truth: RegExp | string;
  readonly double: string;
}[] = [
  { label: "Rump's expression at (77617, 33096)", id: "trust-rump-12", truth: /exactly (-?\d+\/\d+)/, double: "about ±1.18E21; the sign depends on evaluation order" },
  { label: "`1-cos(10⁻⁸)` (RAD)", id: "trust-cos-12", truth: /trap \d\. ([-\d.E+]+)/, double: "0" },
  { label: "`(1+10⁻¹⁶)^(10¹⁶)`", id: "trust-limit-12", truth: /trap \d\. ([-\d.E+]+)/, double: "1" },
  { label: "`e^(π√163)` at 30 digits", id: "trust-ramanujan-30", truth: /trap \d\. ([-\d.E+]+)/, double: "2.6253741264076826E17" },
  { label: "`∫ 1/x dx` from -1 to 1", id: "g39-int-1/x-pv", truth: "diverges", double: "n/a" },
];

/** The trap table (markdown): N62's shown value and the true value come from the golden rows. */
export function trapTable(f: TrustFacts): string {
  const out = ["| Trap | N62 | True value | Ordinary IEEE double |", "|---|---|---|---|"];
  for (const t of TRAPS) {
    const row = f.golden.traps[t.id];
    if (!row) throw new Error(`trust: no golden row ${t.id}`);
    const shown = t.id === "g39-int-1/x-pv" ? `refused: "${row.expect}"` : `≈ ${row.expect}`;
    const truth = typeof t.truth === "string" ? t.truth : (t.truth.exec(row.note)?.[1] ?? "");
    if (!truth) throw new Error(`trust: no true value in the note of ${t.id}`);
    out.push(`| ${t.label} | ${shown} | ${truth} | ${t.double} |`);
  }
  return out.join("\n");
}

export const TRAP_CAPTION = "*The sign of the first double depends on the order the expression is evaluated in; the other doubles are what a plain IEEE double returns.*";

/** The whole generated block of README.md (between its trust markers). */
export function trustBlock(f: TrustFacts): string {
  return `${trustSentences(f)}\n\n${trapTable(f)}\n\n${TRAP_CAPTION}`;
}

export const MARK_BEGIN = "<!-- trust:begin (generated by npm run trust:refresh; do not edit by hand) -->";
export const MARK_END = "<!-- trust:end -->";

/** The expected second cell of each tests/golden/README.md row, by file. */
export function goldenCells(g: GoldenFacts): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, fl] of Object.entries(g.files)) out[name] = fl.pending > 0 ? `${fl.rows} (${fl.pending} \`pending\`)` : String(fl.rows);
  out["oracle-counts.json"] = `\`{ "exact": ${g.exact}, "mpmath": ${g.mpmath} }\``;
  return out;
}

const ROW_RE = /^(\| `([^`]+)` \| )([^|]*?)( \|.*)$/;

/** tests/golden/README.md with the count cells rewritten from the facts. */
export function rewriteGoldenReadme(text: string, g: GoldenFacts): string {
  const want = goldenCells(g);
  return text.split("\n").map((line) => {
    const m = ROW_RE.exec(line);
    const cell = m?.[2] === undefined ? undefined : want[m[2]];
    return m && cell !== undefined ? `${m[1]}${cell}${m[4]}` : line;
  }).join("\n");
}

/** Where tests/golden/README.md disagrees with the facts. */
export function goldenReadmeProblems(text: string, g: GoldenFacts): string[] {
  const want = goldenCells(g);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of text.split("\n")) {
    const m = ROW_RE.exec(line);
    const name = m?.[2];
    if (!m || name === undefined || want[name] === undefined) continue;
    seen.add(name);
    if (m[3] !== want[name]) out.push(`tests/golden/README.md: ${name} says "${m[3]}", the files say "${want[name]}"`);
  }
  for (const name of Object.keys(want)) if (!seen.has(name)) out.push(`tests/golden/README.md: no table row for ${name}`);
  return out;
}

/** README.md with the block between the trust markers replaced. */
export function rewriteReadme(text: string, f: TrustFacts): string {
  const a = text.indexOf(MARK_BEGIN), b = text.indexOf(MARK_END);
  if (a < 0 || b < a) throw new Error("README.md: the trust markers are missing");
  return `${text.slice(0, a + MARK_BEGIN.length)}\n\n${trustBlock(f)}\n\n${text.slice(b)}`;
}

/** Where README.md disagrees with the facts: the sentences word for word, the trap table. */
export function readmeProblems(text: string, f: TrustFacts): string[] {
  const out: string[] = [];
  if (!text.includes(trustSentences(f))) out.push("README.md: the Why trust it sentences differ from the files' facts");
  if (!text.includes(trapTable(f))) out.push("README.md: the trap table differs from the golden rows");
  return out;
}

/** Everything `trust:check` tests; empty means fresh. */
export function trustProblems(root: string = REPO_ROOT): string[] {
  const f = trustFacts(root);
  const g = f.golden;
  const out = [...f.patches.problems];
  if (g.mpmath + g.exact !== g.computed) out.push(`oracle-counts.json: mpmath ${g.mpmath} + exact ${g.exact} is not the ${g.computed} computed rows (run trust:refresh)`);
  out.push(...goldenReadmeProblems(readFileSync(join(root, "tests", "golden", "README.md"), "utf8"), g));
  out.push(...readmeProblems(readFileSync(join(root, "README.md"), "utf8"), f));
  return out;
}

/** The python for oracle.py: ORACLE_PYTHON, the tree's venv, the main checkout's venv, else python3. */
export function oraclePython(root: string): string {
  const venv = (r: string): string => join(r, "tests", "golden", ".venv", "bin", "python");
  if (process.env["ORACLE_PYTHON"]) return process.env["ORACLE_PYTHON"];
  if (existsSync(venv(root))) return venv(root);
  const main = process.env["MAIN"];
  return main && existsSync(venv(main)) ? venv(main) : "python3";
}
