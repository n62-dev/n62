// SPDX-License-Identifier: GPL-3.0-or-later
// G188f2: tools/giac-regress/run.mjs's line runner on a stand-in engine: a line that traps the engine (stock Giac on the g188-int-* lines)
// is counted as failed and the run goes on in a fresh engine that ran the preamble again; the whole-file pass reports the trap.
import { describe, expect, it } from "vitest";
// @ts-expect-error a plain .mjs tool without types
import { runLines, runWhole } from "../../tools/giac-regress/lines.mjs";

interface Stand {
  eval: (s: string) => string;
  seen: string[];
}
type Result = { id: string; ok: boolean; out: string; trapped: boolean };

/** A stand-in Giac: `pc(` answers 1 only after the preamble defined pc; a line holding TRAP throws as a wasm trap does. */
function standIn(engines: Stand[]): () => Promise<Stand> {
  return async () => {
    let defined = false;
    const e: Stand = {
      seen: [],
      eval: (s) => {
        e.seen.push(s);
        if (s.includes("TRAP")) throw new RuntimeErrorLike("memory access out of bounds");
        if (s.startsWith("pc(id")) defined = true;
        if (s === "pasn" || s === "pasfail") return "0";
        return s.includes('pc("') ? (defined ? "Done,1" : "Done,pc(…)") : "Done";
      },
    };
    engines.push(e);
    return e;
  };
}
class RuntimeErrorLike extends Error {
  override name = "RuntimeError";
}

const FILE = [
  "// a comment",
  "pasn:=0:; pasfail:=0:;",
  "pc(id,v,e,tol):={ … };",
  'Digits:=40:; pc("before",1,1,0);',
  'Digits:=40:; pc("trap",TRAP,1,0);',
  'Digits:=40:; pc("after-1",1,1,0);',
  'Digits:=40:; pc("after-2",1,1,0);',
].join("\n");

describe("giac-regress line runner", () => {
  it("counts a trapping line as failed and goes on in a fresh engine with the preamble", async () => {
    const engines: Stand[] = [];
    const load = standIn(engines);
    const first = await load();
    const r = (await runLines(FILE, first, load)) as { results: Result[]; engine: Stand };
    expect(r.results.map((x) => [x.id, x.ok, x.trapped])).toEqual([
      ["before", true, false],
      ["trap", false, true],
      ["after-1", true, false],
      ["after-2", true, false],
    ]);
    expect(r.results[1]!.out).toBe("trapped: RuntimeError: memory access out of bounds");
    expect(engines).toHaveLength(2);
    expect(r.engine).toBe(engines[1]);
    expect(engines[1]!.seen.slice(0, 2)).toEqual(["pasn:=0:; pasfail:=0:;", "pc(id,v,e,tol):={ … };"]);
  });

  it("reports a trap of the whole-file pass instead of throwing", async () => {
    expect(await runWhole(FILE, standIn([]))).toEqual({ trapped: "RuntimeError: memory access out of bounds" });
    expect(await runWhole(FILE.replace("TRAP", "1"), standIn([]))).toEqual({ n: 0, failed: 0 });
  });
});
