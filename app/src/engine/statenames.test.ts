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
import { ENGINE_DEFINITIONS } from "./homeEval.ts";
import { COMPLEX_DEFINITIONS } from "./complex.ts";
import { ICDF_DEFINITIONS } from "./icdf.ts";
import { eseriesDefinition } from "./eseries.ts";
import { changedPart, namesPart, statePart } from "./stateRead.ts";
import { leakPart } from "./assumed.ts";
import { UNIT_DEFINITIONS } from "../units/evaluate.ts";
import { GREEK, LETTER_NAMES, letterName } from "../input/parseTables.ts";
import { POLAR_OUT, RECT_IN } from "./angles.ts";
import { SIZED } from "./novalue.ts";
import { partsOf } from "./numeric.ts";
import { PLAIN_AT_ANY_DEPTH, rowsOf } from "./matrixType.ts";

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

/** Every letter a–z under the name the parser gives it (a typed e and i are the names `e_` and `i_`, R67). */
const LETTERS = [..."abcdefghijklmnopqrstuvwxyz"].map((c) => letterName(c));

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

  // raw Giac text, as a library line may send it, never what the parser sends for a typed e or i (`e_`, the loops above)
  it("raw `e:=7` and `i:=7` leave Giac's constants, and no entry in the table", async () => {
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
    for (const n of ["k", "a", "b", "c", "j", "t", "f", "e_", "i_"]) expect(await error(n), n).toBe(ref);
  });

  // G303f1: Giac's matrix type (idn, matrix(…), a matrix times one) is stored back as plain rows (matrixType.ts), one
  // apply whose arrow bound `pasrow`, a name the parser lets through; a free one in the value was read through it
  it.each(["idn(2)*N", "[idn(2)*N,1]", "matrix(2,2,[[N,1],[2,N]])"])("a matrix-type value holding a free name: %s (Home, CAS)", async (value) => {
    for (const n of ["pasrow"]) {
      await same(`A:=${value}`, n);
      const h = await fresh();
      h.home(`A:=${value.replaceAll("N", n)}`, home);
      const ref = await fresh();
      ref.home(`A:=${value.replaceAll("N", "zz")}`, home);
      expect(shown(h, "A"), `Home ${value} with ${n}`).toBe(shown(ref, "A").replaceAll("zz", n));
      const c = await fresh();
      const cRef = await fresh();
      const cGot = casShown(c, `A:=${value.replaceAll("N", n)}`);
      expect(cGot, `CAS ${value} with ${n}`).toBe(casShown(cRef, `A:=${value.replaceAll("N", "zz")}`).replaceAll("zz", n));
      expect(casShown(c, "A"), `CAS ${value} with ${n}`).toBe(casShown(cRef, "A").replaceAll("zz", n));
    }
  });

  it("Solve: a system whose unknown is k (the residual's index does not read the unknown)", async () => {
    const host = await fresh();
    const out = host.solve({ kind: "equations", equations: ["k+y=3", "k-y=1"], unknowns: ["k", "y"], guesses: ["1", "1"] }, { ...home, workDigits: 30 });
    expect(out.ok ? out.roots.map((r) => (r.result.ok ? r.result.display : "")) : out).toEqual(["2", "1"]);
  });
});

describe.skipIf(!giacAvailable())("G303: every name our Giac text binds is ours, by Giac's own tree", () => {
  const DEFINITIONS = [...Object.values(ENGINE_DEFINITIONS), ...Object.values(COMPLEX_DEFINITIONS), ...Object.values(ICDF_DEFINITIONS), eseriesDefinition(), ...UNIT_DEFINITIONS];
  const READS = [statePart(12), changedPart(12, ["a"]), namesPart(12, ["a"]), leakPart(["a"], [])];
  // G303f1: the other Giac texts our code sends that bind a name: the angle converters, the underflow's size test, the
  // split of a value in its parts, the matrix type's plain rows
  const ARROWS = [`${POLAR_OUT}([1,2])`, `${RECT_IN}([1,2])`, SIZED("exp(-10^30)", 40), partsOf("1+2*i"), rowsOf("A"), PLAIN_AT_ANY_DEPTH];
  const PARSER_NAMES = new Set([...Object.values(LETTER_NAMES), ...Object.values(GREEK)]);

  it("no bound name of a definition or a state read is a user's or one the parser's tables give", async () => {
    const { bridge } = await loadNodeGiac();
    expect(DEFINITIONS.length).toBeGreaterThan(30);
    for (const text of [...DEFINITIONS, ...READS, ...ARROWS]) {
      const p = bridge.parse(text);
      expect(p.ok, text.slice(0, 60)).toBe(true);
      for (const n of p.bound) {
        // the whole form (ourNames.ts OUR_BOUND): pas, the name, an underscore; `pasrow` alone is a name a user may type
        expect(/^pas[A-Za-z0-9]+_$/.test(n), `${n} in ${text.slice(0, 60)}`).toBe(true);
        expect(PARSER_NAMES.has(n), `${n} in ${text.slice(0, 60)}`).toBe(false);
      }
    }
  });

  it("a definition stores into its own bound names or our names only (no undeclared loop variable)", async () => {
    const { bridge } = await loadNodeGiac();
    for (const text of DEFINITIONS) {
      const p = bridge.parse(text);
      // `top` is the one store of a single program; eseries's text holds two programs
      for (const n of p.targets.filter((t) => !p.top.includes(t) && t !== "eseries")) expect(n.startsWith("pas"), `${n} in ${text.slice(0, 60)}`).toBe(true);
    }
  });
});
