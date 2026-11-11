// SPDX-License-Identifier: GPL-3.0-or-later
// G65 (S13, R15): the names an input set come from Giac's state, so the definitions log holds every one of them and no
// line kept as typed (F58), and Solve's own changes to stored names are not credited to the next input.
import { describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { defaultCasSettings } from "./types.ts";
import { applyDefChanges, type DefChange, type DefEntry } from "./defs.ts";
import { giacAvailable, loadNodeGiac, nodeHost } from "./nodeGiac.ts";
import { statePart, tableOf, type StoredName } from "./stateRead.ts";
import { parsePrinted } from "./giacPrint.ts";

describe.skipIf(!giacAvailable())("G65: stored names from Giac's state", () => {
  const fresh = async () => (await nodeHost());

  it("x:=y:=3 logs x and y as values; purging both leaves nothing to replay (F58)", async () => {
    const host = await fresh();
    const defs: DefChange[] = [];
    const first = host.cas("x:=y:=3", defaultCasSettings).defs;
    expect(first.flatMap((d) => ("set" in d ? [[d.set.name, d.set.kind, d.set.cmds]] : []))).toEqual([
      ["x", "var", ["x:=(3)"]],
      ["y", "var", ["y:=(3)"]],
    ]);
    defs.push(...first, ...host.cas("purge(x)", defaultCasSettings).defs, ...host.cas("purge(y)", defaultCasSettings).defs);
    expect(applyDefChanges([], defs)).toEqual([]);
  });

  it("a called program's global is logged, with the facts of what the call read", async () => {
    const host = await fresh();
    host.home("sto(floor(sin(10^100)*10^12),pA)", defaultHomeSettings);
    host.home("setg(v):={gl:=v; return 1;}", defaultHomeSettings);
    const defs = host.home("setg(pA)", defaultHomeSettings).defs;
    const gl = defs.flatMap((d) => ("set" in d && d.set.name === "gl" ? [d.set] : []))[0];
    expect(gl?.cmds).toEqual(["gl:=(899450126402)"]);
    expect(gl?.facts?.warn).toBe("unchecked");
  });

  it("guard (passes on phase-1 too, by its text rule): a store that prints the value it replaces still takes the input's facts", async () => {
    const host = await fresh();
    host.home("pB:=899450126402", defaultHomeSettings);
    const defs = host.home("sto(floor(sin(10^100)*10^12),pB)", defaultHomeSettings).defs;
    expect(defs.flatMap((d) => ("set" in d ? [d.set.facts?.warn] : []))).toEqual(["unchecked"]);
    expect(host.home("pB+1", defaultHomeSettings).result.facts.warn).toBe("unchecked");
  });

  it("a restore fills the table: a name replayed lends its facts through a symbolic value", async () => {
    const host = await fresh();
    const defs = [
      ...host.home("S:=y+pA0", defaultHomeSettings).defs,
      ...host.home("sto(floor(sin(10^100)*10^12),pA0)", defaultHomeSettings).defs,
    ];
    const next = await fresh();
    next.restore(applyDefChanges([], defs));
    expect(next.home("subst(S,y=0)", defaultHomeSettings).result.facts.warn).toBe("unchecked");
  });

  it("Solve, an analysis and a unit job leave the table as Giac holds it, with no read of their own (audit, round 2)", async () => {
    const { giac, bridge } = await loadNodeGiac();
    let stateReads = 0;
    const ev = giac.eval.bind(giac);
    giac.eval = (t: string) => (t.includes("VARS()") && stateReads++, ev(t));
    const host = new EngineHost(giac, bridge);
    host.home("sto(floor(sin(10^100)*10^12),X)", defaultHomeSettings);
    host.home("a:=2.5", defaultHomeSettings);
    const inner = host as unknown as { stored: Map<string, StoredName>; byName: Map<string, unknown> };
    const held = (): Map<string, StoredName> => tableOf(parsePrinted(ev(statePart(12)))!, (n) => inner.byName.has(n))!;
    const jobs = [
      () => host.solve({ kind: "equations", equations: ["X*exp(X)=5"], unknowns: ["X"], guesses: ["1"] }, defaultHomeSettings),
      () => host.analyze({ kind: "area", f: "x^2+a", a: "0", b: "1" }, defaultHomeSettings),
      () => host.units({ expr: "2*(((1)*pasdimL^(1)))", number: "2*(((1)))", inexact: false }, defaultHomeSettings),
    ];
    for (const job of jobs) {
      stateReads = 0;
      job();
      expect(stateReads, "no read of the stored names of its own").toBe(0);
      expect([...inner.stored]).toEqual([...held()]);
    }
    host.home("Y:=1", defaultHomeSettings);
    expect(host.home("X+1", defaultHomeSettings).result.facts.warn).toBe("unchecked");
  });
  it("a log stored before G65 holding the \"other\" entry x:=y:=3: a relaunch turns it into x and y, and purging both leaves them free (F58)", async () => {
    const old: DefEntry[] = [{ name: "x", kind: "other", cmds: ["x:=y:=3"], preview: "3", view: "cas", time: 1 }];
    const host = await fresh();
    host.restore(old);
    let log = applyDefChanges(old, host.takeMigrated());
    expect(log.map((e) => [e.name, e.kind]).sort()).toEqual([["x", "var"], ["y", "var"]]);
    log = applyDefChanges(log, [...host.cas("purge(x)", defaultCasSettings).defs, ...host.cas("purge(y)", defaultCasSettings).defs]);
    expect(log).toEqual([]);
    const next = await fresh();
    next.restore(log);
    expect(next.home("x+y", defaultHomeSettings).result.display).toBe("x+y");
  });

  it("a program that stores a global and then errors: the table follows, so the next input is not credited with it", async () => {
    const host = await fresh();
    host.home("sto(floor(sin(10^100)*10^12),pA)", defaultHomeSettings);
    host.home("sg(v):={gl:=v; error(\"e\")}", defaultHomeSettings);
    host.home("sg(pA)", defaultHomeSettings);
    const defs = host.home("Y:=1", defaultHomeSettings).defs;
    expect(defs.flatMap((d) => ("set" in d ? [d.set.name] : []))).toEqual(["Y"]);
  });
});

describe.skipIf(!giacAvailable())("G104: the state read costs what changed", () => {
  /** A host whose Giac counts what it prints, from `mark()` on. */
  const counted = async () => {
    const { giac, bridge } = await loadNodeGiac();
    let printed = 0;
    const ev = giac.eval.bind(giac);
    giac.eval = (t: string) => {
      const out = ev(t);
      printed += out.length;
      return out;
    };
    const host = new EngineHost(giac, bridge);
    return { host, ev, mark: () => (printed = 0), printed: () => printed };
  };
  const setNames = (defs: DefChange[]): string[] => defs.flatMap((d) => ("set" in d ? [d.set.name] : []));

  it("after M:=ranm(300,300), Home c:=1 logs c and Giac prints under 10 kB after the input", async () => {
    const { host, mark, printed } = await counted();
    host.home("M:=ranm(300,300)", defaultHomeSettings);
    mark();
    expect(setNames(host.home("c:=1", defaultHomeSettings).defs)).toEqual(["c"]);
    expect(printed()).toBeLessThan(10_000);
  });

  it("guard: M[1,1]:=0 logs M again, and the table holds its new text", async () => {
    const { host, ev } = await counted();
    host.home("M:=[[1,2],[3,4]]", defaultHomeSettings);
    host.home("c:=1", defaultHomeSettings);
    expect(setNames(host.home("M[1,1]:=0", defaultHomeSettings).defs)).toEqual(["M"]);
    const inner = host as unknown as { stored: Map<string, StoredName>; byName: Map<string, unknown> };
    expect([...inner.stored]).toEqual([...tableOf(parsePrinted(ev(statePart(12)))!, (n) => inner.byName.has(n))!]);
  });

  // audit round 1: Giac's full read prints a's entry as "x+1" after x:=2 too (string(eval(k)) evaluates one level), so
  // the read of the candidates logs x alone, as phase-1's full read does, and its table equals the full read
  it("guard: a:=x+1, then x:=2 logs x, and the table equals the full read", async () => {
    const { host, ev } = await counted();
    host.home("a:=x+1", defaultHomeSettings);
    expect(setNames(host.home("x:=2", defaultHomeSettings).defs)).toEqual(["x"]);
    const inner = host as unknown as { stored: Map<string, StoredName>; byName: Map<string, unknown> };
    expect([...inner.stored]).toEqual([...tableOf(parsePrinted(ev(statePart(12)))!, (n) => inner.byName.has(n))!]);
  });

  it("guard: g2(1) logs the global n that g, which g2 calls, stores", async () => {
    const { host } = await counted();
    host.home("n:=0", defaultHomeSettings);
    host.home("g(t):={n:=n+1;return t;}", defaultHomeSettings);
    host.home("g2(t):=g(t)", defaultHomeSettings);
    expect(setNames(host.home("g2(1)", defaultHomeSettings).defs)).toEqual(["n"]);
  });

  it("guard: expr(\"q:=5\") logs q", async () => {
    const { host } = await counted();
    host.home("q:=1", defaultHomeSettings);
    expect(setNames(host.home('expr("q:=5")', defaultHomeSettings).defs)).toEqual(["q"]);
  });

  it("guard: purge(c) removes c from the log and the table", async () => {
    const { host } = await counted();
    host.home("c:=1", defaultHomeSettings);
    const defs = host.home("purge(c)", defaultHomeSettings).defs;
    expect(applyDefChanges([], defs)).toEqual([]);
    expect(defs.some((d) => "purge" in d && d.purge.includes("c"))).toBe(true);
    expect((host as unknown as { stored: Map<string, StoredName> }).stored.has("c")).toBe(false);
  });
});

// G174 (F96, F87): names Giac stores through an argument (QR, LU, Fill, CopyVar; stores.ts ARG_STORE_HEADS) reach the
// definitions log; the names Giac stores for itself (gbasis's lastgb and lastv) do not; debug is refused; restart answers
// the user's names it cleared. Expected values are derived: Giac's own answers on a fresh engine, and a restore of the log.
describe.skipIf(!giacAvailable())("G174: names stored through an argument, Giac's scratch names, debug and restart", () => {
  const setNames = (defs: DefChange[]): string[] => defs.flatMap((d) => ("set" in d ? [d.set.name] : []));
  const casText = (host: EngineHost, input: string): string => {
    const r = host.cas(input, defaultCasSettings).result;
    return r.ok ? r.text : `error ${r.error}: ${r.text}`;
  };

  for (const [call, names] of [["QR(M,Q,R)", ["Q", "R"]], ["LU(M,L,U,P)", ["L", "U", "P"]], ["Fill(1.1,A)", ["A"]], ["CopyVar(M,B)", ["B"]]] as const) {
    for (const view of ["home", "cas"] as const) {
      it(`${view}: ${call} logs ${names.join(", ")} with Giac's values, and a restore holds them`, async () => {
        const host = await nodeHost();
        const run = (t: string): DefChange[] => (view === "home" ? host.home(t, defaultHomeSettings).defs : host.cas(t, defaultCasSettings).defs);
        const defs = [...run("M:=[[1,2],[3,4]]"), ...run(call)];
        expect(setNames(defs).filter((n) => n !== "M").sort()).toEqual([...names].sort());
        const next = await nodeHost();
        next.restore(applyDefChanges([], defs));
        for (const n of names) {
          const want = host.giac.eval(`string(simplify(${n}))`);
          expect(want, n).not.toBe(`"${n}"`);
          expect(next.giac.eval(`string(simplify(${n}))`), n).toBe(want);
        }
      });
    }
  }

  it("gbasis and syzygy leave no lastgb or lastv in VARS() or the log, and answer as Giac does", async () => {
    const raw = (await loadNodeGiac()).giac;
    const host = await nodeHost();
    for (const input of ["gbasis([x^2-y^3,x+y^2],[x,y])", "syzygy([x^2-y^3,x+y^2],[x,y])"]) {
      const want = raw.eval(input);
      const r = host.cas(input, defaultCasSettings);
      expect(r.result.ok, input).toBe(true);
      expect(setNames(r.defs), input).toEqual([]);
      expect(host.giac.eval("VARS()"), input).not.toMatch(/lastgb|lastv/);
      if (input.startsWith("gbasis")) expect(r.result.text).toBe(want);
    }
    expect(host.home("gbasis([x^2-y^3,x+y^2],[x,y])", defaultHomeSettings).result.ok).toBe(true);
    expect(host.giac.eval("VARS()")).not.toMatch(/lastgb|lastv/);
  });

  it("guard: a lastv of the user's own stays as stored", async () => {
    const host = await nodeHost();
    host.cas("lastv:=7", defaultCasSettings);
    host.cas("gbasis([x^2-y^3,x+y^2])", defaultCasSettings);
    expect(casText(host, "lastv")).toBe("7");
  });

  it("wz_certificate leaves no assumption on k or n (Giac's own, intg.cc:6402), and answers as Giac does", async () => {
    const input = "wz_certificate((-1)^k*binomial(n,k)/2^n)";
    const want = (await loadNodeGiac()).giac.eval(input);
    const host = await nodeHost();
    const r = host.cas(input, defaultCasSettings);
    expect(r.result.text).toBe(want);
    expect(setNames(r.defs)).toEqual([]);
    expect([host.giac.eval("about(k)"), host.giac.eval("about(n)")]).toEqual(["k", "n"]);
  });

  it("guard: GF(2,8) keeps K and g for the session (the log cannot hold g; decisions.md, G174): g^200+1 is in the field", async () => {
    const raw = (await loadNodeGiac()).giac;
    raw.eval("GF(2,8)");
    const host = await nodeHost();
    host.cas("GF(2,8)", defaultCasSettings);
    expect(casText(host, "g^200+1")).toBe(raw.eval("g^200+1"));
  });

  it("debug(f(2)) is refused in Home and CAS, and f(3) still gives 4", async () => {
    const host = await nodeHost();
    host.home("f(x):=x+1", defaultHomeSettings);
    const h = host.home("debug(f(2))", defaultHomeSettings).result;
    expect([h.ok, h.error, h.display]).toEqual([false, "notHere", "Not available in N62"]);
    const c = host.cas("debug(f(2))", defaultCasSettings).result;
    expect([c.ok, c.error, c.text]).toEqual([false, "notHere", "Not available in N62"]);
    expect(host.home("f(3)", defaultHomeSettings).result.display).toBe("4");
    expect(casText(host, "f(3)")).toBe("4");
  });

  for (const view of ["home", "cas"] as const) {
    it(`${view}: restart(0), restart and restart(1) answer the user's names they cleared, none of ours`, async () => {
      const host = await nodeHost();
      const run = (t: string, angle: "rad" | "deg" = "rad"): { text: string; defs: DefChange[] } => {
        if (view === "home") {
          const o = host.home(t, { ...defaultHomeSettings, angle });
          return { text: o.result.ok ? o.result.display : `error ${o.result.error}`, defs: o.defs };
        }
        const o = host.cas(t, { ...defaultCasSettings, angle });
        return { text: o.result.ok ? o.result.text : `error ${o.result.error}`, defs: o.defs };
      };
      // a fresh engine: nothing of the user's to clear
      expect(run("restart(0)").text).toBe("[]");
      expect(run("restart").text).toBe("[]");
      expect(run("restart(1)", "deg").text).toBe("[]");
      // after stores: restart(0) clears them (Giac's answer listed pcasans and pasdeg too) and the log follows
      const defs = [...run("a:=5").defs, ...run("b:=7").defs];
      const cleared = run("restart(0)");
      expect(cleared.text).toBe("[a,b]");
      expect(applyDefChanges([], [...defs, ...cleared.defs])).toEqual([]);
      expect(run("a").text).toBe("a");
      // restart(1) clears nothing in Giac (G93, usual.cc:251): the names stay, the answer is empty
      run("c:=3");
      expect(run("restart(1)").text).toBe("[]");
      expect(run("c+1").text).toBe("4");
      run("d:=2");
      expect(run("restart").text).toBe("[c,d]");
    });
  }
});
