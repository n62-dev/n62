// SPDX-License-Identifier: GPL-3.0-or-later
// G223: linreg and stats1 (stats.ts) refuse their data in words in Home and CAS, not with the generic engine error.
// Expected values: least squares in Fraction (the golden cases g223-* in home.yaml, source oracle): slope 97/50,
// intercept 3/20, r² 9409/9450 for x = 1..4, y = 2.1, 3.9, 6.2, 7.8; n, mean, s, σ, min, max of 1..4 are 4, 5/2,
// sqrt(5/3) = sqrt(15)/3, sqrt(5)/2, 1, 4.
import { beforeAll, describe, expect, it } from "vitest";
import type { EngineHost } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { defaultCasSettings } from "./types.ts";
import { giacAvailable, nodeHost } from "./nodeGiac.ts";
import { errorRefusal } from "./converge.ts";
import { STATS_REFUSALS, statsRefusal } from "./stats.ts";
import { enEngine } from "../i18n/enEngine.ts";
import { hasMessage } from "../i18n/index.ts";

describe("G223 statsRefusal", () => {
  it("reads the code a definition threw from Giac's error text", () => {
    expect(statsRefusal('GIAC_ERROR: "n62refusal:xAllEqual" Error: Bad Argument Value')).toBe("xAllEqual");
    expect(statsRefusal('GIAC_ERROR: "n62refusal:listsDiffer" Error: Bad Argument Value Error: Bad Argument Value')).toBe("listsDiffer");
    expect(errorRefusal("linreg([1],[1,2])", 'GIAC_ERROR: "n62refusal:listsDiffer" Error: Bad Argument Value')).toBe("listsDiffer");
  });

  it("reads nothing else: another throw, an unknown code, a plain error", () => {
    expect(statsRefusal('GIAC_ERROR: "median: needs one list of values" Error: Bad Argument Value')).toBeNull();
    expect(statsRefusal('GIAC_ERROR: "n62refusal:noSuchCode" Error: Bad Argument Value')).toBeNull();
    expect(statsRefusal("GIAC_ERROR: Invalid dimension")).toBeNull();
  });
});

describe("G223 the words stay with the worker", () => {
  it("are in the worker's table, not the app's (start chunk): the row shows the worker's text", () => {
    for (const code of STATS_REFUSALS) {
      expect(enEngine[`error.${code}`], code).toBeTruthy();
      expect(hasMessage(`error.${code}`), code).toBe(false);
    }
    expect(hasMessage("error.noLimit")).toBe(true);
  });
});

describe.skipIf(!giacAvailable())("G223 linreg and stats1 in the engine", () => {
  let host: EngineHost;
  const home = (input: string) => host.home(input, defaultHomeSettings).result;
  const cas = (input: string) => host.cas(input, defaultCasSettings).result;
  beforeAll(async () => {
    host = await nodeHost();
  });

  it("answers exactly in CAS", () => {
    expect(cas("linreg([1,2,3,4],[2.1,3.9,6.2,7.8])")).toMatchObject({ ok: true, text: "{97/50,3/20,9409/9450}" });
    expect(cas("stats1([1,2,3,4])")).toMatchObject({ ok: true, text: "{4,5/2,sqrt(15)/3,sqrt(5)/2,1,4}" });
  });

  it("refuses in CAS with the words Home has, and an assignment stores nothing", () => {
    expect(cas("linreg([1,1,1],[1,2,3])")).toMatchObject({ ok: false, error: "xAllEqual", text: "The x values are all equal" });
    expect(cas("linreg([1,2],[3,3])")).toMatchObject({ ok: false, error: "yAllEqual" });
    expect(cas("stats1([])")).toMatchObject({ ok: false, error: "emptyList" });
    expect(cas("W223:=linreg([1,2],[1])")).toMatchObject({ ok: false, error: "listsDiffer" });
    expect(cas("W223")).toMatchObject({ ok: true, text: "W223" });
  });

  it("refuses through a stored function and inside a larger input", () => {
    expect(home("g223(a,b):=linreg(a,b)")).toMatchObject({ ok: true });
    expect(home("g223([1],[1,2])")).toMatchObject({ ok: false, error: "listsDiffer", display: "The lists have different lengths" });
    expect(home("2*stats1([5])")).toMatchObject({ ok: false, error: "fewValues" });
  });

  it("takes Giac's list type (braces) and loose values are no list", () => {
    expect(home("stats1(list[1,2,3,4])")).toMatchObject({ ok: true, display: "{4,2.5,1.29099444874,1.11803398875,1,4}" });
    expect(home("stats1(1,2,3)")).toMatchObject({ ok: false, error: "notData" });
    expect(home("linreg(list[1,2,3,4],list[2.1,3.9,6.2,7.8])")).toMatchObject({ ok: true, display: "{1.94,0.15,0.995661375661}" });
    expect(home("linreg([1,2],[3,4],[5,6])")).toMatchObject({ ok: false, error: "notData" });
  });

  // G353 step 4: the mark of stats1 on a stored float list of equal values depended on what ran before (a linreg line between
  // gave ≈ 9.86E-32*i, without it ⚠ 1E-31*i): the facts' perturbation check met two rounding residues. Equal values now give
  // exactly 0 (derived: no spread), and the value and its facts are the same in both orders, in one session.
  it("gives stats1 of equal stored floats the same value and facts with or without a linreg line before it", () => {
    expect(home("L353:=approx([1/10,1/10,1/10])")).toMatchObject({ ok: true });
    const first = home("stats1(L353)");
    expect(home("linreg(L353,[1,2,3])")).toMatchObject({ ok: false, error: "xAllEqual" });
    expect(home("linreg([1,2,3],L353)")).toMatchObject({ ok: false, error: "yAllEqual" });
    const second = home("stats1(L353)");
    expect(first).toMatchObject({ ok: true, display: "[3,0.1,0,0,0.1,0.1]" });
    expect(second.display).toBe(first.display);
    expect(second.facts).toEqual(first.facts);
    expect(first.facts.warn).toBeUndefined();
  });
});

// G361: linterp(xs, ys, x), the straight line between the two rows around x. Expected values derived in exact fractions:
// G356's 11-point table at 0.9 lies halfway between (0.8, 0.0588) and (1, 0.0385), so (0.0588 + 0.0385)/2 = 973/20000;
// |x-2| sampled at 0..5 at 2.5 is halfway between (2, 0) and (3, 1), so 1/2.
describe.skipIf(!giacAvailable())("G361 linterp in the engine", () => {
  let host: EngineHost;
  const home = (input: string) => host.home(input, defaultHomeSettings).result;
  const cas = (input: string) => host.cas(input, defaultCasSettings).result;
  const TABLE = "[-1,-0.8,-0.6,-0.4,-0.2,0,0.2,0.4,0.6,0.8,1],[0.0385,0.0588,0.1,0.2,0.5,1,0.5,0.2,0.1,0.0588,0.0385]";
  beforeAll(async () => {
    host = await nodeHost();
  });

  it("answers exactly between two rows, at a row and at the ends", () => {
    expect(cas(`linterp(${TABLE},0.9)`)).toMatchObject({ ok: true, text: "973/20000" });
    expect(home(`linterp(${TABLE},0.9)`)).toMatchObject({ ok: true, display: "0.04865", facts: { exact: true } });
    expect(home("linterp([0,1,2,3,4,5],[2,1,0,1,2,3],5/2)")).toMatchObject({ ok: true, display: "0.5", facts: { exact: true } });
    expect(cas("linterp([0,1,2,3,4,5],[2,1,0,1,2,3],0)")).toMatchObject({ ok: true, text: "2" });
    expect(cas("linterp([0,1,2,3,4,5],[2,1,0,1,2,3],2)")).toMatchObject({ ok: true, text: "0" });
    expect(cas("linterp([0,1,2,3,4,5],[2,1,0,1,2,3],5)")).toMatchObject({ ok: true, text: "3" });
    expect(home("linterp(list[0,1],list[0,10],1/4)")).toMatchObject({ ok: true, display: "2.5" });
  });

  it("refuses in words: outside the table, xs not increasing, lists that differ, too few points, no x", () => {
    expect(home(`linterp(${TABLE},1.1)`)).toMatchObject({ ok: false, error: "tableOutside", display: "x is outside the table" });
    expect(home(`linterp(${TABLE},-1.1)`)).toMatchObject({ ok: false, error: "tableOutside" });
    expect(home("linterp([0,2,1],[1,2,3],1)")).toMatchObject({ ok: false, error: "tableOrder", display: "The x values must be strictly increasing" });
    expect(home("linterp([0,1,1],[1,2,3],1)")).toMatchObject({ ok: false, error: "tableOrder" });
    expect(home("linterp([0,1,2],[1,2],1)")).toMatchObject({ ok: false, error: "listsDiffer", display: "The lists have different lengths" });
    expect(home("linterp([],[],1)")).toMatchObject({ ok: false, error: "emptyList" });
    expect(home("linterp([1],[5],1)")).toMatchObject({ ok: false, error: "tablePoints" });
    expect(home("linterp([0,1],[0,1])")).toMatchObject({ ok: false, error: "tableArgs" });
    expect(home("linterp([0,1],[0,1],a)")).toMatchObject({ ok: false, error: "tableArgs" });
    expect(home("linterp([0,1],[0,1],i)")).toMatchObject({ ok: false, error: "tableArgs" });
    expect(home("linterp([0,a],[0,1],1/2)")).toMatchObject({ ok: false, error: "notData" });
    expect(cas("W361:=linterp([0,1],[0,1],2)")).toMatchObject({ ok: false, error: "tableOutside" });
  });

  it("gives ≈ for a float input and for an irrational value", () => {
    expect(home("linterp([0,1],[0,1],approx(1/3))")).toMatchObject({ ok: true, display: "0.333333333333", facts: { exact: false } });
    expect(home("linterp([0,1],[0,sqrt(2)],1/2)")).toMatchObject({ ok: true, display: "0.707106781187", facts: { exact: false } });
  });
});
