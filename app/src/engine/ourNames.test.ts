// SPDX-License-Identifier: GPL-3.0-or-later
// G341 (F210): every name our Giac text defines or stores starts with `pas` (ourNames.ts OUR_PREFIX) or is in the one
// written list OUR_OTHER_NAMES, so a user's name (the parser and the library reader refuse a `pas` one) never meets
// ours. A new name outside both fails here. Beside statenames.test.ts, which checks the names our text binds (G303).
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { CAS_ANS, isOurName, isOwnName, OUR_OTHER_NAMES, OUR_PREFIX, OUR_STORES } from "./ourNames.ts";
import { ENGINE_DEFINITIONS, WORKER_DEFINITION_NAMES, defaultHomeSettings } from "./homeEval.ts";
import { COMPLEX_DEFINITIONS } from "./complex.ts";
import { ICDF_DEFINITIONS, ICDF_DIGITS, ICDF_FAILED, ICDF_REPLACED } from "./icdf.ts";
import { UNIT_DEFINITIONS } from "../units/evaluate.ts";
import { definedName, splitList } from "./giacPrint.ts";
import { PASDEG } from "./pasdeg.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";
import { EngineHost } from "./host.ts";
import { defaultCasSettings } from "./types.ts";

/** Ours: OUR_PREFIX, or the written list. */
const ours = (n: string): boolean => n.startsWith(OUR_PREFIX) || OUR_OTHER_NAMES.includes(n);

/** The names our definitions define: the tables' keys, eseries and its helper, the unit view's programs (its
 *  `assume(pasdim…)` lines define nothing). */
const DEFINED = [
  ...Object.keys(ENGINE_DEFINITIONS),
  ...Object.keys(COMPLEX_DEFINITIONS),
  ...Object.keys(ICDF_DEFINITIONS),
  ...WORKER_DEFINITION_NAMES,
  ...UNIT_DEFINITIONS.filter((d) => !d.startsWith("assume(")).map((d) => definedName(d) ?? `(no name: ${d.slice(0, 30)})`),
];

describe("G341: our names are ours (static)", () => {
  it("R281: isOwnName, the one test the store after ▶ and the library reader use, holds every name a definition defines", () => {
    expect(DEFINED.filter((n) => !isOwnName(n))).toEqual([]);
    expect(["sigfig", "par", "eseries", "pcasans", "pasmod", "foo_"].filter((n) => !isOwnName(n))).toEqual([]);
    expect(["rate", "A1", "beta_", "e_", "Pas", "sig"].filter((n) => isOwnName(n))).toEqual([]); // the user's names
  });
  it("every name a definition table defines, and every store of ours, starts with pas or is in OUR_OTHER_NAMES", () => {
    expect(DEFINED.length).toBeGreaterThan(70);
    const stores = [...OUR_STORES, PASDEG, ICDF_FAILED, ICDF_DIGITS, CAS_ANS];
    expect([...DEFINED, ...stores].filter((n) => !ours(n))).toEqual([]);
  });

  it("OUR_OTHER_NAMES holds only names in use: a definition, a Giac name icdf.ts replaces, or CAS's answer slot", () => {
    const used = new Set([...DEFINED, ...Object.keys(ICDF_REPLACED), CAS_ANS]);
    expect(OUR_OTHER_NAMES.filter((n) => !used.has(n))).toEqual([]);
    expect(Object.keys(ICDF_REPLACED).filter((n) => !OUR_OTHER_NAMES.includes(n))).toEqual([]);
    expect(OUR_OTHER_NAMES.filter((n) => n.startsWith(OUR_PREFIX))).toEqual([]);
  });

  it("isOurName: the prefix (lower case, leading) and pcasans; the functions a user calls are not refused", () => {
    for (const n of ["pas", "pasx", "pass", "past", "pascal", "pasr_7", "pasc_c", "pasdeg", "pasnew", "pcasans"]) expect(isOurName(n), n).toBe(true);
    for (const n of ["pa", "spas", "Pas", "PASS", "p", "sigfig", "par", "eseries", "normald_icdf"]) expect(isOurName(n), n).toBe(false);
  });

  it("no Find item's Giac name starts with pas (find/functions.yaml: the id, `giac`, the names, an insert's \\operatorname)", () => {
    // `giac` is also the insert of an item without one (tools/find-index/generate.mjs opInsert): `pasmedian` there typed a
    // name the parser now refuses; the item names Giac's `median`, which the parser renames (ourNames.ts CALL_NAME)
    const url = new URL("../../../find/functions.yaml", import.meta.url);
    const items = (parse(readFileSync(url, "utf8")) as { functions: { id: string; giac: string; insert?: string; names?: string[] }[] }).functions;
    expect(items.length).toBeGreaterThan(30);
    const ops = (insert = ""): string[] => [...insert.matchAll(/\\operatorname\{([^}]*)\}/g)].map((m) => m[1]!);
    const typedNames = items.flatMap((f) => [f.id.replace(/^\w+:/, ""), f.giac, ...(f.names ?? []), ...ops(f.insert)]);
    expect(typedNames.filter(isOurName)).toEqual([]);
  });

  it("the generated index, when built (npm run index): no item's id or insert names one of ours", () => {
    // its search words may (step's French alias `pas`, the unit Pa's `pascal`): a pick inserts the id's name or a chip
    const file = new URL("../find/_gen/find-index.json", import.meta.url);
    if (!existsSync(file)) {
      expect(process.env.FIND_INDEX, "FIND_INDEX=required needs npm run index first").not.toBe("required");
      return;
    }
    const items = JSON.parse(readFileSync(file, "utf8")) as { id: string; insert?: string }[];
    expect(items.length).toBeGreaterThan(1000);
    const bad = items.filter((i) => isOurName(i.id.replace(/^\w+:/, "")) || /\\operatorname\{pas/.test(i.insert ?? ""));
    expect(bad.map((i) => i.id)).toEqual([]);
  });
});

describe.skipIf(!giacAvailable())("G341: what our Giac text leaves stored is ours (real Giac)", () => {
  it("after Home, CAS, Solve, analysis, a table and a unit request on a fresh engine, VARS lists only our names", async () => {
    const { giac, bridge } = await loadNodeGiac();
    const h = new EngineHost(giac, bridge);
    const s = defaultHomeSettings;
    // Our definitions, each by the input that loads it; == with a float sets the test's stores; a matrix, a sequence
    const homeInputs = ["1/3", "sqrt(2)", "sigfig(1/3,3)", "pasmod(7,3)", "pasmedian([1,2,3,4])", "paspercentile([1,2,3],50)", "passem([1,2,3])", "par(1,2)",
      "normald_icdf(0,1,0.3)", "student_icdf(3,0.9)", "erf(0.5)", "UTPN(1)", "eseries(6,4.6)", "x==0.5", "1.5==1.5", "atan(1+i)", "linreg([1,2,3],[2,4,7])",
      "stats1([1,2,3])", "shl(1,2)", "sin(30)", "[[1,2],[3,4]]^2", "idn(2)*3", "seq(k,k,1,3)", "evalf(pi,40)"];
    for (const t of homeInputs) h.home(t, s);
    for (const t of ["1-0.9-0.1", "diff(sin(x),x)", "solve(x^2=2,x)", "evalf(sqrt(2))"]) h.cas(t, defaultCasSettings);
    h.solve({ kind: "equations", equations: ["x^2=2"], unknowns: ["x"], guesses: ["1"] }, s);
    h.solve({ kind: "equations", equations: ["k+y=3", "k-y=1"], unknowns: ["k", "y"], guesses: ["1", "1"] }, s);
    h.solve({ kind: "poly", equation: "X^2+1=0", unknown: "X" }, s);
    h.analyze({ kind: "root", f: "x^2-2", x0: "1" }, s);
    h.analyze({ kind: "extremum", f: "x^2-2*x", x0: "0" }, s);
    h.analyze({ kind: "slope", f: "x^3", x0: "2" }, s);
    h.analyze({ kind: "area", f: "x^2", a: "0", b: "1" }, s);
    h.table({ fns: ["x^2"], xs: ["3"] }, s);
    // the job calc/units.ts makes for `2 m` (library.test.ts G83f1)
    h.units({ expr: "2*(((1)*pasdimL^(1)))", number: "2*(((1)))", check: "pasz1*(((1)*pasdimL^(1)))", inexact: false, shows: [{ text: "m", dim: "m1", factor: "1", slot: { tokens: [{ unit: "m" }] } }] }, s);
    const held = splitList(giac.eval("VARS")) ?? [];
    expect(held.length).toBeGreaterThan(40);
    expect(held.filter((n) => !ours(n))).toEqual([]);
  });
});
