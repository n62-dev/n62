// SPDX-License-Identifier: GPL-3.0-or-later
// G798: casback's laws that need no oracle. The judge of a law on made-up sides (no engine), the law builders, and the hunt's hand
// cases through Home on the real engine: G790's product and G793's lcm (right since patches 0064 and 0065: red on an engine before them,
// key 4361f213c1035daa), G622's inverse, linsolve and rank (right since patch 0068: red on phase-1 0da1ddc6, key 0badb9dd3cbfb5e2) and
// G791's hamdist (right since patch 0072: red on phase-1 cd8f646b, key baa2cc397540c685).
import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { decimalFromString, ZERO_VALUE, type ComplexValue } from "../src/engine/format.ts";
import { EngineHost, setGiacHostGlobals } from "../src/engine/host.ts";
import { defaultHomeSettings, pasdegCommand } from "../src/engine/homeEval.ts";
import { giacAvailable, loadNodeGiac } from "../src/engine/nodeGiac.ts";
import { latexToGiac } from "../src/input/latex-to-giac.ts";
import { checkLaw, integerLaws, integerLawSet, LAW_INTEGERS, LAW_MATRICES_PINNED, matrixLaws, type Law, type LawShown } from "../../tools/probes/casback/check.ts";
import { generateLawMatrices } from "../../tools/probes/sweep/gen.ts";
import { shownOf } from "../../tools/probes/sweep/shown.ts";
import type { KnownFailure } from "./invariants.ts";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const val = (re: string, im?: string): ComplexValue => ({ re: decimalFromString(re) ?? ZERO_VALUE, im: im === undefined ? ZERO_VALUE : (decimalFromString(im) ?? ZERO_VALUE) });
const side = (re: string, mark: "=" | "≈" | "⚠", n?: number): LawShown => ({ ok: true, value: val(re), mark, ...(n !== undefined ? { n } : {}) });
const grid = (rows: number, cols: number, ...cells: LawShown[]): LawShown => ({ ok: true, items: cells, shape: [rows, cols] });

describe("a law's judge (G798)", () => {
  it("passes two sides that agree within what both claim, and fails a difference both claim", () => {
    expect(checkLaw(side("12", "="), side("12", "="), 12).status).toBe("ok");
    expect(checkLaw(side("12", "="), side("13", "="), 12).status).toBe("wrong");
    // ≈ at 12 digits: within one unit of the 12th digit each
    expect(checkLaw(side("3.00000000000e-13", "≈"), side("3.00000000001e-13", "≈"), 12).status).toBe("ok");
    expect(checkLaw(side("3.0000000001e-13", "≈"), side("3e-13", "≈"), 12).status).toBe("wrong");
    // an exact side against a rounded one: the rounded one's unit only
    expect(checkLaw(side("0.5", "="), side("0.5000000000001", "≈"), 12).status).toBe("ok");
  });

  it("reads ⚠ n as n digits (G622's ⚠ 14 on a wrong inverse is a claim) and a bare ⚠ or ⚠ 0 as none", () => {
    expect(checkLaw(side("1e13", "⚠", 14), side("-6.66666666667e12", "⚠", 13), 30).status).toBe("wrong");
    expect(checkLaw(side("1e13", "⚠", 14), side("1.00000000000001e13", "⚠", 13), 30).status).toBe("ok");
    expect(checkLaw(side("1e13", "⚠"), side("-6.66666666667e12", "⚠", 13), 12).status).toBe("ok");
    expect(checkLaw(side("1e-13", "⚠", 0), side("-3e-39", "⚠", 13), 30).status).toBe("ok");
  });

  it("fails a claimed 0 against a claimed non-zero at any scale (G790's zero product)", () => {
    expect(checkLaw(side("0", "="), side("3e-13", "≈"), 30).status).toBe("wrong");
    expect(checkLaw(side("0", "="), side("0", "="), 30).status).toBe("ok");
    expect(checkLaw(side("1e-300", "≈"), side("1e300", "≈"), 12).status).toBe("wrong");
  });

  it("judges a matrix entry by entry with each cell's own mark, and a claimed shape", () => {
    const a = grid(1, 2, side("3e-13", "≈"), side("7e-13", "≈"));
    expect(checkLaw(a, grid(1, 2, side("3e-13", "≈"), side("7e-13", "≈")), 12).status).toBe("ok");
    const v = checkLaw(a, grid(1, 2, side("3e-13", "≈"), side("0", "=")), 12);
    expect(v.status).toBe("wrong");
    expect(v.detail).toContain("entry 2");
    expect(checkLaw(a, grid(1, 2, side("3e-13", "≈"), side("0", "⚠")), 12).status).toBe("ok");
    expect(checkLaw(a, grid(2, 1, side("3e-13", "≈"), side("7e-13", "≈")), 12).status).toBe("wrong");
    // a list beside a one-row matrix (linsolve's two forms): the entries decide
    expect(checkLaw({ ok: true, items: [side("0", "⚠"), side("0.5", "⚠", 13)] }, grid(1, 2, side("1", "⚠", 12), side("-0.25", "⚠", 13)), 30).status).toBe("wrong");
    expect(checkLaw(a, { ok: true, items: [side("3e-13", "⚠"), side("7e-13", "≈"), side("1", "≈")] }, 12).status).toBe("skip");
  });

  it("fails a claimed negative lcm or gcd, compares complex parts, and skips an error", () => {
    expect(checkLaw(side("-12", "="), side("12", "="), 30, true).status).toBe("wrong");
    expect(checkLaw(side("-12", "⚠"), side("-12", "⚠"), 30, true).status).toBe("ok");
    expect(checkLaw({ ok: true, value: val("1", "2"), mark: "≈" }, { ok: true, value: val("1", "-2"), mark: "≈" }, 12).status).toBe("wrong");
    expect(checkLaw({ ok: false }, side("1", "="), 12).status).toBe("skip");
  });
});

describe("the law builders (G798)", () => {
  it("builds five matrix laws at four scales and two Digits settings, approx(…) once around each float matrix", () => {
    const laws = matrixLaws("\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}", "\\operatorname{approx}\\left(\\begin{pmatrix}1&0\\\\0&1\\end{pmatrix}\\right)", "\\begin{pmatrix}1\\\\2\\end{pmatrix}", 2);
    expect(laws.length).toBe(5 * 4 * 2);
    expect(new Set(laws.map((l) => l.id)).size).toBe(laws.length);
    const det = laws.find((l) => l.id.startsWith("det d12:") && l.left.includes("10^{-13}"))!;
    expect(det.right).toBe("\\left(10^{-13}\\right)^{2}\\times \\operatorname{det}\\left(\\operatorname{approx}\\left(\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}\\right)\\right)");
    for (const l of laws) expect(l.left + l.right).not.toContain("approx}\\left(\\operatorname{approx}");
    for (const l of laws) expect(() => [latexToGiac(l.left), latexToGiac(l.right)]).not.toThrow();
  });

  it("builds the integer laws over the fixed set, no law twice for −0, every side readable", () => {
    expect(LAW_INTEGERS).toContain(2n ** 70n);
    const all = integerLawSet();
    expect(new Set(all.map((l) => l.id)).size).toBe(all.length);
    expect(all.filter((l) => l.law === "hamdist").length).toBe(LAW_INTEGERS.length ** 2);
    const zero = integerLaws(0n, 7n);
    expect(zero.map((l) => l.left)).not.toContain("\\operatorname{lcm}\\left(0,7\\right)");
    expect(zero.filter((l) => l.law === "lcm").length).toBe(1); // only lcm(0,−7)
    for (const l of all.slice(0, 40)) expect(() => [latexToGiac(l.left), latexToGiac(l.right)]).not.toThrow();
  });

  it("generates the same law matrices for a seed, each a 2×2 or 3×3 leaf with a column of its size", () => {
    const ms = generateLawMatrices(20261024, 30);
    expect(generateLawMatrices(20261024, 30)).toEqual(ms);
    for (const m of ms) {
      const rows = (t: string): number => [...t.matchAll(/\\begin\{pmatrix\}(.*?)\\end\{pmatrix\}/g)].map((x) => x[1]!.split("\\\\").length)[0]!;
      expect([rows(m.a), rows(m.b), rows(m.col)]).toEqual([m.n, m.n, m.n]);
    }
    expect(new Set(ms.map((m) => m.n))).toEqual(new Set([2, 3]));
  });
});

describe.skipIf(!giacAvailable())("the hunt's hand cases through Home (G798, real Giac)", () => {
  let host: EngineHost;
  beforeAll(async () => {
    setGiacHostGlobals();
    const { giac, bridge } = await loadNodeGiac();
    giac.eval(pasdegCommand("rad"));
    host = new EngineHost(giac, bridge);
  }, 60_000);
  const run = (l: Law): ReturnType<typeof checkLaw> => {
    const s = (latex: string): LawShown => shownOf(host.home(latexToGiac(latex), { ...defaultHomeSettings, digits: l.digits, workDigits: Math.max(30, l.digits + 10) }).result, l.digits);
    return checkLaw(s(l.left), s(l.right), l.digits, l.nonneg === true);
  };
  const [m2, m3, singular] = LAW_MATRICES_PINNED;
  const pick = (laws: Law[], id: string): Law => {
    const l = laws.find((x) => x.id.startsWith(id));
    if (!l) throw new Error(`no law ${id}`);
    return l;
  };
  const known = (parse(readFileSync(resolve(repo, "tests/golden/casback-known.yaml"), "utf8")) as { known: KnownFailure[] }).known;
  const packageOf = (l: Law): string | undefined => known.find((k) => k.id === l.id && k.check === "law")?.package;

  it("G790: (c·A)·B = c·(A·B) holds at c = 10^-13 (red before patch 0064: the product was the zero matrix with =)", () => {
    const l = pick(matrixLaws(m2!.a, m2!.b, m2!.col, 2), "product d30: \\left(10^{-13}");
    expect(run(l).status).toBe("ok");
    expect(packageOf(l)).toBeUndefined();
  });

  it("G622: inv(c·A) = inv(A)/c holds at c = 10^-13 (red before patch 0068: ⚠ 14 on a wrong inverse), no known row", () => {
    const l = pick(matrixLaws(m3!.a, m3!.b, m3!.col, 3), "inv d30: \\operatorname{inv}\\left(10^{-13}");
    expect(run(l).status).toBe("ok");
    expect(packageOf(l)).toBeUndefined();
  });

  it("G622: linsolve(c·A, c·b) = linsolve(A, b) holds at c = 10^-13, and rank(c·A) = rank(A) on a singular A at c = 10^7 (red before patch 0068)", () => {
    const lin = pick(matrixLaws(m2!.a, m2!.b, m2!.col, 2), "linsolve d30: \\operatorname{linsolve}\\left(10^{-13}");
    expect(run(lin).status).toBe("ok");
    expect(packageOf(lin)).toBeUndefined();
    const rank = pick(matrixLaws(singular!.a, singular!.b, singular!.col, 3), "rank d12: \\operatorname{rank}\\left(10^{7}");
    expect(run(rank).status).toBe("ok"); // before patch 0068 rank(approx(A)) was 0 with =, scaled by 10^7 it was 2
    expect(packageOf(rank)).toBeUndefined();
  });

  it("det(c·A) = c^n·det(A) passes where a side marks ⚠ 0 (an honest mark is not a wrong answer)", () => {
    const l = pick(matrixLaws(m3!.a, m3!.b, m3!.col, 3), "det d30: \\operatorname{det}\\left(10^{-13}");
    expect(run(l).status).toBe("ok");
  });

  it("G793: lcm(±a,±b) = lcm(a,b) ≥ 0 and gcd the same (red before patch 0065: lcm(-4,6) was -12 with =)", () => {
    for (const l of integerLaws(4n, 6n).filter((x) => x.law === "lcm" || x.law === "gcd")) expect(run(l).status, l.id).toBe("ok");
    for (const l of integerLaws(2n ** 63n + 1n, 2n ** 70n).filter((x) => x.law === "lcm" || x.law === "gcd")) expect(run(l).status, l.id).toBe("ok");
  });

  it("G791: hamdist(a,b) = hamdist(−a−1,−b−1) holds for 0 and 2^40 and the set's 2^31−1 (red before patch 0072: hamdist(-1,-2^40-1) was 4294967295 with =), no known row", () => {
    for (const l of [pick(integerLaws(0n, 2n ** 40n), "hamdist"), pick(integerLaws(0n, 2n ** 31n - 1n), "hamdist"), pick(integerLaws(2n ** 70n, 12n), "hamdist")]) {
      expect(run(l).status, l.id).toBe("ok");
      expect(packageOf(l)).toBeUndefined();
    }
  });

  it("a = b·iquo(a,b) + irem(a,b) for every sign pair", () => {
    for (const [a, b] of [[7n, 2n], [2n ** 70n, 2n ** 31n + 1n], [12n, 2n ** 63n - 1n]] as const) {
      for (const l of integerLaws(a, b).filter((x) => x.law === "division")) expect(run(l).status, l.id).toBe("ok");
    }
  });
});
