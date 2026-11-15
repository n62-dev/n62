// SPDX-License-Identifier: GPL-3.0-or-later
// G360: Giac's other spellings of the decision functions are read by their canonical names (decisionAlias.ts), in the
// decision reading (decisions.ts) and the convergence check (converge.ts). No engine: the readers are text functions.
import { describe, expect, it } from "vitest";
import { DECISION_ALIAS, decisionName, isAlias } from "./decisionAlias.ts";
import { DECISION_FUNCTIONS, decisionCuts, logOfPower, rationalOnly, restsOnDecision } from "./decisions.ts";
import { callsIn } from "./converge.ts";

describe("G360 decision aliases", () => {
  it("names each spelling by its canonical name, the angle aliases through G304's map", () => {
    expect(["ceiling", "CEILING", "FLOOR", "IP", "FP", "ABS", "SIGN", "MAX", "LN", "ASIN", "arcsin", "ARG", "ceil", "myceil"].map(decisionName))
      .toEqual(["ceil", "ceil", "floor", "trunc", "fPart", "abs", "sign", "max", "ln", "asin", "asin", "arg", "ceil", "myceil"]);
    expect(isAlias("CEILING") && isAlias("SIN") && !isAlias("ceil") && !isAlias("f")).toBe(true);
  });

  it("maps every spelling to a name the decision reading knows", () => {
    for (const c of Object.values(DECISION_ALIAS)) expect(DECISION_FUNCTIONS.has(c) || ["ln", "acosh", "product", "irem", "iquo", "gcd", "comb"].includes(c), c).toBe(true);
  });

  it("an input that calls a spelling rests on a decision (it showed = 387557674395 for ceiling(sin(10^70)*10^12))", () => {
    for (const input of ["ceiling(sin(10^70)*10^12)", "CEILING(x)", "IP(x)", "FP(x)", "ABS(x)", "SIGN(x)", "MAX(x,0)", "l2norm(x)", "unitV(x)", "sorted([x,0])", "limite(f(x),x,0)"]) {
      expect(restsOnDecision(input, "typed", "0"), input).toBe(true);
    }
    expect(restsOnDecision("myceiling(x)", "typed", "0")).toBe(false);
    expect(logOfPower("LN(sin(10^70)^2)", "typed")).toBe(true);
  });

  it("cuts a spelling as its canonical name, so a proven tie takes its value", () => {
    expect(decisionCuts("CEILING(y)").map((c) => [c.kind, c.call?.name])).toEqual([["int", "ceil"]]);
    expect(decisionCuts("FP(y)").map((c) => [c.kind, c.call?.name])).toEqual([["int", "fPart"]]);
    expect(decisionCuts("ROUND(y)").map((c) => c.kind)).toEqual(["half"]);
    expect(decisionCuts("SIGN(y)").map((c) => [c.kind, c.call?.name])).toEqual([["zero", "sign"]]);
  });

  it("reads a sum spelt somme or add, with its bound variable, as rationals only", () => {
    expect(rationalOnly("somme(1/k,k,1,1000)", "typed")).toBe(true);
    expect(rationalOnly("add(1/k,k,1,1000)", "typed")).toBe(true);
    expect(rationalOnly("somme(1/k^2,k,1,inf)", "typed")).toBe(false);
  });

  it("finds the integrals, sums and limits the convergence check refuses under any spelling", () => {
    expect(callsIn("integrer(1/x,x,-1,1)+somme(cos(k),k,1,inf)+add(1,k,1,2)+limite(sin(x),x,inf)+lim(x,x,0)").map((c) => c.kind))
      .toEqual(["int", "sum", "sum", "limit", "limit"]);
  });
});
