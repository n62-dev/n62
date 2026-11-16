// SPDX-License-Identifier: GPL-3.0-or-later
// G392: a Home result names the stored names it read whose definitions-log entry holds a unit (G371's DefEntry.unit),
// so the row says the unit was dropped (Home has no units, P8), against the real Giac build (skipped when no build is
// found; see nodeGiac.ts). Expected values: X stored from a 5 km chip is 5 in Home, so X+3 is 8 and f(2) with
// f(t):=t*X is 10 (derived).
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { applyDefChanges, type DefEntry } from "./defs.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";
import { chipFactsOf } from "../state/resultItem.ts";

describe.skipIf(!giacAvailable())("a Home row that reads a name stored with a unit names it (G392)", () => {
  let host: EngineHost;
  let log: DefEntry[] = [];
  beforeAll(async () => {
    const L = await loadNodeGiac();
    host = new EngineHost(L.giac, L.bridge);
  });
  const km = { text: "km", dim: "m1", slot: { tokens: [{ prefix: "k", unit: "m" }] } };
  const home = (i: string, chips?: Parameters<typeof chipFactsOf>[0]) => {
    const out = host.home(i, defaultHomeSettings, undefined, chips && chipFactsOf(chips));
    log = applyDefChanges(log, out.defs);
    return out.result;
  };

  it("X stored from a 5 km chip: X+3 is 8 and names X among the names read with a unit", () => {
    home("X:=pasr_1", { "1": { value: "5", exact: true, unit: km } });
    expect(log.find((e) => e.name === "X")?.unit).toEqual(km);
    const r = home("X+3");
    expect(r.display).toBe("8");
    expect(r.unitNames).toEqual(["X"]);
  });

  it("a function f(t):=t*X, then f(2): 10, X named (reached through the function only)", () => {
    expect(home("f(t):=t*X").ok).toBe(true);
    const r = home("f(2)");
    expect(r.display).toBe("10");
    expect(r.unitNames).toEqual(["X"]);
  });

  it("after a relaunch (a fresh engine given the log), f(2) still names X", async () => {
    const next = await loadNodeGiac();
    const h = new EngineHost(next.giac, next.bridge);
    h.restore(log);
    const r = h.home("f(2)", defaultHomeSettings).result;
    expect(r.display).toBe("10");
    expect(r.unitNames).toEqual(["X"]);
    expect(h.home("X*2", defaultHomeSettings).result.unitNames).toEqual(["X"]);
  });

  it("controls: a name stored from a plain number (A:=5), A+3: none; a line with no stored name: none", () => {
    home("A:=5");
    const r = home("A+3");
    expect(r.display).toBe("8");
    expect(r.unitNames).toBeUndefined();
    expect(home("1+1").unitNames).toBeUndefined();
  });
});
