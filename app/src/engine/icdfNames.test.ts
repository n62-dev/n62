// SPDX-License-Identifier: GPL-3.0-or-later
// G221f1: a free name passed to one of our Giac programs stays a free name. It is read through no parameter or local of
// the program (student_cdf(x,1) showed 0.75, x read as pascdfok's own x), so it never gives a number.
import { beforeAll, describe, expect, it } from "vitest";
import { defaultHomeSettings } from "./homeEval.ts";
import { ICDF_DEFINITIONS } from "./icdf.ts";
import { giacAvailable, loadNodeGiac, nodeHost } from "./nodeGiac.ts";
import type { EngineHost } from "./host.ts";
import { defaultCasSettings } from "./types.ts";

/** The letters that are a free name in Giac: e is its constant exp(1), a real number (student_cdf(e,1) has a value), and
 *  i its imaginary unit, for which Giac's own value stays, with its ⚠ (chisquare_cdf(i,1) is 0 ⚠ unaudited, as on phase-1).
 *  A typed e and i are the parser's names e_ and i_ (R67), free like the others. */
const LETTERS = [...[..."abcdefghijklmnopqrstuvwxyz"].filter((c) => c !== "e" && c !== "i"), "e_", "i_"];
/** The definitions the forward functions reach, and those the inverse functions add. */
const REACHED = ["paslg", "pasbetacf", "paserf", "paserfc", "pasibeta", "pasigamma", "pasicdft", "pascdfok", "pascdf1", "pascdf2", "passtudent_cdf", "paschisquare_cdf", "pasnormald_cdf", "pasutpn"];
const REACHED_INVERSE = ["pasicdf", "pasnormald_icdf", "passtudent_icdf", "paschisquare_icdf", "pasfisher_icdf"];
/** A number as Home and CAS show it. */
const isNumber = (s: string): boolean => /^[-+]?\d*\.?\d+(E[-+]?\d+)?$/.test(s.trim());
const FORMS = (n: string): string[] => [`student_cdf(${n},1)`, `student_cdf(1,${n})`, `chisquare_cdf(${n},1)`, `chisquare_cdf(1,${n})`, `evalf(normald_cdf(${n}))`];
const INVERSE = (n: string): string[] => [`normald_icdf(${n},1,0.3)`, `normald_icdf(2,${n},0.3)`, `student_icdf(${n},0.5)`, `chisquare_icdf(${n},0.5)`, `fisher_icdf(${n},2,0.5)`];

describe.skipIf(!giacAvailable())("a free name gives no number (real Giac)", () => {
  let host: EngineHost;
  /** The parameters and locals of the definitions, by Giac's own tree (bridge-2's `bound`, as statenames.test.ts). */
  let bound: string[];
  let boundInverse: string[];
  beforeAll(async () => {
    host = await nodeHost();
    const { bridge } = await loadNodeGiac();
    const of = (names: string[]): string[] => [...new Set(names.flatMap((d) => bridge.parse(ICDF_DEFINITIONS[d]!).bound))];
    bound = of(REACHED);
    boundInverse = of(REACHED_INVERSE).filter((n) => !bound.includes(n));
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

  it("each letter, as the first and the second argument", () => {
    expect(numbers(LETTERS.flatMap(FORMS))).toEqual([]);
  }, 120_000);
  it("the bound names are G303's form (ourNames.ts OUR_BOUND), read from Giac's tree", () => {
    expect(bound.length).toBeGreaterThan(20);
    expect(boundInverse.length).toBeGreaterThan(10);
    expect([...bound, ...boundInverse].filter((n) => !/^pas[A-Za-z0-9]+_$/.test(n))).toEqual([]);
  });
  // the name as G221 and G221f1 wrote it (x, pasx): a user can type both; pasx_ itself the parser refuses (OUR_BOUND)
  const written = (names: string[]): string[] =>
    [...new Set(names.flatMap((n) => [n.slice("pas".length, -1), n.slice(0, -1)]))].filter((n) => n !== "e" && n !== "i");
  it("each parameter and local of the forward definitions, the name as G221 and G221f1 wrote it", () => {
    expect(numbers(written(bound).flatMap(FORMS))).toEqual([]);
  }, 300_000);
  it("each parameter and local the inverse definitions add, the same way", () => {
    expect(numbers(written(boundInverse).flatMap(INVERSE))).toEqual([]);
  }, 300_000);
  it("the inverse functions, each letter (the same cause: normald_icdf(b,1,0.3) showed 0.475599487292)", () => {
    expect(numbers(LETTERS.flatMap(INVERSE))).toEqual([]);
  }, 120_000);
  it("a real argument still computes, a stored name still counts", () => {
    expect(home("student_cdf(2.5,1)")).toBe("0.797969486361");
    host.home("g221x:=4", { ...defaultHomeSettings, digits: 12, angle: "rad", workDigits: 30 });
    // 1 - I_{4/5}(2, 1/2)/2 = 0.813049516849970557… (mpmath, the golden case g221f1-stored-x-student)
    expect(home("student_cdf(g221x,1)")).toBe("0.81304951685");
  }, 60_000);
});
