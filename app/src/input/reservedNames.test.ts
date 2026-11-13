// SPDX-License-Identifier: GPL-3.0-or-later
// G341 (F210): a name that starts with `pas` is N62's, wherever the user types it. Our Giac text keeps its helpers and
// stores under such names (Solve's root is `pasx`, engine/solve1.ts), so a typed one read or replaced ours. Letters typed
// one by one multiply (p·a·s·x); a name of several letters is typed as `\operatorname{…}` (a call, a function's name,
// a stored value Vars inserts: R258), which is where the parser reads it. No engine.
import { describe, expect, it } from "vitest";
import { latexToGiac } from "./latex-to-giac.ts";
import { giacOfEntry } from "./entry.ts";
import { mathJsonToGiac } from "./emit.ts";
import { parseLatex } from "./parse.ts";
import { DEFAULT_USER_FUNCTIONS } from "./latex-to-giac.ts";

const OURS = ["pasx", "pass", "past", "pascal", "pasr_7", "pasc_c", "pasnew"];
/** `pasr_7` is typed `pasr\_7` (MathLive escapes the underscore in \operatorname). */
const typed = (n: string): string => n.replace(/_/g, "\\_");
const op = (n: string): string => `\\operatorname{${typed(n)}}`;
const call = (n: string, arg = "1"): string => `${op(n)}\\left(${arg}\\right)`;
/** The session holds `n` as a value (an old library's, say): Vars inserts it as \operatorname{n}. */
const holding = (n: string) => ({ userValues: new Set([n]) });
/** Solve's own compile step (apps/solve/app.svelte.ts compileEquation). */
const solveEquation = (latex: string): string =>
  mathJsonToGiac(parseLatex(latex, { userFunctions: DEFAULT_USER_FUNCTIONS }), { realOddRoots: true, userFunctions: DEFAULT_USER_FUNCTIONS });

describe("G341: a typed name that starts with pas is refused with the reason", () => {
  for (const n of OURS) {
    const why = new RegExp(`^${n} starts with pas, which N62 keeps for its own names`);
    it(`${n}: as a value, a call, the target after ▶, a function's name and its parameter, in Solve's equation`, () => {
      expect(() => latexToGiac(op(n), holding(n)), "value").toThrow(why);
      expect(() => latexToGiac(call(n)), "call").toThrow(why);
      expect(() => latexToGiac(`7\\blacktriangleright${op(n)}`, holding(n)), "▶").toThrow(why);
      expect(() => latexToGiac(`${op(n)}:=7`, holding(n)), ":=").toThrow(why);
      expect(() => latexToGiac(`${call(n, "x")}:=x+1`), "function name").toThrow(why);
      expect(() => latexToGiac(`${call("fn", op(n))}:=${op(n)}+1`, holding(n)), "parameter").toThrow(why);
      expect(() => latexToGiac(`${op(n)}\\rightarrow${op(n)}+1`, holding(n)), "arrow parameter").toThrow(why);
      expect(() => solveEquation(`x+${call(n)}=3`), "Solve").toThrow(why);
      expect(() => solveEquation(`${call(n, "x")}=3`), "Solve").toThrow(why);
    });
  }

  it("the reason is the i18n key parse.reservedName with the name", () => {
    try {
      latexToGiac(call("pasx"));
      expect.unreachable();
    } catch (e) {
      expect(e).toMatchObject({ key: "parse.reservedName", vars: { name: "pasx" } });
    }
  });

  it("pcasans, CAS's answer slot, is refused too (a typed call read CAS's last answer: step 1)", () => {
    expect(() => latexToGiac(call("pcasans"))).toThrow(/^pcasans is one of N62's own names/);
    expect(() => latexToGiac(op("pcasans"), holding("pcasans"))).toThrow(/^pcasans is one of N62's own names/);
  });

  it("the store line refuses `7 ▶ pasx` and stores nothing (R281's sheet is not merged: the line's one store path)", () => {
    // the session holds pasx (an old library's), so Vars can put it after ▶
    const names = [{ name: "pasx", kind: "var" as const }];
    expect(() => giacOfEntry(`7\\blacktriangleright${op("pasx")}`, "home", { names })).toThrow(/^pasx starts with pas/);
    expect(() => giacOfEntry(`7\\blacktriangleright${op("pasx")}`, "cas", { names })).toThrow(/^pasx starts with pas/);
    // typed letter by letter it is a product, never a name: refused as before
    expect(() => giacOfEntry("7\\blacktriangleright pasx", "home")).toThrow(/expected a name after ▶/);
  });

  it("pa, spas and Pas are the user's (the prefix is lower case and leads)", () => {
    for (const n of ["pa", "spas", "Pas", "PAS", "xpas"]) {
      expect(latexToGiac(call(n)), n).toBe(`${n}(1)`);
      expect(latexToGiac(op(n), holding(n)), n).toBe(n);
      expect(latexToGiac(`7\\blacktriangleright${op(n)}`, holding(n)), n).toBe(`${n}:=7`);
    }
    expect(latexToGiac(`${call("Pascal", "x")}:=x+1`)).toBe("Pascal(x):=x+1");
  });

  it("the parser's own names stay: mod as pasmod, the unit view's pasupm, pasu1 and pask1", () => {
    expect(latexToGiac(call("mod", "7,3"))).toBe("pasmod(7,3)");
    const u = latexToGiac("2\\pm0.1", { units: true });
    expect(u).toContain("pasupm(");
  });
});
