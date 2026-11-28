// SPDX-License-Identifier: GPL-3.0-or-later
// Every curated Find function (find/functions.yaml) inserts LaTeX that our parser turns into the Giac command it
// names, and every Giac function inserted as \operatorname reaches Giac under its own name (docs/04 3.1, 3.6).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { latexToGiac } from "../input/latex-to-giac.ts";

const here = dirname(fileURLToPath(import.meta.url));
interface Curated { id: string; giac: string; insert?: string }
const curated = (parse(readFileSync(join(here, "../../../find/functions.yaml"), "utf8")) as { functions: Curated[] }).functions;
const opInsert = (n: string): string => `\\operatorname{${n.replace(/_/g, "\\_")}}\\left(#0\\right)`;
// Giac names our parser renames on the way (input/emit.ts CALL_NAME): irem is pasmod, which is irem on integers.
const CALL_NAME: Record<string, string> = { irem: "pasmod", median: "pasmedian", percentile: "paspercentile", sem: "passem" };
// x in the selection's box, 1 in a template's other boxes (#?, tmpl:dms's minutes and seconds)
const fill = (insert: string): string => insert.replace(/#[0@]/, "x").replaceAll("#?", "1");

describe("Find insertion", () => {
  // a template's main box may be #@ as on its key (tmpl:dms, the Tmpl palette's: a number before it is its degrees, R27a)
  it("puts a selection in every curated insert: its slot is #0, never #?; a template's other boxes are #? (decisions.md R17 default, point 4)", () => {
    for (const f of curated) {
      if (!f.insert) continue;
      const main = f.id.startsWith("tmpl:") ? /#[0@]/.exec(f.insert) : /#0/.exec(f.insert);
      expect(main !== null && !f.insert.slice(0, main.index).includes("#?") && (f.id.startsWith("tmpl:") || !f.insert.includes("#?")), f.id).toBe(true);
    }
  });

  it.each(curated.map((f) => [f.id, f] as const))("%s becomes its Giac command", (_, f) => {
    const giac = latexToGiac(fill(f.insert ?? opInsert(f.giac)));
    expect(giac === f.giac || giac.startsWith(`${CALL_NAME[f.giac] ?? f.giac}(`), giac).toBe(true);
  });

  it.each(["normald_cdf", "stddevp", "irem", "comb", "Gamma", "lcm", "plotfunc", "zeta"])("\\operatorname{%s} reaches Giac as written", (n) => {
    expect(latexToGiac(fill(opInsert(n)))).toBe(`${CALL_NAME[n] ?? n}(x)`);
  });
});
