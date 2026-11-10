// SPDX-License-Identifier: GPL-3.0-or-later
// G39: a number for something that does not exist is refused; Giac's [exact, numeric] pair is never a list.
// Expected refusals are derived (a pole inside the interval, a term that does not tend to 0); values are oracle cases
// of home.yaml (g39-keep-*).
import { engineGiac, type EngineGiac } from "./nodeGiac.ts";
import { fakeGiac } from "./fakeGiac.ts";
import { beforeAll, describe, expect, it } from "vitest";
import { callsIn, errorRefusal, floatBounds, giacPair, hasDefiniteIntegral, integratedNumerically, refusalOf } from "./converge.ts";
import { EngineHost, type GiacApi } from "./host.ts";
import type { GiacBridge } from "./bridge.ts";
import { defaultHomeSettings, precisionFacts } from "./homeEval.ts";
import { defaultCasSettings } from "./types.ts";
import { markOf } from "./format.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";
import { rewriteAngles } from "./angles.ts";

describe("converge helpers", () => {
  it("finds the calls, nested ones too, and not a name that ends in the word", () => {
    expect(callsIn("2*int(1/x,x,-1,1)+sum(1/k^2,k,1,inf)").map((c) => [c.kind, c.args.length])).toEqual([["int", 4], ["sum", 4]]);
    expect(callsIn("myint(x)+\"int(\"")).toEqual([]);
    expect(callsIn("limit(sin(x),x,inf)")[0]!.args).toEqual(["sin(x)", "x", "inf"]);
  });
  it("reads Giac's pair: an exact element, then a float", () => {
    expect(giacPair("[8100/pi,0.785398163397]")).toEqual({ exact: "8100/pi", numeric: "0.785398163397" });
    expect(giacPair("[0.5,0.785398163397]")).toBeNull();
    expect(giacPair("[1,2]")).toBeNull();
    expect(giacPair("[1/2,x]")).toBeNull();
    expect(hasDefiniteIntegral("int(1/(1+x^2),x,0,1)")).toBe(true);
    expect(hasDefiniteIntegral("int(1/(1+x^2),x)")).toBe(false);
    expect(hasDefiniteIntegral("[int(x,x,0,1),evalf(pi)]")).toBe(false);
  });
  it("G90: makes every definite integral's bounds floats, nested ones too, and leaves the rest alone", () => {
    expect(floatBounds("int(asin(x)*12^x,x,0,1)")).toBe("int(asin(x)*12^x,x,evalf(0),evalf(1))");
    expect(floatBounds("2*integrate(int(x*y,y,0,x),x,-1,(1/2))+int(x,x)")).toBe("2*integrate(int(x*y,y,evalf(0),evalf(x)),x,evalf(-1),evalf((1/2)))+int(x,x)");
    expect(floatBounds('myint(x,x,0,1)+"int(x,x,0,1)"')).toBe('myint(x,x,0,1)+"int(x,x,0,1)"');
  });
  it("G176: a limit Giac leaves unevaluated (patch 0035: the side of a trunc undecided) stands with ⚠; no Giac call for it", () => {
    const none = fakeGiac((): string => { throw new Error("no call expected"); });
    expect(refusalOf(none, "limit(trunc(sin(1/x)/2),x,0)", "limit(trunc(sin(1/x)/2),x=0)", 12)).toBe("unchecked");
    expect(refusalOf(none, "1+limit(trunc(a*x),x,1,-1)", "limit(trunc(a*x),x=1,-1)+1", 12)).toBe("unchecked");
    expect(refusalOf(none, "limit(trunc(x),x,-1,1)", "0", 12)).toBeNull();
  });
  it("G305: Giac's error for one-sided limits that differ is noLimit when the input holds a limit; no Giac call for it", () => {
    const none = fakeGiac((): string => { throw new Error("no call expected"); });
    const distinct = "GIAC_ERROR: Unidirectional limits are distinct 1,2 Error: Bad Argument Value";
    const distincts = "GIAC_ERROR: Unidirectional limits are distincts -1/2*pi,1/2*pi Error: Bad Argument Value";
    expect(errorRefusal("limit(round(x),x,(15/10^1))", distinct)).toBe("noLimit");
    expect(errorRefusal("2*limit(atan(1/x),x,0)", distincts)).toBe("noLimit");
    expect(refusalOf(none, "limit(round(x),x,3/2)", distinct, 12)).toBe("noLimit");
    expect(refusalOf(none, "limit(atan(1/x),x,0)", distincts, 12)).toBe("noLimit");
    // not Giac's limit error, or no limit typed: not ours to read
    expect(errorRefusal("limit(round(x),x,3/2)", "GIAC_ERROR: Bad Argument Value")).toBeNull();
    expect(errorRefusal("round(x)", distinct)).toBeNull();
    expect(errorRefusal("mylimit(round(x),x,3/2)", distinct)).toBeNull();
    expect(errorRefusal("limit(round(x),x,3/2,1)", "2")).toBeNull();
  });
  it("G90: Giac's exact answer with an integrate(…) left in it is its numeric integration; no Giac call for it", () => {
    const none = fakeGiac((): string => { throw new Error("no call expected"); });
    expect(integratedNumerically(none, "int(x^x,x,0,1)", "integrate(exp(ln(x)*x+ln(x))/x,x,0,1)")).toBe(true);
    expect(integratedNumerically(none, "int(exp(-x^2),x,0,1)", "1/2*sqrt(pi)*erf(1)")).toBe(false);
    expect(integratedNumerically(none, "int(f(x),x)", "integrate(f(x),x)")).toBe(false);
    // evalf(int(…)): each integral is run exactly once more.
    const giac = fakeGiac((t: string): string => (t === "int(x^x,x,0,1)" ? "integrate(exp(ln(x)*x+ln(x))/x,x,0,1)" : "1/3"));
    expect(integratedNumerically(giac, "evalf(int(x^x,x,0,1))", "0.783430510712")).toBe(true);
    expect(integratedNumerically(giac, "evalf(int(x^2,x,0,1))", "0.333333333333")).toBe(false);
  });
  it("a check that cannot finish keeps the result, unchecked (Giac's timeout on the second integral)", () => {
    const answers: [RegExp, string][] = [
      [/^lname\(1\/x\)$/, "[x]"],
      [/^lname\(/, "[]"],
      [/^singular\(/, "[0]"],
      [/^evalf\(-1,30\)$/, "-1.0"],
      [/^evalf\(1,30\)$/, "1.0"],
      [/^evalf\(0,30\)$/, "0.0"],
      [/^(limit|int)\(/, "GIAC_ERROR: Stopped by user interruption."],
    ];
    const giac = fakeGiac((t: string) => answers.find(([re]) => re.test(t))?.[1] ?? "GIAC_ERROR: unexpected");
    expect(refusalOf(giac, "int(1/x,x,-1,1)", "0", 12)).toBe("unchecked");
  });
  it("more singular points in [a, b] than are checked leave the result unchecked, never ok", () => {
    // Nine poles, each one integrable as far as the checks go: before the fix only eight were looked at and the verdict
    // was null (the number shown with = or ≈); a dropped ninth pole could be the non-integrable one.
    const answers: [RegExp, string][] = [
      [/^lname\(g\(x\)\)$/, "[x]"],
      [/^lname\(/, "[]"],
      [/^singular\(/, "[1,2,3,4,5,6,7,8,9]"],
      [/^evalf\((\d+),30\)$/, ""],
      [/^limit\(/, "0"],
      [/^int\(abs/, "1"],
    ];
    const giac = fakeGiac((t: string) => {
      const n = /^evalf\((\d+),30\)$/.exec(t);
      if (n) return `${n[1]}.0`;
      return answers.find(([re]) => re.test(t))?.[1] ?? "GIAC_ERROR: unexpected";
    });
    expect(refusalOf(giac, "int(g(x),x,0,10)", "3", 12)).toBe("unchecked");
  });
  // G178 (F115): Giac's answers for ∫₋₁¹ 1/x, the value call stopped as the step budget stopped it at Digits ≤ 14.
  const STOP = "GIAC_ERROR: User interrupt or Out of memory";
  const inverseX = (value: (digits: string) => string, seen: string[] = []) => {
    let digits = "12";
    const answers: [RegExp, string][] = [
      [/^lname\(1\/x\)$/, "[x]"],
      [/^lname\(/, "[]"],
      [/^singular\(/, "[0]"],
      [/^evalf\(-1,30\)$/, "-1.0"],
      [/^evalf\(1,30\)$/, "1.0"],
      [/^evalf\(0,30\)$/, "0.0"],
      [/^limit\(/, "1"],
      [/^evalf\(abs\(1\),30\)$/, "1.0"],
    ];
    return fakeGiac((t: string) => {
      seen.push(t);
      const set = /^Digits:=(\d+)$/.exec(t);
      if (set) return (digits = set[1]!);
      if (t === "int(1/x,x,-1,1)") return value(digits);
      return answers.find(([re]) => re.test(t))?.[1] ?? "GIAC_ERROR: unexpected";
    });
  };
  it("G178: a call inside a larger input is valued at the exact run's Digits, not the display's, which are put back", () => {
    const seen: string[] = [];
    const giac = inverseX((d) => (Number(d) <= 14 ? STOP : "0"), seen);
    expect(refusalOf(giac, "3*int(1/x,x,-1,1)+1", "1", 12)).toBe("integralDiverges");
    expect(seen.filter((t) => /^Digits/.test(t) || t.startsWith("int("))).toEqual(["Digits:=40", "int(1/x,x,-1,1)", "Digits:=12"]);
  });
  it("G178: the Digits a value call puts back are the caller's, and valuePrecision follows them; Giac is not asked", () => {
    const seen: string[] = [];
    expect(refusalOf(inverseX(() => "0", seen), "3*int(1/x,x,-1,1)+1", "1", 35)).toBe("integralDiverges");
    expect(seen.filter((t) => /^Digits/.test(t) || t.startsWith("int("))).toEqual(["Digits:=45", "int(1/x,x,-1,1)", "Digits:=35"]);
  });
  it("G178: a whole-input call costs no value call, so no Digits change either", () => {
    const seen: string[] = [];
    expect(refusalOf(inverseX(() => { throw new Error("no value call expected"); }, seen), "int(1/x,x,-1,1)", "0", 12)).toBe("integralDiverges");
    expect(seen.some((t) => /^Digits/.test(t))).toBe(false);
  });
  it("G178: a value the budget stopped at any Digits still lets the check prove the divergence", () => {
    expect(refusalOf(inverseX(() => STOP), "3*int(1/x,x,-1,1)+1", "1", 12)).toBe("integralDiverges");
  });
  it("G178: a stopped value and a check that proves nothing leave the result unchecked, never kept as checked", () => {
    const answers: [RegExp, string][] = [
      [/^Digits:=/, "12"],
      [/^lname\(1\/x\)$/, "[x]"],
      [/^lname\(/, "[]"],
      [/^singular\(/, "[]"],
      [/^int\(1\/x,/, STOP],
    ];
    const giac = fakeGiac((t: string) => answers.find(([re]) => re.test(t))?.[1] ?? "GIAC_ERROR: unexpected");
    expect(refusalOf(giac, "3*int(1/x,x,-1,1)+1", "1", 12)).toBe("unchecked");
  });
});

describe.skipIf(!giacAvailable())("G39 on the real engine", () => {
  let host: EngineHost;
  let giac: EngineGiac;
  let bridge: GiacBridge;
  beforeAll(async () => {
    const L = await loadNodeGiac();
    ({ bridge } = L);
    giac = engineGiac(L);
    host = new EngineHost(giac, bridge);
  });
  // A generous budget: these tests are about the checks, and a loaded test machine must not send ∫₋₁¹ 1/x to the float
  // path (the golden gate runs the same cases at the default budget, one at a time).
  // G46: typed text gets the parser's angle rule (sin(pasdeg*x)), as the keys' LaTeX would.
  const home = (input: string, angle: "rad" | "deg" = "rad") => host.home(rewriteAngles(input, "typed"), { ...defaultHomeSettings, angle, budgetSteps: 20 * defaultHomeSettings.budgetSteps }).result;
  const cas = (input: string, angle: "rad" | "deg" = "rad") => host.cas(rewriteAngles(input, "typed"), { ...defaultCasSettings, angle }).result;

  it("G178: at Home's own budget a divergent integral inside a larger input is refused like the bare one", () => {
    for (const input of ["int(1/x,x,-1,1)", "3*int(1/x,x,-1,1)+1", "int(1/x,x,-1,1)^2+sin(1)"]) {
      expect(host.home(rewriteAngles(input, "typed"), defaultHomeSettings).result).toMatchObject({ ok: false, error: "integralDiverges" });
    }
  });
  it("G178: a check a step stopped keeps the result with ⚠, and its why says the check did not finish (Home and CAS)", () => {
    const stopped = { ...giac, eval: (t: string) => (/^int\(abs\(/.test(t) ? "GIAC_ERROR: Stopped by user interruption." : giac.eval(t)) };
    const h = new EngineHost(stopped, bridge);
    const r = h.home("int(1/sqrt(x),x,0,1)", { ...defaultHomeSettings, budgetSteps: 1e7 }).result;
    expect(r).toMatchObject({ ok: true, display: "2", approximate: true, facts: { warn: "unchecked", why: { existsUnchecked: true } } });
    expect(h.cas("3*int(1/sqrt(x),x,0,1)+1", defaultCasSettings).result).toMatchObject({ ok: true, facts: { warn: "unchecked", why: { existsUnchecked: true } } });
    expect(host.home("int(1/sqrt(x),x,0,1)", { ...defaultHomeSettings, budgetSteps: 1e7 }).result.facts).toMatchObject({ exact: true });
  });

  it.each([
    ["int(1/x,x,-1,1)", "integralDiverges"],
    ["int(1/(x-1),x,0,2)", "integralDiverges"],
    ["int(tan(x),x,0,pi)", "integralDiverges"],
    ["int(tan(2*x),x,0,pi)", "integralDiverges"],
    ["int(1/x^3,x,-1,1)", "integralDiverges"],
    ["int(1/(x-2)^3,x,0,3)", "integralDiverges"],
    ["3*int(1/x,x,-1,1)+1", "integralDiverges"],
    ["sum(cos(k),k,1,inf)", "seriesDiverges"],
    ["sum(sin(k),k,1,inf)", "seriesDiverges"],
    ["sum(exp(i*k),k,0,inf)", "seriesDiverges"],
    ["sum((-1)^k,k,0,inf)", "seriesDiverges"],
    ["limit(sin(x),x,inf)", "noLimit"],
    // G305: one-sided limits that differ (Giac's error), at an exact and at a typed decimal point (exact in the run)
    ["limit(round(x),x,1.5)", "noLimit"],
    ["limit(sign(x),x,0.0)", "noLimit"],
    ["limit(atan(1/x),x,0)", "noLimit"],
  ])("Home and CAS refuse %s", (input, code) => {
    expect(home(input)).toMatchObject({ ok: false, error: code });
    expect(cas(input)).toMatchObject({ ok: false, error: code });
  });

  it("refuses in DEG too: the poles of tan at 90°, 1/x", () => {
    expect(home("int(tan(x),x,0,180)", "deg")).toMatchObject({ ok: false, error: "integralDiverges" });
    expect(home("int(1/x,x,-1,1)", "deg")).toMatchObject({ ok: false, error: "integralDiverges" });
    expect(home("int(tan(x),x,0,45)", "deg")).toMatchObject({ ok: true });
  });

  it("an assignment of a refused value stores nothing", () => {
    expect(home("g39a:=sum(cos(k),k,1,inf)")).toMatchObject({ ok: false, error: "seriesDiverges" });
    expect(home("g39a").display).toBe("g39a");
    expect(cas("g39b:=sum(cos(k),k,1,inf)")).toMatchObject({ ok: false, error: "seriesDiverges" });
    expect(cas("g39b").text).toBe("g39b");
    expect(cas("g39c:=int(1/x,x,-1,1)")).toMatchObject({ ok: false, error: "integralDiverges" });
    expect(cas("g39c").text).toBe("g39c");
    expect(cas("g39d:=sum(1/k^2,k,1,inf)")).toMatchObject({ ok: true });
    expect(cas("g39d").text).toBe("1/6*pi^2");
    // G305: a limit with no value stores nothing, assigned or stored with =>
    expect(home("g305a:=limit(round(x),x,3/2)")).toMatchObject({ ok: false, error: "noLimit" });
    expect(home("g305a").display).toBe("g305a");
    expect(home("limit(round(x),x,3/2)=>g305b")).toMatchObject({ ok: false, error: "noLimit" });
    expect(home("g305b").display).toBe("g305b");
    expect(cas("g305c:=limit(floor(x),x,1)")).toMatchObject({ ok: false, error: "noLimit" });
    expect(cas("g305c").text).toBe("g305c");
  });

  it("a trig integrand that is not periodic: every pole of the trig part in [a, b] is checked", () => {
    expect(home("int(tan(x)+x,x,2,5)")).toMatchObject({ ok: false, error: "integralDiverges" });
    expect(cas("int(tan(x)+x,x,2,5)")).toMatchObject({ ok: false, error: "integralDiverges" });
    // Giac answers undef here itself; had it given a number (7, say), singular() lists only ±π/2, outside [2, 5], and
    // before the fix the pole at 3π/2 was never looked at.
    expect(refusalOf(giac, "int(tan(x)+x,x,2,5)", "7", 12)).toBe("integralDiverges");
    expect(refusalOf(giac, "int(x*tan(x),x,2,5)", "7", 12)).toBe("integralDiverges");
    // A trig subterm without poles adds no shifts: sin(x)/x keeps its one point (and the sinc case its value).
    expect(refusalOf(giac, "int(sin(x)/x,x,-1,20)", "7", 12)).toBeNull();
  });

  it.each([
    ["sum(1/k^2,k,1,inf)", "1.64493406685"],
    ["sum(cos(k)/k,k,1,inf)", "0.0420195058254"],
    ["sum((-1)^k/k,k,1,inf)", "-0.69314718056"],
    ["int(1/(2+cos(x)),x,0,2*pi)", "3.62759872847"],
    ["int(exp(-x^2),x,-inf,inf)", "1.77245385091"],
    ["int(1/sqrt(x),x,0,1)", "2"],
    ["int(sin(x)/x,x,0,inf)", "1.57079632679"],
    ["sum(1/k!,k,0,inf)", "2.71828182846"],
  ])("keeps %s = %s", (input, shown) => {
    expect(home(input)).toMatchObject({ ok: true, display: shown });
  });

  it("Home: Giac's pair is one value with no digit confirmed and the why-line, never a list", () => {
    const r = home("int(abs(x-sin(10^50)),x,-1,1)");
    expect(r.ok).toBe(true);
    expect(r.items).toBeUndefined();
    expect(r.facts.why).toEqual({ differ: true });
    expect(markOf(precisionFacts(r), { format: "STD", digits: 12 })).toMatchObject({ mark: "⚠", n: 0 });
    // G46: Giac runs in radians in DEG too, so its exact and numeric answers agree: pi/4 (source: oracle)
    const d = home("int(1/(1+x^2),x,0,1)", "deg");
    expect(d.items).toBeUndefined();
    expect(d.display).toBe("0.785398163397");
    expect(markOf(precisionFacts(d), { format: "STD", digits: 12 })).toMatchObject({ mark: "≈" });
  });

  it("G176f1: a limit left unevaluated (patch 0035) is drawn with its point and side, in CAS and Home, and keeps ⚠", () => {
    // Patch 0035 returned limit(e,x,a,side), which Giac's texprintaslimit draws as a bare \lim (it reads limit(e,x=a[,side]))
    const shown: [string, string, string][] = [
      ["limit(trunc(g176a*x),x,1,-1)", "limit(trunc(g176a*x),x=1,-1)", "\\lim _{x=1^-}\\mathrm{trunc}\\left(\\mathrm{g176a}\\cdot x\\right)"],
      ["limit(trunc(x),x,g176y,1)", "limit(trunc(x),x=g176y,1)", "\\lim _{x=\\mathrm{g176y}^+}\\mathrm{trunc}\\left(x\\right)"],
      ["limit(trunc(sin(1/x)/2),x,0)", "limit(trunc(sin(1/x)/2),x=0)", "\\lim _{x=0}\\mathrm{trunc}\\left(\\frac{\\sin\\left(x^{-1}\\right)}{2}\\right)"],
    ];
    for (const [input, text, latex] of shown) {
      expect(cas(input)).toMatchObject({ ok: true, text, latex, facts: { warn: "unchecked" } });
      const h = home(input);
      expect(h).toMatchObject({ ok: true, display: text, latex, facts: { warn: "unchecked" } });
      expect(markOf(precisionFacts(h), { format: "STD", digits: 12 })?.mark).toBe("⚠");
    }
  });

  it("CAS: Giac's pair is shown as Giac's text, both answers, with ⚠", () => {
    const r = cas("int(abs(x-sin(10^50)),x,-1,1)");
    expect(r).toMatchObject({ ok: true, approximate: true, facts: { warn: "unchecked", why: { differ: true } } });
    expect(r.numeric).toBeUndefined();
    expect(r.text).toMatch(/^\[.*,1\.35506364264\]$/);
  });
});
