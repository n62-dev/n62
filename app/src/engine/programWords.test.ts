// SPDX-License-Identifier: GPL-3.0-or-later
// G223f1: complexReads reads a stored program's body for the names it uses, and asked Giac each word bare, `local` and
// `else` too: their parse error (`undef` with "syntax error") ended the whole Home input as a syntax error, with Giac's
// message over a freed buffer (the garbage bytes). Expected values: derived (f(1) = 1+1 = 2; bnot(5,8,0) flips the
// eight bits of 00000101, 11111010 = 250, plus 1/2 is 250.5) and oracle (n, mean, s, σ, min, max of 1, 2, 4 in Fraction:
// 3, 7/3, sqrt(7/3), sqrt(14)/3, 1, 4, as home.yaml g223f1-approx-stats1).
import { beforeAll, describe, expect, it } from "vitest";
import { complexReads } from "./complex.ts";
import { PROGRAM_WORDS } from "./giacPrint.ts";
import type { EngineHost } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { giacAvailable, nodeHost } from "./nodeGiac.ts";
import type { Giac } from "./numeric.ts";

describe("G223f1 complexReads asks no program word", () => {
  it("reads a stored program's names without asking Giac local, if, else, while, for or return", () => {
    const body = " (x)-> \n{ local a,k; \n  if (x>0) a:=x+1; else a:=0;  \n  for (k:=1;k<=2;k:=k+1) {a:=a+w};  \n  while(a>9){a:=a-1};  \n  return(a);  \n}";
    const asked: string[] = [];
    // Giac's prints: the stored program, the name itself for a free name.
    const giac: Giac = {
      eval: (s) => (asked.push(s), s === "f223" ? body : s),
      value: () => {
        throw new Error("complexReads reads prints only");
      },
    };
    complexReads(giac, "f223(1)");
    expect(asked).toEqual(["f223", "w"]);
    expect(asked.filter((s) => PROGRAM_WORDS.has(s))).toEqual([]);
  });
});

describe.skipIf(!giacAvailable())("G223f1 a program body read for its names is no syntax error", () => {
  let host: EngineHost;
  const home = (input: string) => host.home(input, defaultHomeSettings).result;
  beforeAll(async () => {
    host = await nodeHost();
  });

  it("a user function with local, approx and our definitions inside a larger input answer", () => {
    const shown: string[] = [];
    const run = (input: string) => {
      const r = home(input);
      shown.push(r.display);
      return r;
    };
    expect(run("f(x):={local a; a:=x+1; return a;}")).toMatchObject({ ok: true });
    expect(run("approx(f(1))")).toMatchObject({ ok: true, display: "2" });
    expect(run("bnot(5,8,0)+evalf(1/2)")).toMatchObject({ ok: true, display: "250.5" });
    expect(run("L:=evalf([1,2,4])")).toMatchObject({ ok: true });
    const s = run("stats1(L)");
    expect(s.ok).toBe(true);
    expect(s.display).toContain("3,2.33333333333,1.52752523165,1.24721912892,1,4");
    expect(run("approx(stats1([1,2,4]))")).toMatchObject({ ok: true, display: "{3,2.33333333333,1.52752523165,1.24721912892,1,4}" });
    // G223f1: decidingStored (an input that runs once) read a try/catch body's `catch(` as a call and asked it bare.
    expect(run("c223:=0")).toMatchObject({ ok: true });
    expect(run("inc223(x):={try {c223:=c223+x;} catch(e) {c223:=0;} return c223;}")).toMatchObject({ ok: true });
    expect(run("inc223(1)")).toMatchObject({ ok: true, display: "1" });
    expect(run("B223:=inc223(2)")).toMatchObject({ ok: true, display: "3" });
    expect(shown.filter((d) => /syntax error/.test(d))).toEqual([]);
  });
});
