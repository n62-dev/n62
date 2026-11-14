// SPDX-License-Identifier: GPL-3.0-or-later
// G354 (night review 2026-11-14, vr-2): a store Giac refuses is a refusal, not a result. Giac answers `mean:=5` with a
// list (its warning and the value) and stores nothing; the host reads from its state after the run that the target is
// not held, and refuses with `builtInName`, worded as the parser's refusal. Expected values: what Giac itself does
// (source: derived; probed on the dev engine of 2026-11-14: `mean([1,2,3])` stays 2, `rate:=5`, `D:=5`, `E:=5`, `I:=5`,
// `O:=5` store, `L[2]:=7` over [1,2,3] gives [1,2,7]; tools/probes/review-1114/vvr-store.mts, vrB-refuse.ts,
// tools/probes/store-letters.ts).
import { beforeAll, describe, expect, it } from "vitest";
import type { EngineHost } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { defaultCasSettings } from "./types.ts";
import type { DefChange } from "./defs.ts";
import { giacAvailable, nodeHost } from "./nodeGiac.ts";
import { latexToGiac } from "../input/latex-to-giac.ts";
import { parseText } from "../i18n/enParser.ts";

const LETTERS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];
const sets = (defs: readonly DefChange[]): string[] => defs.flatMap((c) => ("set" in c ? [c.set.name] : []));

for (const view of ["home", "cas"] as const) {
  describe.skipIf(!giacAvailable())(`G354: a store into a name Giac keeps, in ${view === "home" ? "Home" : "CAS"}`, () => {
    let host: EngineHost;
    const run = (input: string): { ok: boolean; text: string; error?: string; defs: DefChange[] } => {
      if (view === "home") {
        const { result: r, defs } = host.home(input, defaultHomeSettings);
        return { ok: r.ok, text: r.display, ...(r.error ? { error: r.error } : {}), defs };
      }
      const { result: r, defs } = host.cas(input, defaultCasSettings);
      return { ok: r.ok, text: r.text, ...(r.error ? { error: r.error } : {}), defs };
    };
    beforeAll(async () => {
      host = await nodeHost();
    });

    it.each(["mean", "size", "trace"])("%s:=5 is refused with the parser's words, and stores nothing", (name) => {
      const r = run(`${name}:=5`);
      expect(r).toMatchObject({ ok: false, error: "builtInName", text: parseText("parse.builtInName", { name }) });
      expect(r.defs).toEqual([]);
    });

    it("the function is still Giac's: mean([1,2,3]) is 2, size([1,2,3]) is 3", () => {
      expect(run("mean([1,2,3])")).toMatchObject({ ok: true, text: "2" });
      expect(run("size([1,2,3])")).toMatchObject({ ok: true, text: "3" });
    });

    it("the store sheet's line for mean (5 ▶ \\operatorname{mean}) is the same refusal", () => {
      const g = latexToGiac("5\\blacktriangleright\\operatorname{mean}", { userValues: new Set() });
      expect(run(g)).toMatchObject({ ok: false, error: "builtInName" });
    });

    it("rate:=5 stores 5", () => {
      const r = run("rate:=5");
      expect(r).toMatchObject({ ok: true, text: "5" });
      expect(sets(r.defs)).toEqual(["rate"]);
      expect(run("rate*2")).toMatchObject({ ok: true, text: "10" });
    });

    it("every letter A–Z stores and reads back (D, E, I, O are Giac's own names and store too)", () => {
      const bad: string[] = [];
      for (const L of LETTERS) {
        const s = run(latexToGiac(`\\frac{7}{2}\\blacktriangleright ${L}`));
        const read = run(latexToGiac(`${L}\\times2`));
        if (!s.ok || !sets(s.defs).length || read.text !== "7") bad.push(`${L}: ${s.text} / ${read.text}`);
      }
      expect(bad).toEqual([]);
    });

    it("sin keeps the parser's refusal", () => {
      expect(() => latexToGiac("5\\blacktriangleright\\operatorname{sin}")).toThrow(parseText("parse.builtInName", { name: "sin" }));
    });

    it("the other assignment forms still store: [q1,q2]:=[1,2], L[2]:=7, f(x):=x^2, and 5 ▶ a user's function", () => {
      expect(run("[q1,q2]:=[1,2]").ok).toBe(true);
      expect(run("q1+q2")).toMatchObject({ ok: true, text: "3" });
      expect(run("W:=[1,2,3]").ok).toBe(true);
      expect(run("W[2]:=7").ok).toBe(true);
      expect(run("W")).toMatchObject({ ok: true, text: "[1,2,7]" });
      expect(run("ff(x):=x^2").ok).toBe(true);
      expect(run("ff(3)")).toMatchObject({ ok: true, text: "9" });
      const over = run("ff:=5");
      expect(over).toMatchObject({ ok: true, text: "5" });
      expect(sets(over.defs)).toEqual(["ff"]);
    });
  });
}
