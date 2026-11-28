// SPDX-License-Identifier: GPL-3.0-or-later
// G315: no strongly connected set of value imports among engine/'s modules (tests left out). The reading is
// tools/probes/review-1109/vca-scc.py's (an `import type`, or braces that hold only `type` names, is no value import);
// the probe walks the whole of app/src.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const DIR = dirname(fileURLToPath(import.meta.url));
const IMPORT = /^\s*(?:import|export)\s+([^;"']*?)\s*from\s+["'](\.[^"']+)["']/gm;
const BARE = /^\s*import\s+["'](\.[^"']+)["']/gm;

function isValue(clause: string): boolean {
  const c = clause.trim();
  if (c.startsWith("type ")) return false;
  const m = /^\{([\s\S]*)\}$/.exec(c);
  const names = m ? m[1]!.split(",").map((x) => x.trim()).filter(Boolean) : [];
  return !(names.length && names.every((n) => n.startsWith("type ")));
}

/** Every strongly connected set of more than one module in `graph` (Tarjan). */
function cycles(graph: ReadonlyMap<string, readonly string[]>): string[][] {
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const on = new Set<string>();
  const out: string[][] = [];
  const visit = (v: string): void => {
    index.set(v, index.size);
    low.set(v, index.get(v)!);
    stack.push(v);
    on.add(v);
    for (const w of graph.get(v) ?? []) {
      if (!index.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (on.has(w)) low.set(v, Math.min(low.get(v)!, index.get(w)!));
    }
    if (low.get(v) !== index.get(v)) return;
    const set: string[] = [];
    for (let w = stack.pop()!; ; w = stack.pop()!) {
      on.delete(w);
      set.push(w);
      if (w === v) break;
    }
    if (set.length > 1) out.push(set.sort());
  };
  for (const v of graph.keys()) if (!index.has(v)) visit(v);
  return out;
}

describe("engine/ has no import cycle (G315)", () => {
  it("the SCC reading finds a cycle when there is one", () => {
    expect(cycles(new Map([["a", ["b"]], ["b", ["c"]], ["c", ["a"]], ["d", ["a"]]]))).toEqual([["a", "b", "c"]]);
  });

  it("no strongly connected set of value imports", () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith(".ts") && !f.includes(".test.") && !f.endsWith(".d.ts"));
    const known = new Set(files.map((f) => join(DIR, f)));
    const graph = new Map<string, string[]>();
    for (const f of files) {
      const path = join(DIR, f);
      const text = readFileSync(path, "utf8");
      const specs = [...[...text.matchAll(IMPORT)].filter((m) => isValue(m[1]!)).map((m) => m[2]!), ...[...text.matchAll(BARE)].map((m) => m[1]!)];
      graph.set(path, specs.map((s) => normalize(join(DIR, s))).filter((p) => known.has(p)));
    }
    expect(graph.size).toBeGreaterThan(50);
    expect(cycles(graph).map((c) => c.map((p) => relative(DIR, p)))).toEqual([]);
  });
});
