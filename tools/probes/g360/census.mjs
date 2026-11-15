// SPDX-License-Identifier: GPL-3.0-or-later
// G360: Giac's other spellings of the decision functions (decisions.ts DECISION_FUNCTIONS, LOGS,
// COMPLEX_DECISION_FUNCTIONS, RATIONAL_FUNCTIONS): every name whose evaluator is one of theirs, as G304's census.
//   GIAC_SRC=<unpacked giac-2.1.0> [GIAC_OUT=<dir with giac.mjs>] node tools/probes/g360/census.mjs
// Three sources: doc/aide_cas's `# name synonym…` lines; every `define_unary_function_eval*(__u, &f, name_s)` in src/*.cc
// (names grouped by their evaluator f); the lexer's `"name" … gen(at_x` lines (src/input_lexer.ll). With GIAC_OUT each
// spelling and its canonical name are evaluated on the raw engine (plain giac_eval, Digits 12) for a check by eye.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SRC = process.env.GIAC_SRC;
if (!SRC) throw new Error("GIAC_SRC: the unpacked Giac source");
const CANONICAL = [
  "floor", "ceil", "round", "trunc", "frac", "fPart", "iPart", "sign", "Heaviside", "abs", "max", "min", "piecewise", "when",
  "ifte", "int", "integrate", "sum", "limit", "solve", "arg", "angle", "instphase", "norm", "normalize", "polar",
  "polar_coordinates", "tri", "dfc", "classes", "Psi", "surd", "atan2", "sort", "SortA", "SortD", "sorta", "sortd", "sortperm",
  "ln", "log", "log10", "logb", "asin", "acos", "acosh", "product", "irem", "iquo", "gcd", "lcm", "comb", "factorial",
];

// 1. the source: unary function objects, their printed name and evaluator; at_x -> object
const evalOf = new Map(); // name -> evaluator
const unaryOf = new Map(); // at_x -> name
for (const f of readdirSync(join(SRC, "src")).filter((f) => f.endsWith(".cc"))) {
  const text = readFileSync(join(SRC, "src", f), "utf8");
  const strs = new Map([...text.matchAll(/static const char (\w+)\s*\[\]\s*=\s*"([^"]*)"/g)].map((m) => [m[1], m[2]]));
  const objs = new Map();
  for (const m of text.matchAll(/define_unary_function_eval\w*\s*\(([^;]*)\)\s*;/g)) {
    // the arguments at depth 0: [index,] object, evaluator, …, name_s (a cast in brackets may lead the evaluator)
    const args = [];
    let depth = 0;
    let cur = "";
    for (const ch of m[1]) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (ch === "," && depth === 0) (args.push(cur.trim()), (cur = ""));
      else cur += ch;
    }
    args.push(cur.trim());
    if (/^\d+$/.test(args[0])) args.shift();
    const name = strs.get(args.findLast((a) => strs.has(a)) ?? "");
    if (name === undefined) continue;
    const ev = args[1].replace(/^\([^)]*\)\s*/, "").replace(/^&\s*/, "");
    objs.set(args[0], name);
    if (!evalOf.has(name)) evalOf.set(name, `${ev} (${f})`);
  }
  for (const m of text.matchAll(/define_unary_function_ptr\d?\s*\(\s*(\w+)\s*,\s*\w+\s*,\s*&\s*(\w+)/g)) {
    if (objs.has(m[2])) unaryOf.set(m[1], objs.get(m[2]));
  }
}
const fn = (name) => evalOf.get(name)?.split(" ")[0];
const found = new Map(); // spelling -> { canonical, how }
const add = (alias, canonical, how) => {
  if (alias === canonical || CANONICAL.includes(alias)) return;
  const k = found.get(alias);
  if (k) k.how.add(how);
  else found.set(alias, { canonical, how: new Set([how]) });
};
for (const c of CANONICAL) {
  const e = fn(c);
  if (!e) continue;
  for (const [name, ev] of evalOf) if (ev.split(" ")[0] === e) add(name, c, `evaluator ${ev}`);
}
// 2. the lexer
const lexer = readFileSync(join(SRC, "src", "input_lexer.ll"), "utf8");
for (const m of lexer.matchAll(/^"([^"]+)"[^\n]*?gen\(\s*(at_\w+)/gm)) {
  const target = unaryOf.get(m[2]);
  if (target && CANONICAL.includes(target)) add(m[1], target, `lexer ${m[2]}`);
}
// 3. aide_cas
const aide = readFileSync(join(SRC, "doc", "aide_cas"), "latin1");
for (const m of aide.matchAll(/^# (.+)$/gm)) {
  const names = m[1].trim().split(/\s+/);
  const c = names.find((n) => CANONICAL.includes(n));
  if (c) for (const n of names) add(n, c, `aide_cas "# ${m[1].trim()}"`);
}
console.log("# spelling -> canonical: how found");
for (const [alias, { canonical, how }] of [...found].sort((a, b) => a[1].canonical.localeCompare(b[1].canonical) || a[0].localeCompare(b[0]))) {
  console.log(`${JSON.stringify(alias)} -> ${canonical}: ${[...how].join("; ")}${fn(alias) ? "" : " (no evaluator of its own)"}`);
}
// 4. read by hand (rpn.cc): an evaluator of its own whose body is a canonical one's (checked on the raw engine below)
const SAME_BODY = {
  IP: ["trunc", "_INT: floor for a proven x >= 0, ceil for a proven x < 0, each part of a complex (trunc's split; an exact integer)"],
  FP: ["fPart", "FP: g-_INT(g), fPart's body (fPart also maps a list)"],
  ABS: ["abs", "_ABS: abs, a list's l2norm (norm)"],
  SIGN: ["sign", "sign, the function _sign maps over a list"],
};
for (const [alias, [canonical, how]] of Object.entries(SAME_BODY)) add(alias, canonical, `same body: ${how}`);
console.log("# spelling -> canonical: how found (after the hand reading)");
for (const alias of Object.keys(SAME_BODY)) console.log(`${JSON.stringify(alias)} -> ${found.get(alias).canonical}: ${[...found.get(alias).how].join("; ")}`);
// the canonical names' evaluators, for the same-body reading (IP, FP)
console.log("\n# evaluators");
for (const c of [...CANONICAL, "IP", "FP", "TRUNCATE"]) console.log(`${c}: ${evalOf.get(c) ?? "-"}`);

if (process.env.GIAC_OUT) {
  const { default: createGiacModule } = await import(`${process.env.GIAC_OUT}/giac.mjs`);
  globalThis.UI = { add_evalf: 0, js_bigint: 0, disable3d: -1, Datestart: Date.now() };
  const M = await createGiacModule({ print: () => {}, printErr: () => {} });
  M.cwrap("giac_init", "number", [])();
  const ev = M.cwrap("giac_eval", "string", ["string"]);
  const ARGS = { max: "(-3/2,1/2)", min: "(-3/2,1/2)", MAX: "(-3/2,1/2)", MIN: "(-3/2,1/2)", trunc: "(-3/2)", sum: "(k,k,1,3)", product: "(k,k,1,3)", log10: "(100)", ln: "(1.)", logb: "(8,2)", int: "(x,x,0,1)", integrate: "(x,x,0,1)", limit: "(x,x,1)", solve: "(x=1,x)", irem: "(7,3)", iquo: "(7,3)", gcd: "(4,6)", lcm: "(4,6)", comb: "(5,2)", sort: "([3,1,2])", when: "(1>0,1,2)", ifte: "(1>0,1,2)", piecewise: "(1>0,1,2)", atan2: "(1.,1.)", surd: "(-8,3)" };
  const arg = (c) => ARGS[c] ?? "(-1.5)";
  console.log("\n# raw engine, Digits 12: spelling | canonical");
  for (const [alias, { canonical }] of found) {
    const a = arg(canonical);
    console.log(`${alias}${a} = ${ev(`${alias}${a}`)} | ${canonical}${a} = ${ev(`${canonical}${a}`)} | quote: ${ev(`quote(${alias}${a})`)}`);
  }
  console.log("\n# be-7: a decision at Digits 12 (sin(10^70)*10^12 = -148099131371.55…, mpmath)");
  for (const [alias, { canonical }] of found) {
    if (!["floor", "ceil", "round", "trunc", "fPart", "iPart", "sign", "abs"].includes(canonical)) continue;
    console.log(`${alias}(sin(10^70)*10^12) = ${ev(`${alias}(sin(10^70)*10^12)`)} | ${canonical}(…) = ${ev(`${canonical}(sin(10^70)*10^12)`)}`);
  }
  console.log(`MAX(sin(10^70),0) = ${ev("MAX(sin(10^70),0)")} | max(…) = ${ev("max(sin(10^70),0)")}`);
  console.log(`SIGN(0) = ${ev("SIGN(0)")} | SIGN([-2,3]) = ${ev("SIGN([-2,3])")} | sign([-2,3]) = ${ev("sign([-2,3])")} | ABS([3,4]) = ${ev("ABS([3,4])")} | abs([3,4]) = ${ev("abs([3,4])")}`);
  console.log(`IP(-1.5) = ${ev("IP(-1.5)")} | trunc(-1.5) = ${ev("trunc(-1.5)")} | iPart(-1.5) = ${ev("iPart(-1.5)")}`);
  console.log(`FP(-1.5) = ${ev("FP(-1.5)")} | fPart(-1.5) = ${ev("fPart(-1.5)")} | frac(-1.5) = ${ev("frac(-1.5)")}`);
}
