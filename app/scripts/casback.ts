// SPDX-License-Identifier: GPL-3.0-or-later
// G64: CAS answers checked back as a gate stage (r16 section 3): an antiderivative differentiates to the integrand, a solution
// substitutes to 0, a factorisation expands back, a simplification agrees at three points (tools/probes/casback/check.ts).
// Questions: Giac's own check/ inputs (A19), G55's corpus (tests/golden/corpus.yaml, the checkable ones) and generated ones from a fixed seed.
// G798: laws that need no oracle, each side through Home as the app calls it (check.ts `checkLaw`): a float matrix A scaled by c in
// 10^±7, 10^±13 gives (c·A)·B = c·(A·B), det(c·A) = c^n·det(A), inv(c·A) = inv(A)/c, rank(c·A) = rank(A), linsolve(c·A, c·b) = linsolve(A, b)
// (the hunt's hand matrices and G797's leaves, at Digits 12 and 30); integers 0, 7, 12, 2^31 ± 1, 2^63 ± 1, 2^70 give lcm and gcd of any
// signs = those of the absolute values, ≥ 0, hamdist(a,b) = hamdist(−a−1,−b−1), b·iquo(a,b) + irem(a,b) = a. A broken law fails only
// where both sides claim their digits (=, ≈, ⚠ n); a bare ⚠ passes.
// G805: the points are compared in doubles, so a point where the sides differ is not checkable when a periodic function's argument passes
// 10^8 there (`phase` below reads it) or when they differ only past 10 digits at their size (check.ts's header has the rule).
//   node scripts/casback.ts                       # the gate stage: fixed seed, CASBACK_COUNT generated questions (default 120), 6 law matrices, exit 1 on a new failure or past 30 s
//   node scripts/casback.ts --nightly [--seed N] [--count N] [--laws N]   # rotating seed, default 1200 questions and 60 law matrices, report only (FINDING: not a known row)
// Known failures: tests/golden/casback-known.yaml (id = the question or the law, check = its kind or `law`, package = the open backlog id). Environment: GIAC_OUT.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { setGiacHostGlobals } from "../src/engine/host.ts";
import { loadNodeGiac } from "../src/engine/nodeGiac.ts";
import { EngineHost } from "../src/engine/host.ts";
import { defaultCasSettings } from "../src/engine/types.ts";
import { invariantsStage, type InvariantFailure, type KnownFailure } from "./invariants.ts";
import { generate } from "../../tools/probes/sweep/gen.ts";
import { compileDefinition } from "../src/apps/function/compile.ts";
import { SETS, loadSet, tarballPath } from "../../tools/probes/giaccheck/suite.ts";
import { checkBack, checkLaw, fromCorpus, generated, integerLawSet, LAW_MATRICES_PINNED, matrixLaws, type At, type Entries, type LawShown, type Phase, type Probe, type Question } from "../../tools/probes/casback/check.ts";
import type { ParseNode } from "../src/engine/bridge.ts";
import { generateLawMatrices } from "../../tools/probes/sweep/gen.ts";
import { shownOf } from "../../tools/probes/sweep/shown.ts";
import { defaultHomeSettings } from "../src/engine/homeEval.ts";
import { latexToGiac } from "../src/input/latex-to-giac.ts";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const nightly = args.includes("--nightly");
const flag = (name: string): number | null => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? Number(args[i + 1]) : null;
};
const GATE_SEED = 20261024;
const seed = flag("--seed") ?? (nightly ? Math.floor(Date.now() / 86_400_000) : GATE_SEED);
const count = flag("--count") ?? (nightly ? 1200 : Number(process.env["CASBACK_COUNT"] ?? 120));
const lawMatrices = flag("--laws") ?? (nightly ? 60 : 6);
const BUDGET_S = 30;
const t0 = performance.now();
setGiacHostGlobals();
const loaded = await loadNodeGiac();
const host = new EngineHost(loaded.giac, loaded.bridge);
const cas = (input: string): string => host.cas(input, defaultCasSettings).result.text;
// P20: kinds and list entries come from Giac's bridge (bridge-3), not from a regex or a bracket loop over its text.
const UNRESOLVED_HEADS: ReadonlySet<string> = new Set(["int", "integrate", "solve", "undef", "="]);
const REAL = new Set(["integer", "rational", "float", "symbolic"]);
const at: At = (expr, x) => {
  const v = loaded.bridge.value(`subs(${expr},x=${x})`, [12]);
  const p = v.at?.["12"];
  if (!REAL.has(v.kind) || !p || p.length !== 1) return null;
  const [re, im] = p[0]!;
  const r = Number(re);
  return Number(im) === 0 && Number.isFinite(r) ? r : null;
};
const entries: Entries = (text) => {
  const v = loaded.bridge.value(text, []);
  return v.kind === "list" && v.elements ? v.elements : null;
};

// G805: the largest |argument| of sin, cos, tan, sec, csc or cot in an expression at x (check.ts's rule): the value's tree (bridge-3) finds
// each such node, and its argument is Giac's own part of the expression, `(expr)[i]…[j][1]` (children as op() splits a part, from 1).
// Asked only at a point where the sides differ, so it costs nothing on the questions that agree.
const PERIODIC: ReadonlySet<string> = new Set(["sin", "cos", "tan", "sec", "csc", "cot"]);
const phase: Phase = (expr, x) => {
  const tree = loaded.bridge.value(expr, [], true).tree;
  if (!tree) return null;
  let top = 0;
  const walk = (n: ParseNode, path: string): void => {
    if (n[0] !== 1) return;
    if (PERIODIC.has(n[1]) && n[3].length === 1) {
      const v = at(`(${expr})${path}[1]`, x);
      if (v !== null) top = Math.max(top, Math.abs(v));
    }
    n[3].forEach((k, i) => walk(k, `${path}[${i + 1}]`));
  };
  walk(tree, "");
  return top;
};

const probe: Probe = (text) => ({
  kind: loaded.bridge.value(text, []).kind,
  unresolved: loaded.bridge.parse(text).heads.some((h) => UNRESOLVED_HEADS.has(h)),
});

const corpus = parse(readFileSync(resolve(repo, "tests/golden/corpus.yaml"), "utf8")) as { cases: { input: string }[] };
const fromFile = fromCorpus(corpus.cases.map((c) => c.input));
// G61's generator: expressions in x (depth 2) compiled to Giac by the function app's own compiler
const fromG61: Question[] = [];
for (const c of generate(seed, Math.ceil(count / 4), { x: true, depth: 2 })) {
  const k = compileDefinition(c.latex, "rad");
  if (k.giac !== "" && k.error === "" && !fromG61.some((q) => q.subject === k.giac)) fromG61.push({ id: `simplification: ${c.latex}`, kind: "simplification", input: `simplify(${k.giac})`, subject: k.giac });
}
// A19: Giac's own check/ inputs beside the corpus (the ones in x, in the four shapes the corpus reads; `integrate(f,x)` reads as `int(f,x)`)
const tarball = tarballPath();
/** One call whose first bracket closes at the last character (not `factor(a)/factor(b)`). */
const wholeCall = (i: string): boolean => {
  let d = 0;
  for (let k = i.indexOf("("); k < i.length; k++) {
    d += i[k] === "(" ? 1 : i[k] === ")" ? -1 : 0;
    if (d === 0) return k === i.length - 1;
  }
  return false;
};
const checkInputs = tarball ? SETS.flatMap((s) => loadSet(tarball, s).map((p) => p.input.replace(/^integrate\((.+),x\)$/, "int($1,x)"))).filter((i) => wholeCall(i) && /\bx\b/.test(i) && !/,(?![^()]*\))/.test(i.replace(/^\w+\(/, "").replace(/,x\)$/, "").replace(/\)$/, ""))) : [];
const fromCheck = fromCorpus(checkInputs);
const questions = [...fromFile.questions, ...fromCheck.questions.filter((q) => !fromFile.questions.some((o) => o.id === q.id)), ...generated(seed, count), ...fromG61];
let checked = 0;
let skipped = fromFile.skipped + fromCheck.skipped;
const failures: InvariantFailure[] = [];
// G798: laws between two inputs, each side through Home as the app calls it (latexToGiac, the law's Digits, the marks of shown.ts);
// first, so no CAS question before them changes Giac's state under them (F478: one input leaves epsilon at 1e-180)
const side = (latex: string, digits: number): LawShown => shownOf(host.home(latexToGiac(latex), { ...defaultHomeSettings, digits, workDigits: Math.max(30, digits + 10) }).result, digits);
const laws = [...LAW_MATRICES_PINNED, ...generateLawMatrices(seed, lawMatrices)].flatMap((m) => matrixLaws(m.a, m.b, m.col, m.n)).concat(integerLawSet());
for (const l of laws) {
  let left: LawShown;
  let right: LawShown;
  try {
    left = side(l.left, l.digits);
    right = side(l.right, l.digits);
  } catch {
    skipped++; // a side the keyboard's LaTeX reader refuses
    continue;
  }
  const v = checkLaw(left, right, l.digits, l.nonneg === true);
  if (v.status === "skip") skipped++;
  else {
    checked++;
    if (v.status === "wrong") failures.push({ id: l.id, check: "law", detail: `${l.right}: ${v.detail}` });
  }
}
for (const q of questions) {
  const answer = cas(q.input);
  const v = checkBack(q, answer, at, entries, probe, phase);
  if (v.status === "skip") skipped++;
  else {
    checked++;
    if (v.status === "wrong") failures.push({ id: q.id, check: q.kind, detail: `${q.input} -> ${answer}: ${v.detail}` });
  }
}
const unique = [...new Map(failures.map((f) => [`${f.id} ${f.check}`, f])).values()];
const secs = (performance.now() - t0) / 1000;
const stats = `${questions.length} questions and ${laws.length} laws (seed ${seed}): ${checked} checked, ${skipped} skipped as not checkable, ${unique.length} failed, total ${secs.toFixed(1)} s`;

const known = parse(readFileSync(resolve(repo, "tests/golden/casback-known.yaml"), "utf8")) as { known?: KnownFailure[] };
if (nightly) {
  // G798: a known row's failure (the hand matrices and the integer laws are the same every night) is not a new finding for the week
  const pkg = new Map((known.known ?? []).map((k) => [`${k.id} ${k.check}`, k.package]));
  let fresh = 0;
  for (const f of unique) {
    const p = pkg.get(`${f.id} ${f.check}`);
    if (p === undefined) fresh++;
    console.log(`${p === undefined ? "FINDING" : `known (${p})`} ${f.id} [${f.check}]: ${f.detail}`);
  }
  console.log(`CASBACK NIGHTLY: ${stats}; ${fresh} new`);
  process.exit(0);
}
const v = invariantsStage(unique, known.known ?? []);
for (const l of v.lines) console.log(`  casback ${l}`);
const ok = v.ok && secs < BUDGET_S;
console.log(`CASBACK ${ok ? "PASSED" : "FAILED"}: ${stats}; ${v.summary}${secs < BUDGET_S ? "" : ` (over ${BUDGET_S} s)`}`);
process.exit(ok ? 0 : 1);
