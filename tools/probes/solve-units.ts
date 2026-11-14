// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (S45, docs/research/r-solveunits.md): the facts the units-inside-Solve note rests on.
//   1. the parser: Home mode refuses a unit in an equation; units mode reads an equation with slots;
//   2. the unknown's dimension from the terms' exponents: each unknown U as U·pasdimU (a base of its own), each term's
//      exponents read on the bases and the pasdimU, then homogeneity (every term of an equation one dimension) solved
//      for U's exponents with Giac's linsolve: one answer, none (a mismatch) or a free one (not fixed by the equations);
//   3. the substitute-back rule in SI numbers: solve1's |f|/max(1,|left|,|right|) for a wrong root of Q = C·V with
//      C = 1 pF, Q = 3 pC, in SI (C = 10^-12) and in the typed units (pF, pC), exact in Giac;
//   4. today's solver on one system in SI numbers and in the typed units: shown digits, mark facts, ⚠.
//
//   node tools/probes/solve-units.ts
//
// Engine: $GIAC_MJS, else $GIAC_OUT/giac.mjs, else engine/giac/_out/gsl. Only erasable TypeScript syntax.
import { EngineHost } from "../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings } from "../../app/src/engine/homeEval.ts";
import { latexToGiac, latexToGiacInfo } from "../../app/src/input/latex-to-giac.ts";
import { BASES } from "../../app/src/units/dims.ts";

console.log("## 1. parser");
for (const [latex, units] of [
  ["X=3\\unit{unit:m}{m}", false],
  ["d=3\\placeholder[u1]{}\\cdot t", true],
  ["X\\cdot2\\placeholder[u1]{}=6\\placeholder[u2]{}", true],
] as [string, boolean][]) {
  try {
    const r = units ? latexToGiacInfo(latex, { units: true }) : { giac: latexToGiac(latex), units: undefined };
    console.log(`${units ? "units" : "home "} ${JSON.stringify(latex)} => ${JSON.stringify(r.giac)}${r.units ? ` slots ${r.units.slots.length}` : ""}`);
  } catch (e) {
    console.log(`${units ? "units" : "home "} ${JSON.stringify(latex)} => ERROR ${(e as Error).message}`);
  }
}

const { giac, bridge } = await loadNodeGiac();
const host = new EngineHost(giac, bridge);
const ev = (t: string): string => giac.eval(t);
for (const b of BASES) ev(`assume(${b.symbol}>0)`);

console.log("\n## 2. the unknown's dimension (bases M L T …, a known with a unit is factor × dimension symbols)");
const names = BASES.map((b) => b.name);
/** The dimension of each unknown in `eqs` (Giac text, lhs=rhs), or why there is none. */
function dimensions(eqs: string[], unknowns: string[]): string {
  const S = [...BASES.map((b) => b.symbol), ...unknowns.map((u) => `pasdim${u}`)];
  const E = unknowns.map((u) => BASES.map((b) => `pase${u}${b.name.replace(/\W/g, "x")}`));
  const constraints: string[] = [];
  for (const eq of eqs) {
    const sub = `subst(${eq},[${unknowns.join(",")}],[${unknowns.map((u) => `${u}*pasdim${u}`).join(",")}])`;
    const f = `expand(normal(left(${sub})-right(${sub})))`;
    const terms = ev(`pasT:=when(sommet(${f})=='+',[op(${f})],[${f}])`);
    const n = Number(ev("size(pasT)"));
    const rows: string[][] = [];
    for (let j = 0; j < n; j++) {
      const r = S.map((d) => ev(`normal(${d}*diff(pasT[${j}],${d})/pasT[${j}])`));
      if (r.some((x) => !/^-?\d+(\/\d+)?$/.test(x))) return `refused: a term of ${eq} is no monomial in the units (${terms})`;
      rows.push(r);
    }
    // each term's dimension: its base exponents + Σ_u k_u · e_u; all terms of one equation equal
    const dim = (r: string[]): string[] => BASES.map((_, b) => [r[b], ...unknowns.map((_, u) => `(${r[BASES.length + u]})*${E[u]![b]}`)].join("+"));
    for (let j = 1; j < rows.length; j++) dim(rows[j]!).forEach((x, b) => constraints.push(`${x}=${dim(rows[0]!)[b]}`));
  }
  const vars = E.flat();
  const sol = ev(`linsolve([${constraints.join(",")}],[${vars.join(",")}])`);
  if (sol === "[]") return "refused: the units do not match (no dimension of the unknowns fits every term)";
  const vals = sol.replace(/^\[|\]$/g, "").split(",");
  if (vals.some((v, i) => v.trim() === vars[i])) return `refused: the equations do not fix the unit (free: ${vars.filter((v, i) => vals[i]!.trim() === v).join(" ")})`;
  return unknowns.map((u, i) => `${u}: ${names.map((nm, b) => (vals[i * BASES.length + b]!.trim() === "0" ? "" : `${nm}^${vals[i * BASES.length + b]!.trim()}`)).filter(Boolean).join("·") || "pure number"}`).join(", ");
}
const L = "pasdimL", T = "pasdimT", M = "pasdimM";
for (const [eqs, us, why] of [
  [[`X*(2*${T})=6*${L}`], ["X"], "v·t = d"],
  [[`X^2=9*${L}^2`], ["X"], "a square"],
  [[`X+3*${L}=5*${L}`], ["X"], "a sum"],
  [[`X+3*${L}=5*${T}`], ["X"], "a mismatch"],
  [[`2*X=X`], ["X"], "X cancels: not fixed"],
  [[`X*Y=6*${L}^2`, `X-Y=1*${L}`], ["X", "Y"], "a system"],
  [[`1/2*${M}*X^2=8*${M}*${L}^2/${T}^2`], ["X"], "kinetic energy, a half power"],
  [[`exp(X)=2`], ["X"], "inside a function"],
] as [string[], string[], string][]) {
  const t0 = performance.now();
  const d = dimensions(eqs, us);
  console.log(`${why}: ${eqs.join(" ; ")} => ${d} (${(performance.now() - t0).toFixed(0)} ms)`);
}

console.log("\n## 3. the residual |f|/max(1,|left|,|right|) at a wrong root V = 3.0003 (true 3), warn above 1e-15");
for (const [label, c, q] of [["SI numbers (C=10^-12, Q=3*10^-12)", "10^-12", "3*10^-12"], ["typed units (pF, pC)", "1", "3"]] as const) {
  const v = "30003/10000";
  const rr = ev(`evalf(abs(${q}-${c}*${v})/max(1,abs(${q}),abs(${c}*${v})),20)`);
  console.log(`${label}: rr = ${rr} → ${Number(rr) > 1e-15 ? "⚠ (caught)" : "passes as a root"}`);
}

console.log("\n## 4. today's solver: X·Y = 6, X + Y = 5 from guesses 1.5, 3.5, in SI numbers (pm) and in pm");
const s = { ...defaultHomeSettings };
for (const [label, k] of [["SI numbers", "10^-12"], ["typed units", "1"]] as const) {
  const o = host.solve({ kind: "equations", equations: [`X*Y=6*(${k})^2`, `X+Y=5*(${k})`], unknowns: ["X", "Y"], guesses: [`1.5*${k}`, `3.5*${k}`] }, s);
  const roots = o.roots.map((r) => `${r.name}=${r.result.display} (digits ${r.result.facts.reliableDigits})`).join(", ");
  console.log(`${label}: ok ${o.ok}, warn ${o.warn}, rr ${o.residualRel?.toExponential(1)}, ${roots}; ${o.info}`);
}
