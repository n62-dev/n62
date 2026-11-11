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
import { statsRefusal } from "./stats.ts";

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
});
