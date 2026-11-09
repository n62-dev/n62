// SPDX-License-Identifier: GPL-3.0-or-later
// G172 (F73, F93): an element of a list or matrix that only a double can value shows its number with ⚠, the double
// fallback per element; an element MPFR values keeps its own facts, a free name keeps the whole result symbolic. Values:
// besselj(1,2) = 0.576724807756873 (mpmath, at 30 digits). And a decimal inside a string is no float (hasFloat).
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { engineGiac, giacAvailable, loadNodeGiac } from "./nodeGiac.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { hasFloat } from "./numeric.ts";
import { MAX_DOUBLE_ELEMENTS } from "./doubleElements.ts";

describe("G172: hasFloat skips strings", () => {
  it("reads no float inside a string", () => {
    expect(hasFloat('"1.5"')).toBe(false);
    expect(hasFloat('list["a 2.5",1/3]')).toBe(false);
  });
  it("still reads a float beside a string", () => {
    expect(hasFloat('list["a",1.5]')).toBe(true);
    expect(hasFloat("0.5*x")).toBe(true);
  });
});

describe.skipIf(!giacAvailable())("G172: the double fallback per element", () => {
  let host: EngineHost;
  let giac: { eval(input: string): string };
  beforeAll(async () => {
    const L = await loadNodeGiac();
    giac = L.giac;
    host = new EngineHost(engineGiac(L), L.bridge);
  });
  const home = (input: string, digits = 12) => host.home(input, { ...defaultHomeSettings, digits, workDigits: Math.max(30, digits + 10) }).result;

  it("gives the element only a double values ⚠ and leaves the others their own facts", () => {
    const r = home("list[BesselJ(1,2),1/3]");
    expect(r).toMatchObject({ ok: true, display: "{0.576724807757,0.333333333333}", braces: true, approximate: true });
    expect(r.facts).toMatchObject({ exact: false, warn: "unaudited" });
    expect(r.items).toHaveLength(2);
    expect(r.items![0]!.facts).toMatchObject({ exact: false, reliableDigits: 12, warn: "unaudited" });
    expect(r.items![1]!.facts.exact).toBe(true);
    expect(r.items![1]!.facts.warn).toBeUndefined();
  });

  it("keeps the facts of an element MPFR values beside one only a double values", () => {
    const r = home("[BesselJ(1,2),sqrt(2)]");
    expect(r.display).toBe("[0.576724807757,1.41421356237]");
    expect(r.items![1]!.facts.warn).toBeUndefined();
    expect(r.items![1]!.facts.reliableDigits).toBeGreaterThanOrEqual(12);
  });

  it("holds the numbers in Ans, the exact element exact", () => {
    home("list[BesselJ(1,2),1/3]");
    expect(giac.eval("pasans")).toMatch(/^list\[0\.5767248077\d*,1\/3\]$/); // the printed digits follow the engine's Digits
    expect(home("pasans[0]*2").display).toBe("1.15344961551");
  });

  it("holds them in a matrix too", () => {
    const r = home("matrix(1,2,BesselJ(1,2))");
    expect(r.shape).toEqual([1, 2]);
    expect(giac.eval("pasans[0][1]")).toMatch(/^0\.5767248077\d*$/);
  });

  it("stores the numbers in the name of an assignment", () => {
    const r = home("LD:=[BesselJ(1,2),1/3]");
    expect(r.display).toBe("[0.576724807757,0.333333333333]");
    expect(giac.eval("LD")).toMatch(/^\[0\.5767248077\d*,1\/3\]$/);
  });

  it("keeps a whole result with a free name symbolic and Ans untouched", () => {
    const r = home("list[x,BesselJ(1,2)]");
    expect(r).toMatchObject({ ok: true, display: "{x,BesselJ(1,2)}" });
    expect(r.items).toBeUndefined();
    expect(r.facts.warn).toBeUndefined();
    expect(giac.eval("pasans")).toBe("list[x,BesselJ(1,2)]");
  });

  // G153 per element: the first element is atanh(89999/10^1003)'s cancelling form (fallbackCount.test.ts), a number at P
  // and none at P + 20, so the double confirms no digit; right value about -2298.085 (derived there), the double says -70.
  it("gives no count to an element whose number is lost at P + 20, beside an unaudited one", () => {
    const r = home("[ln(ln((10^1003+89999)/(10^1003-89999))/2),BesselJ(1,2)]");
    expect(r.ok).toBe(true);
    expect(r.items![0]!.facts.reliableDigits).toBeNull();
    expect(r.items![1]!.facts.reliableDigits).toBe(12);
    expect(r.facts.warn).toBeDefined();
    expect(r.facts.reliableDigits).toBeNull();
  });

  it("stops at MAX_DOUBLE_ELEMENTS: a longer list stays Giac's text", () => {
    expect(home(`seq(BesselJ(1,k),k,1,${MAX_DOUBLE_ELEMENTS})`).items).toHaveLength(MAX_DOUBLE_ELEMENTS);
    expect(home(`seq(BesselJ(1,k),k,1,${MAX_DOUBLE_ELEMENTS + 1})`).items).toBeUndefined();
  });

  it("leaves no helper name behind", () => {
    home("list[BesselJ(1,2),1/3]");
    expect(giac.eval("pasel")).toBe("pasel");
    expect(giac.eval("pasdl")).toBe("pasdl");
  });

  it("keeps a decimal inside a string free of ⚠", () => {
    expect(home('"1.5"')).toMatchObject({ ok: true, display: '"1.5"' });
    expect(home('"1.5"').facts.warn).toBeUndefined();
    const r = home('list["a 2.5",1/3]');
    expect(r.ok).toBe(true);
    expect(r.facts.warn).toBeUndefined();
  });
});
