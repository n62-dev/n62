// SPDX-License-Identifier: GPL-3.0-or-later
// G221f1: a free name passed to one of our Giac programs stays a free name. It is read through no parameter or local of
// the program (student_cdf(x,1) showed 0.75, x read as pascdfok's own x), so it never gives a number.
import { beforeAll, describe, expect, it } from "vitest";
import { defaultHomeSettings } from "./homeEval.ts";
import { ICDF_DEFINITIONS, boundNames } from "./icdf.ts";
import { giacAvailable, nodeHost } from "./nodeGiac.ts";
import type { EngineHost } from "./host.ts";
import { defaultCasSettings } from "./types.ts";

/** The letters that are a free name in Giac: e is Giac's constant exp(1), a real number (student_cdf(e,1) has a value). */
const LETTERS = [..."abcdefghijklmnopqrstuvwxyz"].filter((c) => c !== "e");
/** The definitions the forward functions reach. */
const REACHED = ["paslg", "pasbetacf", "paserf", "paserfc", "pasibeta", "pasigamma", "pasicdft", "pascdfok", "pascdf1", "pascdf2", "passtudent_cdf", "paschisquare_cdf", "pasnormald_cdf", "pasutpn"];
const BOUND = [...new Set(REACHED.flatMap((d) => boundNames(ICDF_DEFINITIONS[d]!)))];
/** A number as Home and CAS show it. */
const isNumber = (s: string): boolean => /^[-+]?\d*\.?\d+(E[-+]?\d+)?$/.test(s.trim());

describe("the names the definitions bind", () => {
  it("are all out of a user's way (the pas prefix)", () => {
    expect(BOUND.length).toBeGreaterThan(20);
    expect(BOUND.filter((n) => !n.startsWith("pas"))).toEqual([]);
  });
  it("reads the parameters and the locals of a definition", () => {
    expect(boundNames("f(a,b):={ local c,d; return a; }")).toEqual(["a", "b", "c", "d"]);
    expect(boundNames("f(x):=x+1")).toEqual(["x"]);
  });
});

describe.skipIf(!giacAvailable())("a free name gives no number (real Giac)", () => {
  let host: EngineHost;
  beforeAll(async () => {
    host = await nodeHost();
  });
  const home = (input: string): string => {
    const r = host.home(input, { ...defaultHomeSettings, digits: 12, angle: "rad", workDigits: 30 }).result;
    return r.ok ? r.display : `error: ${r.error}`;
  };
  const cas = (input: string): string => {
    const r = host.cas(input, { ...defaultCasSettings, digits: 12, angle: "rad" }).result;
    return r.ok ? r.text : `error: ${r.error}`;
  };
  const numbers = (inputs: string[]): string[] =>
    inputs.flatMap((input) => [`home ${input} = ${home(input)}`, `cas ${input} = ${cas(input)}`]).filter((line) => isNumber(line.split(" = ")[1]!));
  const FORMS = (n: string): string[] => [`student_cdf(${n},1)`, `student_cdf(1,${n})`, `chisquare_cdf(${n},1)`, `chisquare_cdf(1,${n})`, `evalf(normald_cdf(${n}))`];

  it("each letter, as the first and the second argument", () => {
    expect(numbers(LETTERS.flatMap(FORMS))).toEqual([]);
  }, 120_000);
  it("each parameter and local of the definitions, the name as it is now and as it was written", () => {
    const short = BOUND.map((n) => n.slice("pas".length));
    expect(numbers([...new Set([...BOUND, ...short])].filter((n) => n !== "e").flatMap(FORMS))).toEqual([]);
  }, 300_000);
  it("the inverse functions, each letter (the same cause: normald_icdf(b,1,0.3) showed 0.475599487292)", () => {
    const INVERSE = (n: string): string[] => [`normald_icdf(${n},1,0.3)`, `normald_icdf(2,${n},0.3)`, `student_icdf(${n},0.5)`, `chisquare_icdf(${n},0.5)`, `fisher_icdf(${n},2,0.5)`];
    expect(numbers(LETTERS.flatMap(INVERSE))).toEqual([]);
  }, 120_000);
  it("a real argument still computes, a stored name still counts", () => {
    expect(home("student_cdf(2.5,1)")).toBe("0.797969486361");
    host.home("g221x:=4", { ...defaultHomeSettings, digits: 12, angle: "rad", workDigits: 30 });
    // 1 - I_{4/5}(2, 1/2)/2 = 0.813049516849970557… (mpmath, the golden case g221f1-stored-x-student)
    expect(home("student_cdf(g221x,1)")).toBe("0.81304951685");
  }, 60_000);
});
