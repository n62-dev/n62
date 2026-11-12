// SPDX-License-Identifier: GPL-3.0-or-later
// S53f1 (store-bu-1): a variable set from a result is logged with the mark the history gave that result (`mark`), so Vars
// draws it: 1/3 stores no facts and prints rounded (≈), 5 prints as it is (=), a list holding 1/3 is ≈ too.
// Expected: 1/3 = 0.3333… (derived).
import { describe, expect, it } from "vitest";
import { defaultHomeSettings } from "./homeEval.ts";
import { giacAvailable, nodeHost } from "./nodeGiac.ts";
import { defaultCasSettings } from "./types.ts";

describe.skipIf(!giacAvailable())("S53f1: the log notes the mark of the stored result", () => {
  const entry = async (line: string) => {
    const host = await nodeHost();
    const sets = host.home(line, defaultHomeSettings).defs.flatMap((c) => ("set" in c ? [c.set] : []));
    return sets.find((e) => e.name === "A");
  };
  it("1/3 ▶ A: no facts, mark ≈", async () => {
    const e = await entry("1/3 => A");
    expect(e?.preview).toBe("0.333333333333");
    expect(e?.facts).toBeUndefined();
    expect(e?.mark).toBe("≈");
  });
  it("control: 5 ▶ A is exact as shown, mark =", async () => {
    const e = await entry("5 => A");
    expect(e?.mark).toBe("=");
    expect(e?.facts).toBeUndefined();
  });
  it("a list holding 1/3 stores no facts and is marked ≈ (its weakest element)", async () => {
    const e = await entry("[1/3,1] => A");
    expect(e?.facts).toBeUndefined();
    expect(e?.mark).toBe("≈");
  });
  it("a list of exact elements keeps =", async () => {
    expect((await entry("[1,2] => A"))?.mark).toBe("=");
  });
  it("a float keeps its facts", async () => {
    const e = await entry("approx(sqrt(2)) => A");
    expect(e?.facts).toBeDefined();
  });
});

// G317 (Opus pass 135): a name set beside the result (inside it, or one of a list assignment's) holds its own value, not
// the result: its preview is that value as Home prints it, its mark from that value. The store target of `X ▶ A` and
// `A:=X` keeps the result's (the controls above). Expected: A holds what its own store gave (derived: 1/3 = 0.3333…, 5).
describe.skipIf(!giacAvailable())("G317: a name set beside the result keeps its own value and mark", () => {
  const sets = async (line: string, cas = false) => {
    const host = await nodeHost();
    const out = cas ? host.cas(line, defaultCasSettings) : host.home(line, defaultHomeSettings);
    return { host, sets: out.defs.flatMap((c) => ("set" in c ? [c.set] : [])) };
  };
  it("(A:=1/3)*0: A previews 0.333333333333 with ≈, not the result 0", async () => {
    const { host, sets: s } = await sets("(A:=1/3)*0");
    const a = s.find((e) => e.name === "A");
    expect(a?.preview).toBe("0.333333333333");
    expect(a?.mark).toBe("≈");
    // Ans is still the result
    expect(host.home("Ans", defaultHomeSettings).result.display).toBe("0");
  });
  it("(A:=5)+1: A previews 5 with =, not the result 6", async () => {
    const a = (await sets("(A:=5)+1")).sets.find((e) => e.name === "A");
    expect(a?.preview).toBe("5");
    expect(a?.mark).toBe("=");
  });
  it("A,B:=5,1/3: A is 5 with =, B is 0.333333333333 with ≈", async () => {
    const s = (await sets("A,B:=5,1/3")).sets;
    const a = s.find((e) => e.name === "A");
    const b = s.find((e) => e.name === "B");
    expect([a?.preview, a?.mark]).toEqual(["5", "="]);
    expect([b?.preview, b?.mark]).toEqual(["0.333333333333", "≈"]);
  });
  it("CAS (A:=1/3)*0: A previews its own value", async () => {
    const a = (await sets("(A:=1/3)*0", true)).sets.find((e) => e.name === "A");
    expect(a?.preview).toBe("1/3");
  });
  // Fix round 1: a float made at P (CAS runs at valuePrecision(12) = 40) prints at the view's digits, as the CAS view
  // shows it, never P's unchecked digits. Expected: approx(1/3) at 12 digits (derived).
  it("CAS (A:=approx(1/3))*0: A previews 0.333333333333, not P's 40 digits", async () => {
    const a = (await sets("(A:=approx(1/3))*0", true)).sets.find((e) => e.name === "A");
    expect(a?.preview).toBe("0.333333333333");
  });
  it("CAS A,B:=approx(1/3),2: A previews 0.333333333333, B 2", async () => {
    const s = (await sets("A,B:=approx(1/3),2", true)).sets;
    expect(s.find((e) => e.name === "A")?.preview).toBe("0.333333333333");
    expect(s.find((e) => e.name === "B")?.preview).toBe("2");
  });
});

// G328 (F215): a name set beside the result stores its own facts, not the result's: `(A:=5)*approx(1)` stores an exact 5
// (no facts), so a later `A*2` is 10 exact. The store target keeps the result's facts (controls). Expected values derived:
// 5*2 = 10, (1/3)*2 = 2/3 = 0.666666666667 at 12 digits; an inexact side value's facts are those of the same value stored
// as a target (`approx(1/3) => A`, the facts of A typed alone).
describe.skipIf(!giacAvailable())("G328: a name set beside the result stores its own facts", () => {
  const run = async (line: string, cas = false) => {
    const host = await nodeHost();
    const out = cas ? host.cas(line, defaultCasSettings) : host.home(line, defaultHomeSettings);
    const sets = out.defs.flatMap((c) => ("set" in c ? [c.set] : []));
    return { host, out, sets, get: (n: string) => sets.find((e) => e.name === n) };
  };
  const twice = (host: Awaited<ReturnType<typeof nodeHost>>) => host.home("A*2", defaultHomeSettings).result;
  it("(A:=5)*approx(1): A stores no facts; A*2 is 10 exact, also after a replay", async () => {
    const { host, sets, get } = await run("(A:=5)*approx(1)");
    expect(get("A")?.facts).toBeUndefined();
    const r = twice(host);
    expect([r.display, r.facts.exact, r.facts.warn]).toEqual(["10", true, undefined]);
    const fresh = await nodeHost();
    fresh.restore(sets);
    const f = twice(fresh);
    expect([f.display, f.facts.exact, f.facts.warn]).toEqual(["10", true, undefined]);
  });
  it("A,B:=5,approx(2): A exact, B keeps its ⚠ facts", async () => {
    const { host, get } = await run("A,B:=5,approx(2)");
    expect(get("A")?.facts).toBeUndefined();
    expect(get("B")?.facts?.warn).toBe("unchecked");
    const r = twice(host);
    expect([r.display, r.facts.exact, r.facts.warn]).toEqual(["10", true, undefined]);
  });
  it("(A:=1/3)*approx(2): A stores no facts (≈ only); A*2 is 0.666666666667 ≈", async () => {
    const { host, get } = await run("(A:=1/3)*approx(2)");
    expect(get("A")?.facts).toBeUndefined();
    expect(get("A")?.mark).toBe("≈");
    const r = twice(host);
    expect([r.display, r.facts.exact, r.facts.warn]).toEqual(["0.666666666667", true, undefined]);
  });
  it("(A:=approx(1/3))*(B:=5): A keeps its own unchecked facts, those of approx(1/3) => A; B stores none", async () => {
    const own = (await run("approx(1/3) => A")).get("A")?.facts;
    expect(own?.warn).toBe("unchecked");
    const both = await run("(A:=approx(1/3))*(B:=5)");
    expect(both.get("A")?.facts).toEqual(own);
    expect(both.get("B")?.facts).toBeUndefined();
  });
  // The store target's facts are the result's (EngineHost.factsOf: exact false, its digits and warn).
  it("controls: the store target keeps the result's facts; (A:=5)*0.5; CAS (A:=5)*approx(1)", async () => {
    for (const line of ["A:=approx(5)", "approx(5) => A"]) {
      const { out, get } = await run(line);
      const { reliableDigits, warn } = out.result.facts;
      expect(get("A")?.facts).toEqual({ exact: false, reliableDigits, ...(warn ? { warn } : {}) });
    }
    const half = await run("(A:=5)*0.5");
    expect(half.get("A")?.facts).toBeUndefined();
    expect(twice(half.host).facts.exact).toBe(true);
    const cas = await run("(A:=5)*approx(1)", true);
    expect(cas.get("A")?.facts).toBeUndefined();
    expect(twice(cas.host).facts.exact).toBe(true);
  });
});
