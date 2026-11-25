// SPDX-License-Identifier: GPL-3.0-or-later
// G797: the oracle sweep builds matrices. The generator (a seed gives 2×2 and 3×3 matrices of the scalar leaves, scaled by 10^k with k in
// −15..15, approx(…) around a whole matrix, every node kind), the oracle bridge (mpmath matrix, inverse, det, lu_solve, expm, sinm,
// cosm, rank by SVD; expected values derived by hand or from mpmath's scalar functions by another route), the judge entry by entry
// (made-up oracles for its rules, as sweep.test.ts), and the pinned hunt inputs through the real engine (red on phase-1: missed there).
import { describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decimalFromString, ZERO_VALUE, type ComplexValue } from "../src/engine/format.ts";
import { giacAvailable } from "../src/engine/nodeGiac.ts";
import { latexToGiac } from "../src/input/latex-to-giac.ts";
import { generate, generateMatrices, matrixChildrenOf, MATRIX_PINNED } from "../../tools/probes/sweep/gen.ts";
import { judge, type Oracle, type Shown } from "../../tools/probes/sweep/judge.ts";
import { oracleFor, pythonFor, runsOf, sweep, type Run } from "../../tools/probes/sweep/run.ts";
import { loadKnown, sweepFailures } from "./sweep-known.ts";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const mainCheckout = resolve(spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: repo, encoding: "utf8" }).stdout.trim() || resolve(repo, ".git"), "..");
const oraclePy = resolve(repo, "tools/probes/sweep/oracle.py");
const oracle = (mps: string[], deg = false): Oracle[] => oracleFor(mps.map((mp) => ({ latex: mp, mp, angle: deg ? "deg" : "rad", digits: 12 })), pythonFor(repo, mainCheckout), oraclePy);
const sha = (x: unknown): string => createHash("sha256").update(JSON.stringify(x)).digest("hex");

describe("the matrix generator (G797)", () => {
  const cs = generateMatrices(20261021, 400);
  const sizes = (latex: string): number[] => [...latex.matchAll(/\\begin\{pmatrix\}(.*?)\\end\{pmatrix\}/g)].map((m) => m[1]!.split("\\\\").length);

  it("is deterministic and leaves the scalar trees and runs of a seed as they were", () => {
    expect(sha(generateMatrices(20261021, 400))).toBe(sha(cs));
    expect(sha(generateMatrices(20261022, 400))).not.toBe(sha(cs));
    expect(sha(generate(20261021, 1000))).toBe("1452a2fcc5896d979f067fef991adc9dab127ccb81c908545927bdcd25406d39");
    expect(sha(runsOf(20261021, 1000))).toBe("df26d42fcff7a461f9eb349d30e2a2c8f5b9f7247e3ae2fad67a9c5d5499ddca");
    const withM = runsOf(20261021, 1000, false, { matrices: 100 });
    expect(sha(withM.slice(0, 1187))).toBe("df26d42fcff7a461f9eb349d30e2a2c8f5b9f7247e3ae2fad67a9c5d5499ddca");
    // the pinned inputs, the sin in RAD and DEG (G802 put two after it)
    expect([...new Set(withM.slice(1187, 1187 + MATRIX_PINNED.length + 1).map((r) => r.latex))]).toEqual(MATRIX_PINNED.map((c) => c.latex));
    expect(runsOf(20261021, 100, true, { matrices: 0 })).toEqual(runsOf(20261021, 100, true));
  });

  it("a seed gives 2×2 and 3×3 matrices, the columns of linsolve and products among them", () => {
    const all = cs.flatMap((c) => sizes(c.latex));
    expect(all.filter((n) => n === 2).length).toBeGreaterThan(100);
    expect(all.filter((n) => n === 3).length).toBeGreaterThan(50);
    expect(new Set(all)).toEqual(new Set([2, 3]));
    // every matrix literal is square or a column of the same size
    for (const c of cs) for (const m of c.latex.matchAll(/\\begin\{pmatrix\}(.*?)\\end\{pmatrix\}/g)) {
      const rows = m[1]!.split("\\\\").map((r) => r.split("&").length);
      expect(rows.every((k) => k === rows[0]) && (rows[0] === rows.length || rows[0] === 1), m[0]).toBe(true);
    }
  });

  it("takes the entries from the scalar leaves, scales by 10^k with k in −15..15, and wraps approx(…) around a whole matrix", () => {
    const ks = cs.flatMap((c) => [...c.latex.matchAll(/10\^\{(-?\d+)\}\\times \\begin\{pmatrix\}|\\end\{pmatrix\}\}\{10\^\{(\d+)\}\}/g)].map((m) => Number(m[1] ?? m[2])));
    expect(Math.min(...ks)).toBe(-15);
    expect(Math.max(...ks)).toBe(15);
    expect(new Set(ks).size).toBeGreaterThan(25);
    expect(cs.some((c) => c.latex.includes("\\frac{\\begin{pmatrix}"))).toBe(true);
    expect(cs.some((c) => /\\operatorname\{approx\}\\left\(\\begin\{pmatrix\}/.test(c.latex))).toBe(true);
    expect(cs.some((c) => /\\operatorname\{approx\}\\left\((10\^|\\frac\{\\begin)/.test(c.latex))).toBe(true);
    const entries = cs.flatMap((c) => [...c.latex.matchAll(/\\begin\{pmatrix\}(.*?)\\end\{pmatrix\}/g)].flatMap((m) => m[1]!.split(/\\\\|&/)));
    for (const leaf of ["\\pi", "\\exponentialE", "ᴇ", "!", "."]) expect(entries.some((e) => e.includes(leaf)), leaf).toBe(true);
    // a singular one: the last row the sum of the first two (3×3) or twice the first (2×2)
    expect(entries.some((e) => e.startsWith("2\\times "))).toBe(true);
    expect(entries.some((e) => /^[^&]+\+[^&]+$/.test(e))).toBe(true);
  });

  it("builds every node kind, and the parser reads every tree as the keys would write it", () => {
    const want: [string, RegExp][] = [
      ["sum", /\\end\{pmatrix\}\)?(\\right\))?\+/],
      ["product", /\\times \\left\(|\\times \\begin\{pmatrix\}|\\times \\operatorname/],
      ["square", /\^\{2\}/],
      ["tran", /\\operatorname\{tran\}/],
      ["inv", /\\operatorname\{inv\}/],
      ["exp", /\\exponentialE\^\{/],
      ["sin", /\\sin\\left\(/],
      ["cos", /\\cos\\left\(/],
      ["det", /^\\operatorname\{det\}/],
      ["rank", /^\\operatorname\{rank\}/],
      ["linsolve", /^\\operatorname\{linsolve\}/],
    ];
    for (const [name, re] of want) expect(cs.filter((c) => re.test(c.latex)).length, name).toBeGreaterThan(5);
    for (const c of cs) expect(() => latexToGiac(c.latex), c.latex).not.toThrow();
    expect(cs.filter((c) => c.angle).every((c) => /\\(sin|cos)\\left/.test(c.latex))).toBe(true);
    expect(cs.find((c) => /^\\sin\\left\(\\begin/.test(c.latex)) ?? cs.find((c) => c.angle)).toBeDefined();
    expect(latexToGiac(MATRIX_PINNED[0]!.latex)).toBe("approx([[1,2],[3,4]]/10^13)*[[1],[1]]");
  });

  it("keeps each matrix node's matrix-valued children for the shrink", () => {
    const inv = cs.find((c) => c.latex.startsWith("\\operatorname{inv}"))!;
    const kids = matrixChildrenOf(inv.latex);
    expect(kids).toHaveLength(1);
    expect(inv.latex).toBe(`\\operatorname{inv}\\left(${kids[0]!.latex}\\right)`);
    expect(inv.mp).toBe(`INV(${kids[0]!.mp})`);
    expect(matrixChildrenOf("1+2")).toEqual([]);
  });

  it("gives a shrink from saved parts the matrix children too (fix round 1: `--shrink S` runs in a process that never generated the trees)", async () => {
    // the failures a `--part` process saved: the seed's matrix runs (their children are known here, in the process that generated them)
    const saved = runsOf(20261021, 1000, false, { matrices: 100 }).filter((r) => matrixChildrenOf(r.latex).length > 0);
    expect(saved.length).toBeGreaterThan(20);
    vi.resetModules(); // the `--shrink` process: a fresh gen.ts, nothing generated yet
    const freshGen = await import("../../tools/probes/sweep/gen.ts");
    expect(saved.filter((r) => freshGen.matrixChildrenOf(r.latex).length > 0)).toEqual([]);
    const { shrinkChildrenOf } = await import("./sweep-parts.ts");
    const childrenOf = shrinkChildrenOf(20261021, 1000, false);
    for (const r of saved) expect(childrenOf(r.latex), r.latex).toEqual(matrixChildrenOf(r.latex));
  });
});

/** The cells of a matrix oracle, re only (all of these are real), to `n` characters. */
const cells = (o: Oracle, n = 40): string[] => {
  if (o.kind !== "matrix") return [o.kind];
  for (const c of o.cells) expect(c.im).toMatch(/^-?0\.0$/);
  return o.cells.map((c) => c.re.slice(0, n));
};

describe("the oracle's matrices (G797; mpmath matrix, inverse, det, lu_solve, expm, sinm, cosm, rank by SVD)", () => {
  const M = "MAT([[mpf('1'),mpf('2')],[mpf('3'),mpf('4')]])";
  const S = "MAT([[mpf('1'),mpf('2'),mpf('3')],[mpf('4'),mpf('5'),mpf('6')],[mpf('7'),mpf('8'),mpf('9')]])";
  const J = "MAT([[mpf('0'),mpf('1')],[mpf('-1'),mpf('0')]])";
  it("computes the exact cases (source: derived by hand)", () => {
    const o = oracle([
      `INV(${M})`, // [[-2,1],[3/2,-1/2]]
      `DET(${M})`, // 1·4 − 2·3
      `LINSOLVE(${M},MAT([[mpf('5')],[mpf('6')]]))`, // inv·b = [−10+6, 7.5−3]
      `MMUL(${M},MAT([[mpf('1')],[mpf('1')]]))`, // row sums
      `TRN(MSQ(${M}))`, // M² = [[7,10],[15,22]], transposed
      `MADD(SMUL(mpf('2'),${M}),MDIV(${M},POW(mpf('10'),mpf('1'))))`, // 2.1·M
      "EXPM(MAT([[mpf('0'),mpf('1')],[mpf('0'),mpf('0')]]))", // nilpotent: I + N
      `MMUL(APPROX(MDIV(${M},POW(mpf('10'),mpf('13')))),MAT([[mpf('1')],[mpf('1')]]))`, // G790: [[3e-13],[7e-13]]
    ]);
    expect(cells(o[0]!, 6)).toEqual(["-2.0", "1.0", "1.5", "-0.5"]);
    expect(o[1]).toEqual({ kind: "value", re: "-2.0", im: "0.0" });
    expect(o[2]).toMatchObject({ kind: "matrix", rows: 2, cols: null });
    expect(cells(o[2]!, 6)).toEqual(["-4.0", "4.5"]);
    expect(o[3]).toMatchObject({ kind: "matrix", rows: 2, cols: 1 });
    expect(cells(o[3]!)).toEqual(["3.0", "7.0"]);
    expect(cells(o[4]!)).toEqual(["7.0", "15.0", "10.0", "22.0"]);
    expect(cells(o[5]!, 8)).toEqual(["2.1", "4.2", "6.3", "8.4"]);
    expect(cells(o[6]!)).toEqual(["1.0", "1.0", "0.0", "1.0"]);
    expect(cells(o[7]!, 100).map(Number)).toEqual([3e-13, 7e-13]);
  }, 60_000);

  it("rank by SVD at the rung's digits: a singular matrix, the same scaled by 10^-13, a near-singular one, zero; det 0 and no inverse when singular", () => {
    const o = oracle([
      `RANK(${S})`, // row 3 = 2·row 2 − row 1 (G622)
      `RANK(APPROX(MDIV(${S},POW(mpf('10'),mpf('13')))))`,
      "RANK(MAT([[mpf('1'),mpf('1')],[mpf('1'),(mpf('1'))+(POW(mpf('10'),mpf('-20')))]]))", // det 10^-20, not 0
      "RANK(MAT([[mpf('0'),mpf('0')],[mpf('0'),mpf('0')]]))",
      `RANK(${M})`,
      `DET(${S})`,
      `INV(${S})`,
      `LINSOLVE(${S},MAT([[mpf('1')],[mpf('2')],[mpf('3')]]))`,
      "DET(MAT([[mpf('0.1'),mpf('0.3')],[(mpf('2'))*(mpf('0.1')),(mpf('2'))*(mpf('0.3'))]]))", // gen.ts's singular 2×2
    ]);
    expect(o.slice(0, 5).map((x) => (x.kind === "value" ? x.re : x.kind))).toEqual(["2.0", "2.0", "2.0", "0.0", "2.0"]);
    expect(o[5]).toEqual({ kind: "value", re: "0.0", im: "0.0" });
    expect(o[6]).toEqual({ kind: "novalue" });
    expect(o[7]).toEqual({ kind: "novalue" });
    expect(o[8]).toEqual({ kind: "value", re: "0.0", im: "0.0" });
  }, 60_000);

  it("a matrix that only the lower rung calls singular has a value (G797 fix: the rungs agree on no value too)", () => {
    // [[1,1],[1,t]] with t = tanh 60: det t − 1 ≈ −1.5e-52, a condition number near 10^52, past 10^45 (60 digits' rank threshold), and no
    // literal that raises the rungs. Derived by hand: inv = [[t,−1],[−1,1]]/(t−1), linsolve(·, [1,2]) = [t−2, 1]/(t−1), det(inv) = 1/(t−1);
    // the scalar quotients come from the oracle's scalar path
    const T = "MAT([[mpf('1'),mpf('1')],[mpf('1'),tanh(mpf('60'))]])";
    const t = "tanh(mpf('60'))";
    const q = (num: string): string => `DIV(${num},(${t})-(mpf('1')))`;
    const o = oracle([
      `INV(${T})`,
      `LINSOLVE(${T},MAT([[mpf('1')],[mpf('2')]]))`,
      `DET(INV(${T}))`,
      q(t),
      q("mpf('-1')"),
      q("mpf('1')"),
      q(`(${t})-(mpf('2'))`),
      // the audit's example: its literals raise the rungs (10^±22), so 60 digits never decided it; a value before and after the fix
      "INV(MSQ(MAT([[mpf('1.5e22'),mpf('1')],[mpf('1'),mpf('2e-8')]])))",
      `INV(${S})`, // still no value: singular at both rungs
    ]);
    const re = (x: Oracle | undefined): string => (x?.kind === "value" ? x.re.slice(0, 40) : `(${x?.kind})`);
    // 1/(tanh 60 − 1) = −(e^120 + 1)/2: −e^120/2 to a double's digits
    expect(o[5]!.kind === "value" ? Math.abs(Number(o[5]!.re) / (-Math.exp(120) / 2) - 1) : 1).toBeLessThan(1e-13);
    expect(o[0]).toMatchObject({ kind: "matrix", rows: 2, cols: 2 });
    expect(cells(o[0]!, 40)).toEqual([re(o[3]), re(o[4]), re(o[4]), re(o[5])]);
    expect(o[1]).toMatchObject({ kind: "matrix", rows: 2, cols: null });
    expect(cells(o[1]!, 40)).toEqual([re(o[6]), re(o[5])]);
    expect(re(o[2])).toBe(re(o[5]));
    expect(o[7]!.kind).toBe("matrix");
    expect(o[8]).toEqual({ kind: "novalue" });
  }, 60_000);

  it("sinm and cosm of J (J² = −I: sin J = J·sinh 1, cos J = cosh 1·I, real) against mpmath's scalar sinh and cosh; DEG scales by π/180", () => {
    const [s, c, sh, ch] = oracle([`SINM(APPROX(${J}))`, `COSM(${J})`, "sinh(mpf('1'))", "cosh(mpf('1'))"]);
    const sinh1 = sh!.kind === "value" ? sh!.re.slice(0, 60) : "";
    const cosh1 = ch!.kind === "value" ? ch!.re.slice(0, 60) : "";
    expect(sinh1).toMatch(/^1\.17520119364/); // G792's package (mpmath)
    expect(cells(s!, 60)).toEqual(["0.0", sinh1, `-${sinh1}`.slice(0, 60), "0.0"]);
    expect(cells(c!, 60)).toEqual([cosh1, "0.0", "0.0", cosh1]);
    // a diagonal matrix in DEG: sin and cos of each entry in degrees, against the scalar SIN and COS of the oracle in DEG
    const D = "MAT([[mpf('30'),mpf('0')],[mpf('0'),mpf('45')]])";
    const [sd, cd, s30, s45, c45] = oracle([`SINM(${D})`, `COSM(${D})`, "SIN(mpf('30'))", "SIN(mpf('45'))", "COS(mpf('45'))"], true);
    const re = (x: Oracle | undefined): string => (x?.kind === "value" ? x.re.slice(0, 40) : "");
    expect(re(s30).slice(0, 3)).toBe("0.5");
    expect(cells(sd!)).toEqual([re(s30), "0.0", "0.0", re(s45)]);
    expect(cells(cd!)[3]).toBe(re(c45));
  }, 60_000);

  it("expm against the scalar exp on a diagonal, and the oracle answers every generated tree of a seed without an error", () => {
    const [e, e1, e2] = oracle(["EXPM(MAT([[mpf('1'),mpf('0')],[mpf('0'),mpf('-2.5')]]))", "exp(mpf('1'))", "exp(mpf('-2.5'))"]);
    const re = (x: Oracle | undefined): string => (x?.kind === "value" ? x.re.slice(0, 50) : "");
    expect(cells(e!, 50)).toEqual([re(e1), "0.0", "0.0", re(e2)]);
    const cs = generateMatrices(20261021, 120);
    const out = oracle(cs.map((c) => c.mp));
    for (const o of out) if (o.kind === "skip") expect(o.reason).not.toMatch(/oracle error|cap/);
    expect(out.filter((o) => o.kind === "matrix").length).toBeGreaterThan(40);
    expect(out.filter((o) => o.kind === "value").length).toBeGreaterThan(15);
    expect(out.filter((o) => o.kind === "novalue").length).toBeGreaterThan(0);
  }, 120_000);
});

const num = (re: string, im?: string): ComplexValue => ({ re: decimalFromString(re) ?? ZERO_VALUE, im: im === undefined ? ZERO_VALUE : (decimalFromString(im) ?? ZERO_VALUE) });
const item = (re: string, mark: Shown["mark"], n?: number, im?: string): Shown => ({ ok: true, display: re, value: num(re, im), mark, ...(n === undefined ? {} : { n }) });
const mat = (items: Shown[], shape?: [number, number]): Shown => ({ ok: true, display: "[…]", items, ...(shape ? { shape } : {}) });
const mo = (cellsRe: string[], rows: number, cols: number | null, im: string[] = []): Oracle => ({ kind: "matrix", rows, cols, cells: cellsRe.map((re, i) => ({ re, im: im[i] ?? "0.0" })) });

describe("the judge, entry by entry (G797; made-up oracles for its rules)", () => {
  it("passes a matrix whose every entry holds its mark", () => {
    expect(judge(mat([item("3e-13", "≈"), item("7e-13", "≈")], [2, 1]), mo(["3.0e-13", "7.0e-13"], 2, 1), 30).kind).toBe("ok");
    expect(judge(mat([item("-4", "="), item("4.5", "=")]), mo(["-4.0", "4.5"], 2, null), 12).kind).toBe("ok");
    // a list of 2 and a 2×1 column are the same answer
    expect(judge(mat([item("-4", "="), item("4.5", "=")]), mo(["-4.0", "4.5"], 2, 1), 12).kind).toBe("ok");
  });
  it("fails the entry that lies (G790's [[0],[0]] with =; G622's inverse with = 0 off the diagonal) and names it", () => {
    const v = judge(mat([item("0", "="), item("0", "=")], [2, 1]), mo(["3.0e-13", "7.0e-13"], 2, 1), 30);
    expect(v).toMatchObject({ kind: "wrong", check: "part" });
    expect(v.detail).toMatch(/^\[1,1\] re not shown/);
    const w = judge(mat([item("1e13", "⚠"), item("0", "="), item("0", "="), item("2e12", "⚠")], [2, 2]), mo(["-2.0e13", "1.0e13", "1.5e13", "-5.0e12"], 2, 2), 12);
    expect(w).toMatchObject({ kind: "wrong", check: "part" });
    expect(w.detail).toMatch(/^\[1,2\]/);
    const x = judge(mat([item("1", "≈"), item("2.5", "≈")], [1, 2]), mo(["1.0", "2.4"], 1, 2), 12);
    expect(x).toMatchObject({ kind: "wrong", check: "≈" });
    expect(x.detail).toMatch(/^\[1,2\] re: ≈ 2\.5/);
  });
  it("fails imaginary noise where the oracle is real (G792) and a bare ⚠ claims nothing", () => {
    const v = judge(mat([item("-4.31408307543e-32", "≈", undefined, "-2.88657986403e-15"), item("1.17520119364", "≈", undefined, "-7.19603190075e-17")], [1, 2]), mo(["0.0", "1.1752011936438014"], 1, 2), 12);
    expect(v).toMatchObject({ kind: "wrong", check: "part" });
    expect(judge(mat([item("1e13", "⚠"), item("5", "⚠")], [1, 2]), mo(["-2.0e13", "1.0"], 1, 2), 12)).toEqual({ kind: "ok", detail: "⚠ without a count" });
  });
  it("checks the shape, numbers where there is no value, a number where a matrix is due, and a refusal", () => {
    expect(judge(mat([item("1", "="), item("2", "=")], [1, 2]), mo(["1.0", "2.0", "3.0", "4.0"], 2, 2), 12)).toMatchObject({ kind: "wrong", check: "shape" });
    expect(judge(mat([item("1", "="), item("2", "="), item("3", "="), item("4", "=")], [1, 4]), mo(["1.0", "2.0", "3.0", "4.0"], 2, 2), 12)).toMatchObject({ kind: "wrong", check: "shape" });
    expect(judge(item("1", "="), mo(["1.0", "2.0"], 2, 1), 12)).toMatchObject({ kind: "wrong", check: "shape" });
    expect(judge(mat([item("1", "⚠", 12), item("2", "⚠", 12)]), { kind: "novalue" }, 12)).toMatchObject({ kind: "novalue", check: "novalue" });
    // one number among non-numbers where no value exists (an inverse shown as [[1e16, undef], …]) fails as a scalar number would
    expect(judge(mat([item("1e16", "⚠"), { ok: true, display: "undef" }]), { kind: "novalue" }, 12)).toMatchObject({ kind: "novalue", check: "novalue" });
    expect(judge(mat([{ ok: true, display: "undef" }, { ok: true, display: "undef" }]), { kind: "novalue" }, 12).kind).toBe("ok");
    expect(judge(mat([]), { kind: "novalue" }, 12).kind).toBe("ok");
    expect(judge({ ok: false, error: "engine", display: "Not invertible" }, { kind: "novalue" }, 12).kind).toBe("refused");
    expect(judge(mat([{ ok: true, display: "x" }, item("2", "=")]), mo(["1.0", "2.0"], 2, null), 12).kind).toBe("nonnumber");
  });
});

// Red on phase-1 394e7413: the sweep built no matrix, so none of these ran. Through the real engine they are G790's product and G622's
// inverse and rank (right since G790 and G622 merged: they must pass), and G792's sin (right since patch 0066, G792f1: it must pass in
// RAD and DEG); a failure would be a known row naming its package. G802: the last two (e^ of the scaled 3×3 and the scaled 2×2
// alone) are right since patch 0069; on phase-1 a1843b9b the 2×2 killed the engine (a crash row) and the 3×3 passed (Home reads 0.1 exactly).
describe.skipIf(!giacAvailable())("the pinned hunt inputs through Home (G797, real Giac)", () => {
  it("passes G790's product, G622's inverse and rank, G792's sin and G802's matrices; no failure is left", async () => {
    const runs: Run[] = runsOf(20261021, 0, false, { matrices: 1 }).filter((r) => MATRIX_PINNED.some((c) => c.latex === r.latex));
    expect(runs.length).toBe(MATRIX_PINNED.length + 1); // the sin also in DEG
    const oracles = oracleFor(runs, pythonFor(repo, mainCheckout), oraclePy);
    const { judged } = await sweep(runs, oracles, 6000);
    const failures = sweepFailures(judged);
    const byLatex = (l: string): string[] => failures.filter((f) => f.id.endsWith(` ${l}`)).map((f) => f.check);
    for (const c of MATRIX_PINNED.slice(0, 3)) {
      expect(byLatex(c.latex)).toEqual([]);
      expect(judged.find((j) => j.latex === c.latex)!.verdict.kind).toBe("ok");
    }
    expect(byLatex(MATRIX_PINNED[3]!.latex)).toEqual([]); // RAD and DEG: real, right digits (patch 0066)
    expect(judged.filter((j) => j.latex === MATRIX_PINNED[3]!.latex).map((j) => j.verdict.kind)).toEqual(["ok", "ok"]);
    for (const c of MATRIX_PINNED.slice(4)) {
      expect(byLatex(c.latex)).toEqual([]);
      expect(judged.find((j) => j.latex === c.latex)!.verdict.kind).toBe("ok");
    }
    expect(failures).toEqual([]);
    const known = loadKnown(repo, false).gate;
    for (const f of failures) {
      const k = known.find((r) => r.id === f.id && r.check === f.check);
      expect(k, f.id).toBeDefined();
      expect(["G622", "G792"]).toContain(k!.package);
    }
  }, 120_000);
});
