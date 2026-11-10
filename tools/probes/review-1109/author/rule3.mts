// SPDX-License-Identifier: GPL-3.0-or-later
// author, review round 4 of NEW-11: the rule over the unit golden rows and lists of formulas. In the check text only:
// a fixed list of pure-number functions has its first argument through pasucz; sin, cos, tan through pasuca (rad allowed);
// the inverses and atan2 through pasucz. pasumx: a + node whose terms differ in dimension. [3] refuses, [2] refuses only
// with pasumx = 1. A list file's "#REFUSE" and "#KEEP" lines set what the next rows expect.
//   FIND_INDEX_JSON=<index> GIAC_OUT=<dir> npx tsx rule3.mts <golden yaml> <list files>...
import { readFileSync } from "node:fs";
import { EngineHost } from "../../../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings, toExactLiterals } from "../../../../app/src/engine/homeEval.ts";
import { callsOf, topLevelArgs } from "../../../../app/src/engine/giacPrint.ts";
import { buildJob } from "../../../../app/src/units/build.ts";
import { withAngles } from "../../../../app/src/units/evaluate.ts";
import { BASES } from "../../../../app/src/units/dims.ts";
import { factorTable } from "../../../../app/src/units/factors.ts";
import { isUnitError } from "../../../../app/src/units/types.ts";
import { requestOf } from "../../../../app/scripts/unit-case.ts";
const PURE = ["exp", "ln", "log10", "logb", "sinh", "cosh", "tanh", "asinh", "acosh", "atanh", "sec", "csc", "cot", "floor", "ceil", "round", "trunc", "frac", "fPart", "iPart", "Gamma", "erf", "erfc", "surd"];
const TRIG = ["sin", "cos", "tan"];
const INV = ["asin", "acos", "atan", "asec", "acsc", "acot"];
const ANGLED = [...TRIG, ...INV, "atan2"];
const SLOT = /\bpas[uk]\d+\b/;
const S = `[${BASES.map((b) => b.symbol).join(",")}]`;
const RAD = `[${BASES.map((b) => (b.symbol === "pasdimA" ? "1" : "0")).join(",")}]`;
const DEFS = [
  `pasucz(x):={local q; q:=pasuq(normal(x)); if (q[0]==2 or q[0]==4 or q[0]==5) return x; if (q[0]==0 and q[1]==0*q[1]) return x; return pasubad; }`,
  `pasuca(x):={local q; q:=pasuq(normal(x)); if (q[0]==2 or q[0]==4 or q[0]==5) return subst(x,pasdimA,1); if (q[0]==0 and (q[1]==0*q[1] or q[1]==${RAD})) return subst(x,pasdimA,1); return pasubad; }`,
  ...TRIG.map((f) => `pasuc${f}(x):=${f}(pasuca(x))`),
  ...INV.map((f) => `pasuc${f}(x):=${f}(pasucz(x))*pasdimA`),
  `pasucatan2(y,x):={ if (has(pasucz(normal(y/x)),pasubad)) return pasubad; return pasdimA; }`,
  `pasumx(x):={local o,j,b,v; if (type(x)!=DOM_SYMBOLIC) { return 0; } o:=[op(x)]; if (sommet(x)=='+') { b:=[]; for (j:=0;j<size(o);j++) { v:=map(${S},k->normal(k*diff(o[j],k)/o[j])); if (lvar(v)==[]) { b:=append(b,v); } } for (j:=1;j<size(b);j++) { if (b[j]!=b[0]) { return 1; } } } for (j:=0;j<size(o);j++) { if (pasumx(o[j])) { return 1; } } return 0; }`,
];
function flagged(f: string): boolean {
  return callsOf(f, [...PURE, ...ANGLED], "typed").some((c) => c.close >= 0 && SLOT.test(f.slice(c.open + 1, c.close)));
}
function pureArgs(t: string): string {
  let out = "";
  let i = 0;
  for (const c of callsOf(t, PURE, "typed")) {
    if (c.at < i) continue;
    if (c.close < 0) break;
    const args = topLevelArgs(t.slice(c.open + 1, c.close), "typed");
    out += `${t.slice(i, c.at)}${c.name}(pasucz(${pureArgs(args[0]!)})${args.slice(1).map((a) => `,${pureArgs(a)}`).join("")})`;
    i = c.close + 1;
  }
  return out + t.slice(i);
}
const checkOnly = (t: string): string => pureArgs(t.replace(new RegExp(`\\bpasu(${[...ANGLED].join("|")})\\(`, "g"), "pasuc$1("));
const table = factorTable(JSON.parse(readFileSync(process.env.FIND_INDEX_JSON!, "utf8")));
const { giac, bridge } = await loadNodeGiac();
const host = new EngineHost(giac, bridge);
type Row = { input: string; to?: string; angle: "rad" | "deg"; src: string; expect: "keep" | "refuse" | "open" };
const lines: Row[] = [];
for (const l of readFileSync(process.argv[2]!, "utf8").split("\n")) {
  const m = /\binput:\s*"((?:[^"\\]|\\.)*)"/.exec(l);
  if (!m) continue;
  const to = /\bto:\s*"([^"]*)"/.exec(l)?.[1];
  lines.push({ input: m[1]!.replace(/\\\\/g, "\\"), ...(to ? { to } : {}), angle: /angle:\s*"deg"/.test(l) ? "deg" : "rad", src: /\bid:\s*"([^"]*)"/.exec(l)?.[1] ?? "?", expect: "keep" });
}
for (const f of process.argv.slice(3)) {
  let expect: Row["expect"] = "keep";
  for (const l of readFileSync(f, "utf8").split("\n")) {
    if (l.startsWith("#REFUSE")) { expect = "refuse"; continue; }
    if (l.startsWith("#KEEP")) { expect = "keep"; continue; }
    if (l.startsWith("#OPEN")) { expect = "open"; continue; }
    if (!l.trim() || l.startsWith("#")) continue;
    if (l.startsWith("!")) { host.cas(l.slice(1), { digits: 12, angle: "rad", format: "std" } as never); continue; }
    const [input, to, ang] = l.split("|").map((x) => x.trim());
    lines.push({ input: input!, ...(to ? { to } : {}), angle: ang === "deg" ? "deg" : "rad", src: f.replace(/.*\//, ""), expect });
  }
}
let defined = false;
const n = { rows: 0, valued: 0, refusedRight: 0, missed: 0, closed: 0, golden: 0, errs: 0 };
const say: string[] = [];
for (const c of lines) {
  n.rows++;
  const s = { ...defaultHomeSettings, angle: c.angle } as typeof defaultHomeSettings;
  try {
    const req = requestOf(c.input, c.to, table);
    const job = buildJob(req, table);
    if (isUnitError(job)) { if (c.expect === "keep" && !/^\w+$/.test(c.src)) say.push(`JOBERR ${c.input} ${JSON.stringify(job)}`); continue; }
    const r = host.units(job, s);
    if (!defined) { defined = true; for (const d of DEFS) giac.eval(d); }
    const today = isUnitError(r) ? `ERR ${JSON.stringify(r)}` : `${r.value.display} | ${r.unit}`;
    if (isUnitError(r)) { n.errs++; if (c.expect === "refuse") say.push(`  already refused: ${c.input} ${JSON.stringify(r)}`); else if (!/^[a-z]\d/.test(c.src) && c.src !== "?") say.push(`  today an error, on a KEEP list: ${c.input} ${JSON.stringify(r)}`); continue; }
    n.valued++;
    let kind = "-", mx = "-", rule = "ok";
    if ((flagged(req.formula) || job.checkSum === true) && job.check !== undefined) {
      const t = checkOnly(withAngles(toExactLiterals(job.check)));
      kind = giac.eval(`pasuq(normal(${t}))`).slice(0, 36);
      if (kind.startsWith("[3")) rule = "REFUSE-3";
      else if (kind.startsWith("[2")) { mx = giac.eval(`pasumx(normal(${t}))`); if (mx === "1") rule = "REFUSE-mix"; }
      else if (kind.startsWith("GIAC_ERROR")) say.push(`  check error: ${c.input} ${kind}`);
    }
    if (c.expect === "open") say.push(`OPEN: ${c.input} | today ${today} | rule ${rule} | kind ${kind} | mx ${mx}`);
    if (rule !== "ok" && c.expect === "keep") { n.refusedRight++; if (/^[a-z]\d|^\?/.test(c.src) || c.src === "?") n.golden++; say.push(`REFUSED A RIGHT ANSWER (${c.src}): ${c.input} ${c.to ?? ""} | today ${today} | kind ${kind} | mx ${mx}`); }
    if (rule === "ok" && c.expect === "refuse") { n.missed++; say.push(`MISSED (${c.src}): ${c.input} | today ${today} | kind ${kind} | mx ${mx}`); }
    if (rule !== "ok" && c.expect === "refuse") n.closed++;
  } catch (e) { say.push(`THROW ${c.src} ${c.input} ${(e as Error).message.slice(0, 100)}`); }
}
for (const l of say) console.log(l);
console.log(JSON.stringify(n));
void bridge;
