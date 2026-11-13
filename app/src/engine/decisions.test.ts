// SPDX-License-Identifier: GPL-3.0-or-later
// G146 (ca-7): the decision code unit by unit, against the real Giac build: decideTwice (G38, G57) and decidedAtDouble
// (G71) on the cut and tie cases of tests/golden/precision.yaml and home.yaml, each row with its golden id and the
// verdict the golden case implies (decided with its text, refused, or ⚠), plus one row per decision function family.
// The rows pin today's behaviour: a change that breaks a cut or a tie fails here, by name, before the golden gate.
// Expected texts are the golden rows' (oracle: mpmath, or derived as each row says).
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { defaultHomeSettings, toExactLiterals } from "./homeEval.ts";
import { argumentsAsFloats, contradictedCall, contradictedFloats, decidedAtDouble, floatsBesideName, decideTwice, decisionArgs, evenPowerRoot, logOfPower, nonRealArg, restsOnDecision, type Decision } from "./decisions.ts";
import { notBuiltin, valuePrecision, withDigits } from "./numeric.ts";
import { formatComplex } from "./format.ts";
import { engineGiac, giacAvailable, loadNodeGiac, type EngineGiac } from "./nodeGiac.ts";

/** sin(10^n) as Giac prints it (the power written out). */
const sinOf = (n: number): string => `sin(1${"0".repeat(n)})`;

interface Row {
  /** The golden case (`precision.yaml` or `home.yaml` id), or `family:<name>` for a family row. */
  id: string;
  input: string;
  digits: number;
  /** restsOnDecision on the exact input and its text at P: whether Home decides it again at all. */
  rests: boolean;
  /** The verdict: the decided text, "refused" (G57: `error.undecided`), or "⚠" (undecided, not refused). */
  verdict: string;
  /** Where the verdict comes from (oracle or derivation), for the rows that are no golden case. */
  why?: string;
}

const ROWS: readonly Row[] = [
  // --- precision.yaml, G38 at 30 digits, and the CAS rows' inputs (Home decides them the same way) ---
  { id: "prec-g38-30-sign-sin1e50", input: "sign(sin(10^50))", digits: 30, rests: true, verdict: "-1" },
  { id: "prec-g38-30-floor-sin1e50", input: "floor(sin(10^50)*10^12)", digits: 30, rests: true, verdict: "-789672493430" },
  { id: "prec-g38-30-abs-sin1e50", input: "abs(sin(10^50))", digits: 30, rests: true, verdict: `-${sinOf(50)}`, why: "sin(10^50) < 0 (oracle), so |sin(10^50)| = -sin(10^50)" },
  { id: "prec-g38-30-gt-sin1e50", input: "sin(10^50)>0", digits: 30, rests: true, verdict: "false" },
  // G156: a root of an even power rests on a decision (Giac's P text holds no abs(: it came back as -sin(10^50))
  { id: "prec-g38-30-sqrt-sq-sin1e50", input: "sqrt(sin(10^50)^2)", digits: 30, rests: true, verdict: `-${sinOf(50)}`, why: "as abs" },
  { id: "prec-g38-30-max-sin1e50", input: "max(sin(10^50),0)", digits: 30, rests: true, verdict: "0" },
  { id: "prec-g38-30-piecewise-sin1e50", input: "piecewise(sin(10^50)>0,1,2)", digits: 30, rests: true, verdict: "2" },
  { id: "prec-g38-30-floor-ramanujan", input: "floor(exp(pi*sqrt(163))*10^20)", digits: 30, rests: true, verdict: "26253741264076874399999999999925007259" },
  { id: "prec-g38-cas-floor-sin1e60", input: "floor(sin(10^60)*10^12)", digits: 12, rests: true, verdict: "830389765219" },
  // --- G57: refused; G156: a long literal raises P + 20 and P + 40 (G141), which then decide the floor of sin(10^100) ---
  { id: "prec-g38-cas-floor-cos-pi/7", input: "floor(cos(pi/7)-cos(2*pi/7)+cos(3*pi/7)+1/2)", digits: 12, rests: true, verdict: "refused" },
  { id: "prec-g38-cas-floor-sin1e100", input: "floor(sin(10^100)*10^12)", digits: 12, rests: true, verdict: "-372376123662" },
  { id: "prec-g38-30-floor-sin1e100", input: "floor(sin(10^100)*10^12)", digits: 30, rests: true, verdict: "-372376123662" },
  { id: "g38-floor-cos-pi/7-1e-100", input: "floor(cos(pi/7)-cos(2*pi/7)+cos(3*pi/7)+1/2-10^-100)", digits: 12, rests: true, verdict: "0" },
  // --- home.yaml G38 at 12 digits ---
  { id: "g38-round-sin1e50", input: "round(sin(10^50)*10^12)", digits: 12, rests: true, verdict: "-789672493429" },
  { id: "g38-floor-log10-1000", input: "floor(log10(1000))", digits: 12, rests: true, verdict: "3" },
  { id: "g38-sign-sqrt2-near", input: "sign(sqrt(2)-1.4142135623730951)", digits: 12, rests: true, verdict: "-1" },
  // --- sigfig and eseries (G139): a tie on rationals is no decision (rationalOnly); near and far ties ---
  { id: "sigfig-tie-0.125-2", input: "sigfig(0.125,2)", digits: 12, rests: false, verdict: "13/100" },
  { id: "sigfig-tie-neg-0.125-2", input: "sigfig(-0.125,2)", digits: 12, rests: false, verdict: "-13/100" },
  { id: "sigfig-tie-25-1", input: "sigfig(25,1)", digits: 12, rests: false, verdict: "30" },
  { id: "sigfig-sqrt2-3", input: "sigfig(sqrt(2),3)", digits: 12, rests: true, verdict: "141/100" },
  { id: "g139-sigfig-near-tie", input: "sigfig(1.25-sin(10^-50),2)", digits: 12, rests: true, verdict: "6/5" },
  { id: "g139-sigfig-far-tie", input: "sigfig(1.25-sin(10^-120),2)", digits: 12, rests: true, verdict: "6/5" },
  { id: "g139-eseries-tie-3.3", input: "eseries(6,sqrt(33/10))", digits: 12, rests: true, verdict: "11/5" },
  { id: "g139-eseries-near-tie", input: "eseries(6,sqrt(33/10)+sin(10^-50))", digits: 12, rests: true, verdict: "11/5" },
  // --- G71 census and the tier-1 decisions at 12 digits ---
  { id: "g71-trunc-sin1e70", input: "trunc(sin(10^70)*10^12)", digits: 12, rests: true, verdict: "-148099131371" },
  { id: "g71-heaviside-sin1e70", input: "Heaviside(sin(10^70))", digits: 12, rests: true, verdict: "0" },
  { id: "g71-census-normalize-sin1e70", input: "normalize(sin(10^70))", digits: 12, rests: true, verdict: "-1" },
  // --- one row per family the golden files leave out (G146) ---
  { id: "family:ceil", input: "ceil(sin(10^50)*10^12)", digits: 12, rests: true, verdict: "-789672493429", why: "floor + 1 of a non-integer (g38-floor-sin1e50, oracle -789672493430)" },
  { id: "family:when", input: "when(sin(10^50)>0,1,2)", digits: 12, rests: true, verdict: "2", why: "sin(10^50) < 0 (oracle, g38-gt-sin1e50)" },
  { id: "family:int", input: "int(abs(x),x,-1,1)", digits: 12, rests: true, verdict: "1", why: "∫₋₁¹ |x| dx = 1" },
  // a tie Giac proves (sin²+cos² = 1, simplify gives 0): a floor, sign or frac takes its value on the cut ...
  { id: "family:floor-proven-tie", input: "floor(sin(pi/7)^2+cos(pi/7)^2)", digits: 12, rests: true, verdict: "1", why: "floor(1) = 1" },
  { id: "family:sign-proven-tie", input: "sign(sin(pi/7)^2+cos(pi/7)^2-1)", digits: 12, rests: true, verdict: "0", why: "sign(0) = 0" },
  // G157 (patch 0028): trunc stays unevaluated where Giac cannot prove the sign; the cut is still read on its argument
  { id: "family:trunc-proven-tie", input: "trunc(-(sin(pi/7)^2+cos(pi/7)^2))", digits: 12, rests: true, verdict: "-1", why: "trunc(-1) = -1" },
  { id: "family:trunc-unproved-tie", input: "trunc(cos(pi/7)-cos(2*pi/7)+cos(3*pi/7)-1/2)", digits: 12, rests: true, verdict: "refused", why: "the argument is 0 (the sum is 1/2), on a cut Giac cannot prove" },
  // G156: 10^-100 raises the decision runs to 161 and 181 digits, where the argument -10^-100 agrees with itself
  { id: "family:trunc-raised", input: "trunc(cos(pi/7)-cos(2*pi/7)+cos(3*pi/7)-1/2-10^-100)", digits: 12, rests: true, verdict: "0", why: "trunc(-10^-100) = 0" },
  { id: "family:frac-proven-tie", input: "frac(sin(pi/7)^2+cos(pi/7)^2)", digits: 12, rests: true, verdict: "0", why: "frac(1) = 0" },
  // ... and one with no value to put in its place (Heaviside(0), round at a half, a comparison at 0) stays ⚠ (G57)
  { id: "family:heaviside-proven-tie", input: "Heaviside(sin(pi/7)^2+cos(pi/7)^2-1)", digits: 12, rests: true, verdict: "⚠", why: "Heaviside(0): conventions differ" },
  { id: "family:round-proven-tie", input: "round(sin(pi/7)^2+cos(pi/7)^2-1/2)", digits: 12, rests: true, verdict: "⚠", why: "round(1/2): a tie no value is put in for" },
  { id: "family:gt-proven-tie", input: "sin(pi/7)^2+cos(pi/7)^2-1>0", digits: 12, rests: true, verdict: "⚠", why: "0 > 0 on a cut" },
  // --- G156 (F163, found by G146): the decision runs start at G141's raised P, and a root of an even power rests on a
  // decision. sin(10^100) = -0.372376123661… (prec-G23-sin-1e100) and sin(10^70) = -0.148099131372… (g71's note), so
  // each |…| is -sin(…); Giac at P = 40 printed sin(…), and P + 20 took sin(10^100) as positive too.
  { id: "g156-abs-sin1e100", input: "abs(sin(10^100))", digits: 12, rests: true, verdict: `-${sinOf(100)}`, why: "sin(10^100) < 0 (oracle)" },
  { id: "g156-30-abs-sin1e100", input: "abs(sin(10^100))", digits: 30, rests: true, verdict: `-${sinOf(100)}`, why: "as at 12 digits" },
  { id: "g156-sqrt-sq-sin1e100", input: "sqrt(sin(10^100)^2)", digits: 12, rests: true, verdict: `-${sinOf(100)}`, why: "as abs" },
  { id: "g156-sqrt-sq-sin1e70", input: "sqrt(sin(10^70)^2)", digits: 12, rests: true, verdict: `-${sinOf(70)}`, why: "sin(10^70) < 0 (oracle)" },
  // past the cap (MAX_EVAL_DIGITS): no precision we run holds the literal, so a number is refused; a text with a free
  // name decides on its symbols, as before
  { id: "g156-abs-sin1e2000", input: "abs(sin(10^2000))", digits: 12, rests: true, verdict: "refused", why: "a 2001-digit literal" },
  { id: "g156-floor-sin1e1000", input: "floor(sin(10^1000)*10^12)", digits: 12, rests: true, verdict: "refused", why: "1001 digits + P + 40 > 1000" },
  { id: "family:past-cap-free-name", input: "sign(x)+10^2000", digits: 12, rests: true, verdict: `sign(x)+1${"0".repeat(2000)}`, why: "the literal is in no decision's argument" },
  // the literal is in a comparison: Giac's P text is true or false (no free name), or a branch with one
  { id: "g156-gt-sin1e2000", input: "sin(10^2000)>0", digits: 12, rests: true, verdict: "refused", why: "a 2001-digit literal in the comparison" },
  { id: "g156-piecewise-sin1e2000", input: "piecewise(sin(10^2000)>0,x,2*x)", digits: 12, rests: true, verdict: "refused", why: "as the comparison alone; x is in a branch" },
  // a negative even power (the number reader reads 2 without its sign)
  { id: "g156-sqrt-inv-sq-sin1e100", input: "sqrt(sin(10^100)^(-2))", digits: 12, rests: true, verdict: `(-${sinOf(100)})^-1`, why: "1/|sin(10^100)|, sin(10^100) < 0 (oracle)" },
  { id: "family:sqrt-sq-short", input: "sqrt(sin(1)^2)", digits: 12, rests: true, verdict: "sin(1)", why: "sin(1) > 0" },
];


/** The verdict of a decision, as the rows write it. */
function verdictOf(d: Decision): string {
  return "undecided" in d ? (d.refused ? "refused" : "⚠") : d.text;
}

describe.skipIf(!giacAvailable())("decideTwice (G38, G57; real Giac)", () => {
  let giac: EngineGiac;
  let host: EngineHost;
  beforeAll(async () => {
    const L = await loadNodeGiac();
    giac = engineGiac(L);
    host = new EngineHost(giac, L.bridge);
    host.home("1", defaultHomeSettings); // Home's setup (radians, the step budget)
    host.need("sigfig(1,1)+eseries(6,1)"); // our definitions
  });

  /** As homeEval runs it: the exact input, its text at P, restsOnDecision, then decideTwice (P + 20, P + 40). */
  const decide = (r: Row): { rests: boolean; verdict: string; text: string } => {
    const exact = toExactLiterals(r.input);
    const text = withDigits(giac, valuePrecision(r.digits), r.digits, () => giac.eval(`(${exact})`));
    const rests = restsOnDecision(exact, "typed", text, notBuiltin(giac));
    const d = decideTwice(giac, exact, text, r.digits, r.digits);
    giac.eval("purge(pasdec2)");
    return { rests, verdict: verdictOf(d), text };
  };

  for (const r of ROWS) {
    it(`${r.id}: ${r.input} at ${r.digits} → ${r.verdict}${r.why ? ` (${r.why})` : ""}`, () => {
      const got = decide(r);
      expect({ rests: got.rests, verdict: got.verdict }).toEqual({ rests: r.rests, verdict: r.verdict });
    });
  }

  it("a decided text from the P + 40 run is kept in pasdec2 for the caller (from), and the agreeing one is not", () => {
    // a stored 10^60 is no typed literal, so P + 20 (60 digits) does not hold it and disagrees with P; P + 40 decides
    giac.eval("hw:=10^60");
    const exact = "floor(sin(hw)*10^12)";
    const text = withDigits(giac, valuePrecision(12), 12, () => giac.eval(`(${exact})`));
    const d = decideTwice(giac, exact, text, 12, 12);
    expect(d).toMatchObject({ text: "830389765219", from: "pasdec2" });
    expect(giac.eval("pasdec2")).toBe("830389765219");
    giac.eval("purge(pasdec2,hw)");
    const same = decideTwice(giac, "max(sin(10^50),0)", "0", 12, 12);
    expect(same).toEqual({ text: "0" });
    expect(giac.eval("pasdec2")).toBe("pasdec2");
  });

  it("G325: an asin of a non-real argument past the cap is refused as a branch (Home skips G187's size check); a sqrt of an even power past it is not", () => {
    const at = (exact: string): string => withDigits(giac, valuePrecision(12), 12, () => giac.eval(`(${exact})`));
    const f212 = "(10^1000)^asin(sqrt(-2)-10^1000)";
    expect(decideTwice(giac, f212, at(f212), 12, 12)).toEqual({ undecided: true, refused: true, branch: true });
    // G187's own row: the refusal comes from sqrt(10^1000), so the size check runs and says underflow (golden g187-underflow-90-pow-sqrt-1e1000-12)
    const g187 = "(90+1/10^6)^(sqrt(10^1000))";
    expect(decideTwice(giac, g187, at(g187), 12, 12)).toEqual({ undecided: true, refused: true });
    const t0 = performance.now();
    const r = host.home(f212, defaultHomeSettings).result;
    expect({ error: r.error, fast: performance.now() - t0 < 750 }).toEqual({ error: "undecided", fast: true });
  });

  it("iPart (known): Giac's iPart prints a float, so Home does not decide it again; it shows ⚠ with no digit (oracle -148099131371)", () => {
    const r = host.home("iPart(sin(10^70)*10^12)", defaultHomeSettings).result;
    expect({ display: r.display, reliableDigits: r.facts.reliableDigits, warn: r.facts.warn }).toEqual({ display: "4E11", reliableDigits: 0, warn: "unaudited" });
  });
});

describe.skipIf(!giacAvailable())("nonRealArg at MPFR precision (G325f1; real Giac)", () => {
  let giac: EngineGiac;
  beforeAll(async () => {
    giac = engineGiac(await loadNodeGiac());
  });
  it("finds an imaginary part below the double's range, at Digits 12", () => {
    // im(evalf(sqrt(-2)*10^-330-2)) is 0 at Digits 12 (a double), 1.414E-330 at 40 digits
    giac.eval("Digits:=12");
    const P = valuePrecision(12);
    expect(nonRealArg(giac, P)("sqrt(-2)*10^-330-2")).toBe(true);
    expect(nonRealArg(giac, P)("sqrt(-2)/10^400-2")).toBe(true);
    expect(nonRealArg(giac, P)("sqrt(2)*10^-330-2")).toBe(false);
    expect(nonRealArg(giac, P)("2")).toBe(false);
  });

  it("finds Giac's evalf of a call contradicted only where its exact text cancels (G325f2 fix rounds 1 and 2)", () => {
    const P = valuePrecision(12);
    const contradicted = contradictedCall(giac, P, 12);
    expect(contradicted("asin", "sqrt(-2)*10^-330-2")).toBe(true);
    expect(contradicted("acosh", "sqrt(-2)*10^-330-2")).toBe(true);
    expect(contradicted("acos", "sqrt(-2)/10^400-2")).toBe(true);
    // the argument's float loses the tiny part's digits near 1 (MPFR's ln), Giac's ln form keeps them
    expect(contradicted("acosh", "1/2+i/10^20")).toBe(false);
    expect(contradicted("asin", "1/2+i/10^20")).toBe(false);
    expect(contradicted("asin", "-1-10^-30+i/10^40")).toBe(false);
    // a free name in the argument compares no truth value: Giac's text stands
    expect(contradicted("asin", "x+i")).toBe(false);
    // a text that stores is never run for the check
    expect(contradicted("asin", "pq:=2*i")).toBe(true);
    expect(giac.eval("pq")).toBe("pq");
    expect(giac.eval("pasfg")).toBe("pasfg");
    expect(giac.eval("Digits")).toBe("12");
  });

  it("swaps in the argument's float per call, never for a whole non-number or list (G325f2 fix round 2)", () => {
    const P = valuePrecision(12);
    const floats = (input: string, result: string): string | null => contradictedFloats(giac, input, result, P, 12);
    // x+… and a list compare no truth value as a whole; the call inside is checked alone
    expect(floats("x+evalf(asin(sqrt(-2)*10^-330-2))", "x-1.57079632679+0.69314718056*i")).toBe("x+evalf(asin(evalf(sqrt(-2)*10^-330-2)))");
    expect(floats("x+evalf(acosh(1/2+i/10^20))", "x+1.15470053838e-20+1.0471975512*i")).toBeNull();
    expect(floats("evalf([acosh(1/2+i/10^20),1])", "[1.15470053838e-20+1.0471975512*i,1]")).toBeNull();
    expect(floats("evalf([asin(sqrt(-2)*10^-330-2),acosh(1/2+i/10^20)])", "[-1.57+0.69*i,1.15e-20+1.05*i]")).toBe("evalf([asin(evalf(sqrt(-2)*10^-330-2)),acosh(1/2+i/10^20)])");
    // an exact text is pastCapFloats' or decideTwice's
    expect(floats("asin(sqrt(-2)-10^35)", "i*ln(2)")).toBeNull();
  });
});

describe.skipIf(!giacAvailable())("decidedAtDouble (G71, F59; real Giac)", () => {
  let giac: EngineGiac;
  beforeAll(async () => {
    giac = engineGiac(await loadNodeGiac());
  });
  /** A number as Home shows it at 12 digits, its confirmed digits and warn; or the text; or null. */
  const atDouble = (input: string): unknown => {
    const d = decidedAtDouble(giac, "pasg146", input, 12);
    giac.eval("purge(pasg146)");
    if (d === null || "text" in d) return d;
    return d.facts.map((f) => ({ shown: formatComplex(f.value, { format: "STD", digits: 12 }).text, digits: f.reliableDigits, warn: f.warn, exact: f.exact }));
  };
  const n = (shown: string) => [{ shown, digits: 12, warn: "unaudited", exact: false }];

  it("g71-round-besselj-1e12: round(BesselJ(1,2)*10^12) → 576724807757 ⚠", () => expect(atDouble("round(BesselJ(1,2)*10^12)")).toEqual(n("576724807757")));
  it("g71-floor-besselj-1e12: floor(BesselJ(1,2)*10^12) → 576724807756 ⚠", () => expect(atDouble("floor(BesselJ(1,2)*10^12)")).toEqual(n("576724807756")));
  it("g71-round-besselj: round(BesselJ(1,2)) → 1 ⚠", () => expect(atDouble("round(BesselJ(1,2))")).toEqual(n("1")));
  it("g71-sign-besselj-half: sign(BesselJ(1,2)-0.5) → 1 ⚠", () => expect(atDouble("sign(BesselJ(1,2)-0.5)")).toEqual(n("1")));
  it("g71-max-besselj: max(BesselJ(1,2),0.1) → 0.576724807757 ⚠", () => expect(atDouble("max(BesselJ(1,2),0.1)")).toEqual(n("0.576724807757")));
  it("g71-gt-besselj-half: BesselJ(1,2)>0.5 → the text true", () => expect(atDouble("BesselJ(1,2)>0.5")).toEqual({ text: "true" }));
  it("family:symbolic: a free name gives no number and no plain text → null (the error stays)", () => expect(atDouble("BesselJ(1,x)>0.5")).toBeNull());
  it("at 30 digits the confirmed digits are the double's (DOUBLE_DIGITS = 14)", () => {
    const d = decidedAtDouble(giac, "pasg146", "round(BesselJ(1,2)*10^12)", 30);
    giac.eval("purge(pasg146)");
    expect(d && "facts" in d ? d.facts.map((f) => f.reliableDigits) : d).toEqual([14]);
  });
});

describe("evenPowerRoot (G156)", () => {
  it.each([
    ["sqrt(sin(10^100)^2)", true],
    ["sqrt(sin(10^100)^(-2))", true],
    ["sqrt(x^-4)", true],
    ["sqrt(x^(-3))", false],
    ["sqrt(4*x^(4))", true],
    ["(sin(10^70)^2)^(1/2)", true],
    ["sqrt(x^2+1)", true],
    ["sqrt(2)", false],
    ["sqrt(x^3)", false],
    ["sqrt(x^(2/3))", false],
    ["sqrt(x^0)", false],
    ["sqrt(x)^2", false],
    ["x^2+x^(1/3)", false],
    ['sqrt("a^2")', false],
  ])("%s → %s", (input, want) => expect(evenPowerRoot(input, "typed")).toBe(want));
});

describe("logOfPower (G306)", () => {
  it.each([
    ["ln(sin(10^70)^2)", true],
    ["ln(sin(10^70)^3)", true],
    ["ln(sin(10^70)^(-1))", true],
    ["ln(x^-1)", true],
    ["log10(sin(10^70)^2)", true],
    ["ln(sin(10^70)^2)/ln(2)", true],
    ["log(x^4)", true],
    ["logb(sin(10^70)^2,2)", true],
    ["ln(w2^3)", true],
    ["logb(x,2^3)", false],
    ["ln(atanh(89999/1000/10^1000))", false],
    ["ln(2.5^3)", false],
    ["ln(x^1)", false],
    ["ln(x^0)", false],
    ["ln(x^(1/2))", false],
    ["ln(x)^2", false],
    ["exp(x^2)", false],
    ['ln("a^2")', false],
  ])("%s → %s", (input, want) => expect(logOfPower(input, "typed")).toBe(want));
});

describe("surd, atan2, sort and a logarithm of a power rest on a decision (G306)", () => {
  it.each([
    ["surd(sin(10^70),3)", true],
    ["atan2(sin(10^70),-1)", true],
    ["sort(list[sin(10^70),0,cos(10^70)])", true],
    ["SortD(list[sin(10^70),0])", true],
    ["sortperm(list[sin(10^70),0])", true],
    ["ln(sin(10^70)^2)", true],
    // rationals decide exactly: no second run
    ["sort(list[3,1,2])", false],
    ["SortA(list[1/3,1/4])", false],
    ["ln(4)", false],
    ["ln(2^3)", false],
    ["list+sort(list[1,2])", true],
    // an odd root or a quadrant of rationals is irrational: made again, the text stands
    ["surd(2,3)", true],
    ["atan2(1,2)", true],
  ])("%s → %s", (input, want) => expect(restsOnDecision(input, "typed", "")).toBe(want));
  it("the argument of a logarithm over a power is one a decision is made on (decisionArgs)", () =>
    expect(decisionArgs("ln(sin(10^70)^2)+1", "", () => false)).toContain("sin(10^70)^2"));
});

describe("asin and acos of a non-real argument decide (G325)", () => {
  const none = (): boolean => false;
  // the argument's realness as nonRealArg finds it with Giac (here: an argument holding sqrt(-…) or i is not real)
  const nonReal = (arg: string): boolean => /sqrt\(-|(?<![a-z])i(?![a-z])/.test(arg);
  it.each([
    // Giac's text of the result at P: one that holds i, of an argument that is not real, is made again at P + 20, P + 40
    ["asin(sqrt(-2)-10^35)", "i*ln(2*sqrt(2)/(2*sqrt(2*(sqrt(5)+2)))+i*sqrt(2*(sqrt(5)+2)))", true],
    ["acos(sqrt(-2)-10^35)", "1/2*pi+(-i)*ln(sqrt(2)+i)", true],
    ["arcsin(2*i-10^35)", "asin(-100000000000000000000000000000000000+2*i)", true],
    ["arccos(x)", "arccos(x)", false],
    // a real result costs no call; a real argument outside [-1, 1] is not made again
    ["asin(1/2)", "pi/6", false],
    ["asin(2)", "(-i)*ln(i*sqrt(3)+2*i)+1/2*pi", false],
    ["acos(sqrt(2)/2)", "pi/4", false],
    // another function with a non-real result is not a decision
    ["ln(sqrt(-2)-10^35)", "ln(i*sqrt(2)-100000000000000000000000000000000000)", false],
  ])("%s with %s → %s", (input, text, want) => expect(restsOnDecision(input, "typed", text, none, nonReal)).toBe(want));

  it("is no decision without the argument check (a stored function's body, an input that runs once)", () => {
    expect(restsOnDecision("asin(sqrt(-2)-10^35)", "typed", "i*ln(2)")).toBe(false);
  });

  it("asks the argument only when the result is not real", () => {
    const asked: string[] = [];
    const spy = (arg: string): boolean => (asked.push(arg), true);
    restsOnDecision("asin(1/2)+acos(1/3)", "typed", "pi/6+acos(1/3)", none, spy);
    expect(asked).toEqual([]);
    restsOnDecision("asin(sqrt(-2)-10^35)", "typed", "i*ln(2)", none, spy);
    expect(asked).toEqual(["sqrt(-2)-10^35"]);
  });

  it("an asin argument that holds a literal past the cap is a decision's text when it and the result are not real", () => {
    expect(decisionArgs("asin(sqrt(-2)-10^1000)", "i*ln(2)", none, nonReal)).toContain("sqrt(-2)-10^1000");
    expect(decisionArgs("asin(tan(2)-10^1000)", "i*ln(2)", none, nonReal)).toEqual([]);
    expect(decisionArgs("asin(1/2)+10^1000", "pi/6+10^1000", none, nonReal)).toEqual([]);
  });

  it("reads the argument of every asin or acos that decides as its float (G325f1), inner calls too", () => {
    expect(argumentsAsFloats("acos(sqrt(-2)*10^-330-2)", "typed", "i*ln(2)", nonReal)).toBe("acos(evalf(sqrt(-2)*10^-330-2))");
    expect(argumentsAsFloats("2*asin(sqrt(-2)-1)+acos(1/3)", "typed", "i*ln(2)+acos(1/3)", nonReal)).toBe("2*asin(evalf(sqrt(-2)-1))+acos(1/3)");
    expect(argumentsAsFloats("asin(asin(sqrt(-2))+i)", "typed", "i*ln(2)", nonReal)).toBe("asin(evalf(asin(evalf(sqrt(-2)))+i))");
    // a real result, or no argument that is not real: none
    expect(argumentsAsFloats("asin(sqrt(-2)-1)", "typed", "pi/6", nonReal)).toBeNull();
    expect(argumentsAsFloats("asin(2)", "typed", "i*ln(2)", nonReal)).toBeNull();
  });

  it("reads acosh's argument as its float too, and Giac's float text of the call (G325f2)", () => {
    expect(argumentsAsFloats("evalf(acosh(sqrt(-2)*10^-330-2))", "typed", "0.69+3.14*i", nonReal)).toBe("evalf(acosh(evalf(sqrt(-2)*10^-330-2)))");
    expect(argumentsAsFloats("approx(acos(sqrt(-2)/10^400-2))", "typed", "4.71-878.4*i", nonReal)).toBe("approx(acos(evalf(sqrt(-2)/10^400-2)))");
    // fix round 2: only the calls `swap` picks
    const only = (name: string): boolean => name === "asin";
    expect(argumentsAsFloats("x+acosh(sqrt(-2)-1)+asin(sqrt(-2)-1)", "typed", "x+i", nonReal, only)).toBe("x+acosh(sqrt(-2)-1)+asin(evalf(sqrt(-2)-1))");
    expect(floatsBesideName("x-1.57+0.69*i")).toBe(true);
    expect(floatsBesideName("-1.57+0.69*i")).toBe(false);
    expect(floatsBesideName("x+i")).toBe(false);
  });
});
