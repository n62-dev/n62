// SPDX-License-Identifier: GPL-3.0-or-later
// G303 (F205): a stored name survives the state read, and no name our Giac text binds takes a user's. Giac's parameters
// and locals are dynamically scoped on the symbol (a value that holds the free symbol `k` is read through a bound `k`),
// so a state read whose own parameter is `k` found that `k` holds itself and purged it. Expected values are derived
// by hand: k:=5 then k+1 is 6, a name stored as 7 reads back and 7+1 is 8.
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { defaultCasSettings } from "./types.ts";
import { applyDefChanges, type DefEntry } from "./defs.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";

const home = { ...defaultHomeSettings, digits: 12 };
const cas = { ...defaultCasSettings, digits: 12 };
const fresh = async (): Promise<EngineHost> => {
  const { giac, bridge } = await loadNodeGiac();
  return new EngineHost(giac, bridge);
};
const shown = (host: EngineHost, input: string): string => {
  const r = host.home(input, home).result;
  return r.ok ? r.display : `error: ${r.display}`;
};
const casShown = (host: EngineHost, input: string): string => {
  const r = host.cas(input, cas).result;
  return r.ok ? r.text : `error: ${r.error ?? "engine"}`;
};

/** Every lower-case letter that names a variable: Giac reads `e` as exp(1) and `i` as the imaginary unit. */
const LETTERS = [..."abcdefghijklmnopqrstuvwxyz"].filter((c) => c !== "e" && c !== "i");

describe.skipIf(!giacAvailable())("G303: a stored name survives Enter", () => {
  let hostH: EngineHost;
  let hostC: EngineHost;
  beforeAll(async () => {
    hostH = await fresh();
    hostC = await fresh();
  });

  it("every letter stored in Home reads back after one Enter and stays in the table", () => {
    for (const c of LETTERS) {
      shown(hostH, `${c}:=7`);
      expect(shown(hostH, `${c}+1`), c).toBe("8");
      expect(hostH.stored.get(c)?.text, c).toBe("7");
    }
    for (const c of LETTERS) expect(hostH.stored.has(c), c).toBe(true);
  });

  it("every letter stored in CAS reads back after one Enter and stays in the table", () => {
    for (const c of LETTERS) {
      casShown(hostC, `${c}:=7`);
      expect(casShown(hostC, `${c}+1`), c).toBe("8");
      expect(hostC.stored.get(c)?.text, c).toBe("7");
    }
    for (const c of LETTERS) expect(hostC.stored.has(c), c).toBe(true);
  });

  it("the letters e and i stay Giac's constants (they are not names: no entry in the table)", async () => {
    const host = await fresh();
    host.home("e:=7", home);
    host.home("i:=7", home);
    expect(shown(host, "e+1")).toBe("3.71828182846");
    expect(shown(host, "i+1")).toBe("1+i");
    expect(host.stored.has("e")).toBe(false);
    expect(host.stored.has("i")).toBe(false);
  });

  it.each([
    ["k:=5", "k+1", "6"],
    ["k(u):=u+2", "k(3)", "5"],
    ["k:=[1,2]", "k", "[1,2]"],
  ])("%s then %s (Home, CAS, Home after the log's replay)", async (store, read, want) => {
    const h = await fresh();
    const defs = h.home(store, home).defs;
    expect(shown(h, read)).toBe(want);
    expect(h.stored.has("k")).toBe(true);
    const c = await fresh();
    c.cas(store, cas);
    expect(casShown(c, read)).toBe(want);
    const again = await fresh();
    again.restore(applyDefChanges([] as DefEntry[], defs));
    expect(shown(again, read)).toBe(want);
    expect(again.stored.has("k")).toBe(true);
  });
});

describe.skipIf(!giacAvailable())("G303: a name our programs bind does not capture a free name of the user", () => {
  // a free `n` and a free `zz` give the same answer, renamed
  const same = async (template: string, n: string): Promise<void> => {
    const host = await fresh();
    const got = shown(host, template.replaceAll("N", n));
    const ref = shown(host, template.replaceAll("N", "zz")).replaceAll("zz", n);
    expect(got, `${template} with ${n}`).toBe(ref);
  };

  it("pasmod's b, pasmedian's loop index", async () => {
    await same("pasmod(N,3)", "b");
    await same("pasmedian([N,1])", "k");
  });

  it("the unit view: a free name is the user's to fix, whichever letter it is", async () => {
    const error = async (n: string): Promise<string> => {
      const host = await fresh();
      const r = host.units({ expr: `${n}*pasdimL` } as Parameters<EngineHost["units"]>[0], home) as { error?: string };
      return r.error ?? "no error";
    };
    const ref = await error("zz");
    expect(ref).toBe("symbolic");
    for (const n of ["k", "a", "b", "c", "j", "t", "f"]) expect(await error(n), n).toBe(ref);
  });

  it("Solve: a system whose unknown is k (the residual's index does not read the unknown)", async () => {
    const host = await fresh();
    const out = host.solve({ kind: "equations", equations: ["k+y=3", "k-y=1"], unknowns: ["k", "y"], guesses: ["1", "1"] }, { ...home, workDigits: 30 });
    expect(out.ok ? out.roots.map((r) => (r.result.ok ? r.result.display : "")) : out).toEqual(["2", "1"]);
  });
});
