// SPDX-License-Identifier: GPL-3.0-or-later
// Solve and Function analysis mechanics against the real Giac build. Expected values come from
// tests/golden/ (oracle/derived); the golden gate checks the maths, these tests check the plumbing.
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { defaultHomeSettings, precisionFacts } from "./homeEval.ts";
import { giacAvailable, nodeHost } from "./nodeGiac.ts";
import { markOf } from "./format.ts";
import { mathJsonToGiac } from "../input/emit.ts";
import { parseLatex } from "../input/parse.ts";
import { DEFAULT_USER_FUNCTIONS } from "../input/latex-to-giac.ts";

describe.skipIf(!giacAvailable())("Solve and analysis plumbing (real Giac)", () => {
  let host: EngineHost;
  const s = defaultHomeSettings;
  beforeAll(async () => {
    host = (await nodeHost());
  });

  it("info line shows search points without binary noise (regression: 1.6400000000000001)", () => {
    const r = host.solve({ kind: "equations", equations: ["x*exp(x)=5"], unknowns: ["x"], guesses: ["1"] }, s);
    expect(r.roots[0]!.result.display).toBe("1.32672466524"); // oracle lambertw(5): solve.yaml lambert-xexp
    expect(r.info).toBe("sign change in [1.32, 1.64]"); // derived: guess 1, steps 0.01·2^k on both sides
  });

  it("a root's full value carries the digits a second polish at W+20 confirms (decisions M4-8)", () => {
    const r = host.solve({ kind: "equations", equations: ["x^2=2"], unknowns: ["x"], guesses: ["1"] }, s);
    const root = r.roots[0]!.result;
    expect(root.display).toBe("1.41421356237"); // oracle sqrt(2): solve.yaml sqrt2-pos
    expect(root.facts.reliableDigits).toBeGreaterThanOrEqual(28); // W = 30 against W+20 = 50
    expect(root.full.startsWith("1.4142135623730950488016887")).toBe(true); // oracle sqrt(2) to 26 digits
    expect(root.full.length).toBeGreaterThan(28);
  });

  it("a root that cancellation leaves right to fewer digits than asked is ⚠ n, with only those shown (M4-8)", () => {
    const s30 = { ...s, digits: 30 };
    const r = host.solve({ kind: "equations", equations: ["expand(product(x-k/7,k,1,25))=0"], unknowns: ["x"], guesses: ["3.4"] }, s30);
    const root = r.roots[0]!.result;
    expect(root.facts.reliableDigits).toBeLessThan(30);
    expect(markOf(precisionFacts(root), { format: "STD", digits: 30 })?.mark).toBe("⚠");
    // derived: the root is 24/7; every digit shown is right
    expect("3.42857142857142857142857142857".startsWith(root.display.slice(0, -1))).toBe(true);
  });

  it("SB1: a root of the expanded Wilkinson-type polynomial is found at 12 digits (rounding noise of f is not a residual)", () => {
    const r = host.solve({ kind: "equations", equations: ["expand(product(x-k/7,k,1,25))=0"], unknowns: ["x"], guesses: ["3.4"] }, s);
    expect(r.error).toBeUndefined();
    const root = r.roots[0]!.result;
    expect(root.display).toBe("3.42857142857"); // derived: 24/7
    expect(markOf(precisionFacts(root), { format: "STD", digits: 12 })?.mark).not.toBe("⚠"); // right to 15 digits or more
  });

  it("SB2: a quadruple root is found with fewer confirmed digits and ⚠, never = and never no root", () => {
    const r = host.solve({ kind: "equations", equations: ["expand((x-1/3)^4)=0"], unknowns: ["x"], guesses: ["0.5"] }, s);
    expect(r.error).toBeUndefined();
    const root = r.roots[0]!.result;
    const m = markOf(precisionFacts(root), { format: "STD", digits: 12 });
    expect(m?.mark).toBe("⚠");
    expect(m?.n).toBeLessThan(12);
    expect(root.display).toBe("0.3333333"); // derived: 1/3; the plateau of f at W = 30 is 1e-8 wide, so 7 digits are confirmed
  });

  it("subscripted unknowns x_1, x_2 are found and solved (regression: IDENT rejected the underscore)", () => {
    const eqs = ["x_1+x_2=3", "x_1-x_2=1"];
    expect(host.unknowns(eqs)).toEqual(["x_1", "x_2"]);
    const r = host.solve({ kind: "equations", equations: eqs, unknowns: ["x_1", "x_2"], guesses: ["0", "0"] }, s);
    expect(r.roots.map((x) => x.result.display)).toEqual(["2", "1"]); // derived: add and subtract the equations
  });

  it("a user's values of the unknowns are put back, Home Ans is left alone", () => {
    host.home("Y:=0.25", s);
    const r = host.solve({ kind: "equations", equations: ["Y^2=2"], unknowns: ["Y"], guesses: ["1"] }, s);
    expect(r.roots[0]!.result.display).toBe("1.41421356237"); // oracle sqrt(2)
    expect(host.home("Y", s).result.display).toBe("0.25");
    host.home("1/3", s);
    host.table({ fns: ["x^2"], xs: ["3"] }, s);
    expect(host.home("pasans*3", s).result.display).toBe("1"); // derived: Ans is still 1/3
  });

  it("known variables are substituted from the request, not from Giac", () => {
    host.home("a:=100", s);
    const r = host.solve({ kind: "equations", equations: ["X^2=a"], unknowns: ["X"], guesses: ["1"], knowns: [{ name: "a", value: "2" }] }, s);
    expect(r.roots[0]!.result.display).toBe("1.41421356237"); // oracle sqrt(2)
    expect(host.home("a", s).result.display).toBe("100");
  });

  it("unknowns: in order of appearance, constants excluded", () => {
    expect(host.unknowns(["X^2+a*Y=sin(Z)+pi+e", "Y=exp(X)"])).toEqual(["X", "a", "Y", "Z"]);
  });

  it("rejects mismatched systems and bad names without touching Giac state", () => {
    expect(host.solve({ kind: "equations", equations: ["X+Y=1"], unknowns: ["X", "Y"], guesses: ["0", "0"] }, s).error).toBe("bad-input");
    expect(host.solve({ kind: "poly", equation: "X^2=1", unknown: "X)" }, s).error).toBe("bad-input");
  });

  it("every root comes with its value for re-formatting and the residual", () => {
    const r = host.solve({ kind: "poly", equation: "X^2+1=0", unknown: "X" }, s);
    expect(r.roots.map((x) => x.result.display)).toEqual(["-i", "i"]); // derived: ±i
    expect(r.roots[0]!.result.value?.im.neg).toBe(true);
    expect(r.residualRel).toBeLessThan(1e-25);
    expect(r.method).toBe("proot");
  });

  it("G341 (F210): an equation with a free pasx never reaches solve1, whose root is pasx", async () => {
    // phase-1: the parse passed (`pasx(1)+x=3`) and Solve read its own pasx: no root on a fresh engine, 2 after an
    // earlier Solve left pasx at 1 (probe 2026-11-13)
    const h = await nodeHost();
    const solveTyped = (latex: string) => {
      // Solve's compile step (apps/solve/app.svelte.ts compileEquation), then the engine's Solve
      const eq = mathJsonToGiac(parseLatex(latex, { userFunctions: DEFAULT_USER_FUNCTIONS }), { realOddRoots: true, userFunctions: DEFAULT_USER_FUNCTIONS });
      return h.solve({ kind: "equations", equations: [eq], unknowns: ["x"], guesses: ["1"] }, s);
    };
    expect(() => solveTyped("\\operatorname{pasx}\\left(1\\right)+x=3")).toThrow(/pasx starts with pas, which N62 keeps for its own names/);
    expect(h.eval("pasx").output).toBe("pasx"); // solve1 never ran: its root is unset
    // the same path still solves (derived: 2+x = 3 at x = 1)
    expect(solveTyped("2+x=3").roots[0]!.result.display).toBe("1");
  });

  it("the pole of 1/X is not a root: no root found, with the reason in the info line", () => {
    const r = host.solve({ kind: "equations", equations: ["1/X=0"], unknowns: ["X"], guesses: ["1"] }, s);
    expect(r).toMatchObject({ ok: false, error: "no-root" });
    expect(r.info).toMatch(/sign change/);
  });
});
