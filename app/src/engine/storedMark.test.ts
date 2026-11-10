// SPDX-License-Identifier: GPL-3.0-or-later
// G179 (F63): a stored value read later shows the text and the mark it left its line with (the sequence sweep's invariant,
// tools/probes/sweep/seq.ts). Expected values: the line the value left (source: derived), and BesselJ(1,2) =
// 0.576724807756873… (source: oracle, mpmath.besselj(1,2)), whose 14 digits are 0.57672480775687 and 12 are 0.576724807757.
import { beforeEach, describe, expect, it } from "vitest";
import type { EngineHost } from "./host.ts";
import { defaultHomeSettings, precisionFacts, type HomeResult } from "./homeEval.ts";
import { markOf } from "./format.ts";
import { applyDefChanges, type DefEntry } from "./defs.ts";
import { giacAvailable, nodeHost } from "./nodeGiac.ts";

const settings = (digits: number) => ({ ...defaultHomeSettings, digits, workDigits: Math.max(30, digits + 10) });
const seen = (r: HomeResult, digits: number): [string, string] => {
  const m = r.ok && r.value ? markOf(precisionFacts(r), { format: "STD", digits }) : null;
  return [`${m?.mark ?? ""}${m?.n ?? ""}`, r.display];
};

const CASES: readonly (readonly [number, [string, string]])[] = [
  [12, ["⚠", "0.576724807757"]],
  [30, ["⚠14", "0.57672480775687"]],
];
const STORES: readonly (readonly [string, string])[] = [
  ["a:=", "a:=(BesselJ(1,2))"],
  ["=>", "(BesselJ(1,2))=>a"],
  ["sto", "sto(BesselJ(1,2),a)"],
];

describe.skipIf(!giacAvailable())("G179 (F63): a stored ⚠ value read later keeps its mark", () => {
  let host: EngineHost;
  let log: DefEntry[];
  const home = (line: string, digits: number): HomeResult => {
    const { result, defs } = host.home(line, settings(digits));
    log = applyDefChanges(log, defs);
    return result;
  };
  beforeEach(async () => {
    host = await nodeHost();
    log = [];
  });

  for (const [digits, left] of CASES) {
    for (const [form, store] of STORES) {
      it(`${digits} digits, ${form}: it leaves its line as ${left.join(" ")}`, () => {
        expect(seen(home(store, digits), digits)).toEqual(left);
      });

      it(`${digits} digits, ${form}: read by its name`, () => {
        home(store, digits);
        expect(seen(home("a", digits), digits)).toEqual(left);
      });

      it(`${digits} digits, ${form}: read through f(t):=t`, () => {
        home(store, digits);
        home("f(t):=t", digits);
        expect(seen(home("f(a)", digits), digits)).toEqual(left);
      });

      it(`${digits} digits, ${form}: read after a relaunch`, async () => {
        home(store, digits);
        host = await nodeHost();
        host.restore(log);
        expect(seen(host.home("a", settings(digits)).result, digits)).toEqual(left);
      });
    }
  }

  it("guard: a line that computes with the value is checked as before: the cancellation still costs its digits", () => {
    home("a:=(BesselJ(1,2))", 12);
    const r = home("a-0.5767248077", 12);
    expect(r.facts.warn).toBe("unaudited");
    expect(r.facts.reliableDigits).toBeLessThan(6);
  });

  it("guard: two names read: the value of one is no read of that one alone", () => {
    home("a:=(BesselJ(1,2))", 12);
    home("b:=(BesselJ(2,2))", 12);
    home("f(s,t):=s", 12);
    const r = home("f(a,b)", 12);
    expect(r.facts.warn).toBe("unaudited");
    expect(r.facts.reliableDigits).toBeLessThan(12);
  });
});
