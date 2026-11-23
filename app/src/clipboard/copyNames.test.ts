// SPDX-License-Identifier: GPL-3.0-or-later
// G784: Copy writes the names the screen shows, never the parser's stand-ins (engine/standIns.ts). The stand-ins are read
// from standIns.ts, so a new one without its Giac LaTeX below (and so without a drawing tidy pins) fails the first test.
// GIAC_LATEX is what Giac's latex(2*<name>) printed in the engine of 2026-11-23 (source: running it, key-676333c02248225d);
// its print of 2*<name> is `2*<name>` for every one (same run). The letters are typedName's (R260), the drawn ones MathLive's.
import { describe, expect, it } from "vitest";
import { convertLatexToMathMl } from "mathlive/ssr";
import { GREEK_NAMES, LETTER_NAMES, typedName } from "../engine/standIns.ts";
import { tidyGiacLatex } from "../render/tidy.ts";
import { copyExactText, copyFull, copyNames, copyShownText, sessionCsv, sessionText, type CopySource, type NameSeen } from "./text.ts";
import type { DisplayContext } from "../state/displayMode.ts";

const CTX: DisplayContext = { format: "std", digits: 12, fixDecimals: 4, angle: "rad" };
const STAND_INS = [...GREEK_NAMES.filter((n) => n.endsWith("_")), ...Object.values(LETTER_NAMES)];
const GIAC_LATEX: Record<string, string> = {
  beta_: "2\\cdot \\beta_",
  gamma_: "2\\cdot \\gamma_",
  epsilon_: "2\\cdot \\epsilon_",
  Gamma_: "2\\cdot \\Gamma_",
  Pi_: "2\\cdot \\mathrm{Pi\\_}",
  Phi_: "2\\cdot \\Phi_",
  Psi_: "2\\cdot \\Psi_",
  e_: "2\\cdot \\mathrm{e\\_}",
  i_: "2\\cdot \\mathrm{i\\_}",
};
/** A CAS row as the engine wrote it (an expression: no value, exact). */
const row = (text: string, latex = "x"): CopySource => ({ latex, status: "done", text, full: text, fullExact: true });

describe("G784: every stand-in copies as the letter the screen draws", () => {
  it("the table holds every stand-in of standIns.ts, and each has a one-character letter", () => {
    expect(Object.keys(GIAC_LATEX).sort()).toEqual([...STAND_INS].sort());
    for (const s of STAND_INS) expect([...typedName(s)]).toHaveLength(1);
  });
  for (const s of STAND_INS) {
    const letter = typedName(s);
    it(`2*${s} copies as 2*${letter} and is drawn ${letter}`, () => {
      const r = row(`2*${s}`);
      expect(copyFull(r)).toBe(`2*${letter}`);
      expect(copyShownText(`2*${s}`)).toBe(`2*${letter}`);
      expect(copyExactText(r)).toBe(`2*${letter}`);
      expect(copyNames(`2*${s}`)).toEqual({ text: `2*${letter}`, named: true }); // G784f1: the turn is reported
      expect(sessionText([r], {}, CTX)).toBe(`x = 2*${letter}`);
      expect(sessionCsv([r], {}, CTX).split("\r\n")[1]).toBe(`x,2*${letter},=,,`);
      const drawn = convertLatexToMathMl(tidyGiacLatex(GIAC_LATEX[s]!));
      expect(drawn).toContain(`<mi>${letter}</mi>`);
      expect(drawn).not.toContain("_");
    });
  }
  it("rainbow (r*a*i_*n*b*o*w) copies as r*a*i*n*b*o*w; a drawn list and the decimal comma too", () => {
    expect(copyFull(row("r*a*i_*n*b*o*w"))).toBe("r*a*i*n*b*o*w");
    expect(copyFull({ ...row("list[beta_,1.5]"), drawn: "{beta_,1.5}" }, { decimalComma: true })).toBe("{β;1,5}");
  });
});

describe("G784 controls: what is not a stand-in is kept", () => {
  it("the constant i and e, a name that only ends in _, x_1 and a string", () => {
    expect(copyNames("2+3*i")).toEqual({ text: "2+3*i", named: false });
    expect(copyNames("exp(2)")).toEqual({ text: "exp(2)", named: false });
    expect(copyNames("e^2")).toEqual({ text: "e^2", named: false });
    expect(copyNames("a_*2")).toEqual({ text: "a_*2", named: false });
    expect(copyNames("x_1*2")).toEqual({ text: "x_1*2", named: false });
    expect(copyNames('"i_"')).toEqual({ text: '"i_"', named: false });
    expect(copyNames('concat("beta_",beta_)')).toEqual({ text: 'concat("beta_",β)', named: true });
    expect(copyNames("Pi*upsilon+alpha")).toEqual({ text: "Pi*upsilon+alpha", named: false });
    expect(copyNames("2.5E-7")).toEqual({ text: "2.5E-7", named: false });
  });
  it("Copy as shown drops the mark first; Copy exact of a rational and of digits as before", () => {
    expect(copyShownText("≈ 0.333333333333")).toBe("0.333333333333");
    expect(copyExactText({ ...row("1/3"), rational: { n: "1", d: "3" } })).toBe("1/3");
    expect(copyExactText({ ...row("1.414"), fullExact: false })).toBeUndefined();
    expect(copyExactText({ ...row("list[3/2,2]"), drawn: "{3/2,2}" }, { decimalComma: true })).toBe("{3/2;2}");
  });
});

describe("G784f1: the copy writers report a stand-in turned into its letter", () => {
  const seen = (): NameSeen => ({ name: false });
  it("2*i_ (the name i) through Copy, Copy as shown and Copy exact sets it; a drawn list with beta_ and the decimal comma too", () => {
    const a = seen(), b = seen(), c = seen(), d = seen();
    expect(copyFull(row("2*i_"), {}, a)).toBe("2*i");
    expect(copyShownText("= 2*i_", b)).toBe("2*i");
    expect(copyExactText(row("2*i_"), {}, c)).toBe("2*i");
    expect(copyFull({ ...row("list[beta_,1.5]"), drawn: "{beta_,1.5}" }, { decimalComma: true }, d)).toBe("{β;1,5}");
    expect([a.name, b.name, c.name, d.name]).toEqual([true, true, true, true]);
  });
  it("the constant i (2+3*i), a string \"i_\" and a number leave it unset", () => {
    const a = seen(), b = seen(), c = seen(), d = seen();
    expect(copyFull(row("2+3*i"), {}, a)).toBe("2+3*i");
    expect(copyShownText('"i_"', b)).toBe('"i_"');
    expect(copyExactText(row("exp(2)"), {}, c)).toBe("exp(2)");
    expect(copyFull({ ...row("1/3"), rational: { n: "1", d: "3" } }, {}, d)).toBe("1/3");
    expect([a.name, b.name, c.name, d.name]).toEqual([false, false, false, false]);
  });
});
