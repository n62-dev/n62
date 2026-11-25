// SPDX-License-Identifier: GPL-3.0-or-later
// R24c: the unit view's formula, a slot after every number (docs/04 4.3), read back by the parser's units mode (R28).
import { describe, expect, it } from "vitest";
import { latexToGiacInfo } from "./latex-to-giac.ts";
import { ANS_KEY, type Chip } from "./chips.ts";
import { unitLatex } from "./chipUnit.ts";
import { constLabels, filledLatex, slotFormula } from "./unitFormula.ts";

const giac = (latex: string): string => latexToGiacInfo(slotFormula(latex).latex, { units: true }).giac;

describe("slotFormula (R24c)", () => {
  it("an empty line is the quantity 1 with its slot and the end slot", () => {
    expect(slotFormula("")).toEqual({ latex: "1\\placeholder[u1]{}\\to\\placeholder[end]{}", slots: ["u1"] });
  });
  it("puts a slot after every number, the end slot last", () => {
    expect(slotFormula("72")).toEqual({ latex: "72\\placeholder[u1]{}\\to\\placeholder[end]{}", slots: ["u1"] });
    expect(slotFormula("0+1").latex).toBe("0\\placeholder[u1]{}+1\\placeholder[u2]{}\\to\\placeholder[end]{}");
    expect(slotFormula("2\\times\\pi\\times25").slots).toEqual(["u1", "u2"]);
    expect(slotFormula("\\frac{3}{2.5}").latex).toBe("\\frac{3\\placeholder[u1]{}}{2.5\\placeholder[u2]{}}\\to\\placeholder[end]{}");
  });
  it("a ± σ belongs to its number: one slot after the σ", () => {
    expect(slotFormula("\\cos\\left(0\\pm0.1\\right)").latex).toBe("\\cos\\left(0\\pm0.1\\placeholder[u1]{}\\right)\\to\\placeholder[end]{}");
    expect(slotFormula("-\\left(20\\pm0.5\\right)").slots).toEqual(["u1"]);
    // R104: ± n % is the σ too, so the slot goes after the %
    expect(slotFormula("250\\pm0.4\\%").latex).toBe("250\\pm0.4\\%\\placeholder[u1]{}\\to\\placeholder[end]{}");
    expect(slotFormula("250\\pm0.4\\%+1").slots).toEqual(["u1", "u2"]);
    // R271: a result chip after ± is the σ: the slot goes after it, and the units key fills it with the chip's unit (R63)
    expect(slotFormula("10.1\\pm\\res{3}{0.0707}")).toEqual({ latex: "10.1\\pm\\res{3}{0.0707}\\placeholder[u1]{}\\to\\placeholder[end]{}", slots: ["u1"], chips: { u1: "res:3" } });
    expect(slotFormula("10.1\\pm \\res{3}{0.0707}\\times2").slots).toEqual(["u1", "u2"]);
    // a \% after the σ chip goes with the σ, as after a number, so the parser refuses it there (not ÷100 after the slot)
    expect(slotFormula("10\\pm\\res{3}{0.4}\\%").latex).toBe("10\\pm\\res{3}{0.4}\\%\\placeholder[u1]{}\\to\\placeholder[end]{}");
  });
  it("no slot inside a power, a subscript, a name, a constant or a root's index", () => {
    expect(slotFormula("5^{2}").latex).toBe("5\\placeholder[u1]{}^{2}\\to\\placeholder[end]{}"); // (5 u)²: the parser reads a slot only right after a number (R28)
    expect(slotFormula("x^{3}+x_{2}").slots).toEqual([]);
    expect(slotFormula("x23").slots).toEqual([]);
    expect(slotFormula("\\const{c}{c}").slots).toEqual([]);
    expect(slotFormula("\\sqrt[3]{8}").latex).toBe("\\sqrt[3]{8\\placeholder[u1]{}}\\to\\placeholder[end]{}");
  });
  it("an ᴇ number and a decimal comma are one number", () => {
    expect(slotFormula("1.5\\emark-3").slots).toEqual(["u1"]);
    expect(slotFormula("3{,}25").latex).toBe("3{,}25\\placeholder[u1]{}\\to\\placeholder[end]{}");
  });
  it("R24cf1: bare arguments, mixed numbers, DMS, \\left., the one-line ^ and the ᴇ character, as the parser reads them", () => {
    expect(slotFormula("\\frac12").latex).toBe("\\frac{1\\placeholder[u1]{}}{2\\placeholder[u2]{}}\\to\\placeholder[end]{}");
    expect(slotFormula("\\sqrt9").latex).toBe("\\sqrt{9\\placeholder[u1]{}}\\to\\placeholder[end]{}");
    expect(slotFormula("2\\tfrac12").latex).toBe("2\\tfrac12\\placeholder[u1]{}\\to\\placeholder[end]{}");
    expect(slotFormula("30\\degree15\\prime36\\doubleprime").slots).toEqual([]);
    expect(slotFormula("\\left.x^2\\right|_{x=3}").latex).toBe("\\left.x^2\\right|_{x=3}\\to\\placeholder[end]{}");
    expect(slotFormula('1\\div2\\char"5E 3x').latex).toBe('1\\placeholder[u1]{}\\div2\\placeholder[u2]{}\\char"5E 3x\\to\\placeholder[end]{}');
    expect(slotFormula("1.5ᴇ-3").slots).toEqual(["u1"]);
    expect(slotFormula("1.5\\emark+3").slots).toEqual(["u1"]);
  });
  it("the parser's units mode reads every slot as pasu<n> in the order written", () => {
    expect(giac("72")).toBe("72*pasu1");
    expect(giac("0+1")).toBe("0*pasu1+1*pasu2");
    expect(giac("\\cos\\left(0\\pm0.1\\right)")).toBe("cos(pasdeg*(pasupm(0,0.1)*pasu1))"); // (pasdeg: the mode's angle, set by the engine)
    expect(latexToGiacInfo(slotFormula("20").latex, { units: true }).units).toEqual({ slots: ["u1"], consts: [], end: "end" });
  });
  it("R63: a \\res chip is a number with a slot after it (r17 section 6), named by the chip it follows", () => {
    expect(slotFormula("\\res{3}{42}\\times2")).toEqual({
      latex: "\\res{3}{42}\\placeholder[u1]{}\\times2\\placeholder[u2]{}\\to\\placeholder[end]{}",
      slots: ["u1", "u2"],
      chips: { u1: "res:3" },
    });
    expect(slotFormula("\\res{1}{0.1\\htmlStyle{color:var(--muted)}{\\,\\text{m}}}^{2}").latex).toBe(
      "\\res{1}{0.1\\htmlStyle{color:var(--muted)}{\\,\\text{m}}}\\placeholder[u1]{}^{2}\\to\\placeholder[end]{}",
    );
    // R259: the view has an Ans (units/open.ts reads the view's last result once, when it opens), with no slot of its own
    expect(slotFormula("\\ans\\times2").slots).toEqual(["u1"]);
    const chips = { "res:3": { value: "42", exact: true } };
    expect(latexToGiacInfo(slotFormula("\\res{3}{42}\\times2").latex, { units: true, chips }).giac).toBe("((42)*pasu1)*(2*pasu2)");
  });

  // R259 (bu-7): Ans is a number in the unit view, from the table units/open.ts gives; an Ans with a unit has no slot to
  // keep it, so it is refused rather than read as a bare number (derived: 7 × 2 = 14)
  const ansGiac = (latex: string, ans?: Chip): string => latexToGiacInfo(slotFormula(latex).latex.replace("\\to\\placeholder[end]{}", ""), { units: true, chips: ans ? { [ANS_KEY]: ans } : {} }).giac;
  it("R259: Ans from the view's table is a number; with no result the honest message stays; with a unit it is refused", () => {
    expect(ansGiac("\\ans\\times2", { value: "7", exact: true })).toBe("(7)*(2*pasu1)");
    expect(() => ansGiac("\\ans\\times2")).toThrow("Ans: no result to use in this view yet");
    const unit = { text: "m", dim: "m1", slot: { tokens: [{ unit: "m" }] } };
    expect(() => ansGiac("\\ans\\times2", { value: "3", exact: true, unit })).toThrow("Ans has a unit here: use its row's chip");
    // fix round 1: a dimensionless unit row (10 ± 0.5 m ÷ 2 m = 5 ± 0.25) gives a chip with σ and no unit: refused, σ never dropped
    expect(() => ansGiac("\\ans\\times2", { value: "5", exact: false, unc: "0.25" })).toThrow("Ans has a σ here: use its row's chip");
    expect(latexToGiacInfo("\\ans\\times2", { chips: { [ANS_KEY]: { value: "3", exact: true, unit } } }).giac).toBe("(3)*2"); // Home: the unit dropped, as R63
  });
  // G782 (audit, fix round 1): a pure number shown in a unit keeps it on its chip (units/chip.test.ts pins these two chips:
  // 0.0042 ▶ % and 3 rev), so its Ans is refused in the unit view as R259 refuses any Ans with a unit; before G782 the %
  // one went in as 0.42 (off by 100) and the rev one as 3. Home takes the % one's pure number (21/50/100 = 0.0042, derived)
  // and drops rev, as R63
  it("G782: Ans of a % or a rev result is refused in the unit view; Home takes the % one's pure number", () => {
    const pct: Chip = { value: "21/50", exact: true, unit: { text: "%", dim: "", slot: { tokens: [{ unit: "percent" }] } } };
    const rev: Chip = { value: "3", exact: true, unit: { text: "rev", dim: "", slot: { tokens: [{ unit: "rev" }] } } };
    for (const c of [pct, rev]) expect(() => ansGiac("\\ans\\times2", c)).toThrow("Ans has a unit here: use its row's chip");
    const home = (c: Chip) => latexToGiacInfo("\\ans\\times2", { chips: { [ANS_KEY]: c } });
    expect(home(pct)).toEqual({ giac: "((21/50)/10^2)*2", inexact: false });
    expect(home(rev)).toEqual({ giac: "(3)*2", inexact: false, unitDropped: true });
  });
  // vfh-1 (R271 made the parser's side): a σ that is no number keeps its slot before ±, and the parser says σ is the fault
  it("R259: ± followed by no plain number, through slotFormula, is parse.pmNeedsSigma; a typed σ and a result chip stay valid", () => {
    for (const l of ["10\\pm\\left(0.5\\right)", "10\\pm x", "10\\pm\\sqrt{2}"]) expect(() => giac(l)).toThrow("± needs a plain number after it");
    expect(giac("10\\pm0.5")).toBe("pasupm(10,0.5)*pasu1");
    const chips = { "res:7": { value: "0.5", exact: true } };
    expect(latexToGiacInfo(slotFormula("10\\pm\\res{7}{0.5}").latex, { units: true, chips }).giac).toBe("pasupm(10,(5/10^1),pasws1)*pasu1"); // R271: the chip is σ
  });
});

describe("R349: slotFormula with the end slot off (the default view) and on (→ Check)", () => {
  it("off: no end prompt, the slots as with it", () => {
    expect(slotFormula("72", false)).toEqual({ latex: "72\\placeholder[u1]{}", slots: ["u1"] });
    expect(slotFormula("", false)).toEqual({ latex: "1\\placeholder[u1]{}", slots: ["u1"] });
    expect(slotFormula("0+1", false).latex).toBe("0\\placeholder[u1]{}+1\\placeholder[u2]{}");
  });
  it("on: as today (control)", () => {
    expect(slotFormula("72", true)).toEqual({ latex: "72\\placeholder[u1]{}\\to\\placeholder[end]{}", slots: ["u1"] });
    expect(slotFormula("", true)).toEqual({ latex: "1\\placeholder[u1]{}\\to\\placeholder[end]{}", slots: ["u1"] });
  });
  it("off: the parser reads the formula with no end slot", () => {
    const r = latexToGiacInfo(slotFormula("72", false).latex, { units: true });
    expect(r.giac).toBe("72*pasu1");
    expect(r.units?.end).toBeUndefined();
  });
});

describe("R925 (F379): ×10ⁿ after a number is part of it, one slot after the power", () => {
  const ends = (latex: string): string => slotFormula(latex, false).latex;
  const info = (latex: string) => latexToGiacInfo(slotFormula(latex).latex, { units: true });
  it("6.62607015×10⁻³⁴, 2×10³ and 2·10³: one slot, after the exponent, read as the ᴇ form", () => {
    expect(ends("6.62607015\\times10^{-34}")).toBe("6.62607015\\times10^{-34}\\placeholder[u1]{}");
    expect(ends("2\\times10^{3}")).toBe("2\\times10^{3}\\placeholder[u1]{}");
    expect(ends("2\\cdot10^{3}")).toBe("2\\cdot10^{3}\\placeholder[u1]{}");
    expect(ends("2 \\times 10^{+3}+1")).toBe("2 \\times 10^{+3}\\placeholder[u1]{}+1\\placeholder[u2]{}");
    expect(giac("6.62607015\\times10^{-34}")).toBe(giac("6.62607015\\emark-34"));
    expect(giac("6.62607015\\times10^{-34}")).toBe("6.62607015e-34*pasu1");
    expect(giac("2\\times10^{3}")).toBe("2e3*pasu1");
    expect(giac("2\\cdot10^{3}")).toBe("2e3*pasu1");
    expect(giac("1.5\\times10^{3}")).toBe("1.5e3*pasu1");
    expect(giac("3\\times10^{3}\\pm2")).toBe("pasupm(3e3,2)*pasu1"); // a σ after it is the value's, as after 3ᴇ3
  });
  it("a power of a number alone keeps its slot before the power (R28): (5 u)², (10 u)²", () => {
    expect(ends("5^{2}")).toBe("5\\placeholder[u1]{}^{2}");
    expect(ends("10^{2}")).toBe("10\\placeholder[u1]{}^{2}");
    expect(giac("10^{2}")).toBe("(10*pasu1)^2");
  });
  it("a σ right before ×10ⁿ is refused: 3 ± 0.1×10³ would read σ = 100", () => {
    expect(ends("3\\pm0.1\\times10^{3}")).toBe("3\\pm0.1\\times10^{3}\\placeholder[u1]{}");
    expect(() => info("3\\pm0.1\\times10^{3}")).toThrow(expect.objectContaining({ key: "parse.pmTenPower" }));
    expect(() => info("3\\pm1\\emark-2\\times10^{3}")).toThrow(expect.objectContaining({ key: "parse.pmTenPower" }));
    expect(() => latexToGiacInfo("3\\pm0.1\\times10^{3}", { units: true })).toThrow(expect.objectContaining({ key: "parse.pmTenPower" })); // the slot left empty
    expect(ends("3\\pm1\\emark-2\\times10^{3}")).toBe("3\\pm1\\emark-2\\times10^{3}\\placeholder[u1]{}"); // an ᴇ σ and a σ chip the same
    const chips = { "res:7": { value: "0.5", exact: true } };
    expect(ends("10\\pm\\res{7}{0.5}\\times10^{3}")).toBe("10\\pm\\res{7}{0.5}\\times10^{3}\\placeholder[u1]{}");
    expect(() => latexToGiacInfo(slotFormula("10\\pm\\res{7}{0.5}\\times10^{3}").latex, { units: true, chips })).toThrow(expect.objectContaining({ key: "parse.pmTenPower" }));
  });
  it("(3 ± 0.1)×10³: the bracket closes the quantity; the 10 is a number of its own with its R28 slot", () => {
    expect(ends("\\left(3\\pm0.1\\right)\\times10^{3}")).toBe("\\left(3\\pm0.1\\placeholder[u1]{}\\right)\\times10\\placeholder[u2]{}^{3}");
    expect(giac("\\left(3\\pm0.1\\right)\\times10^{3}")).toBe("(pasupm(3,0.1)*pasu1)*(10*pasu2)^3");
  });
  it("controls: a variable or a non-whole exponent, 10 with more digits, the ᴇ form and a mixed number stay as they were", () => {
    expect(ends("2\\times10^{x}")).toBe("2\\placeholder[u1]{}\\times10\\placeholder[u2]{}^{x}");
    expect(giac("2\\times10^{x}")).toBe("(2*pasu1)*(10*pasu2)^x");
    expect(ends("2\\times10^{1.5}")).toBe("2\\placeholder[u1]{}\\times10\\placeholder[u2]{}^{1.5}");
    expect(ends("2\\times100^{3}")).toBe("2\\placeholder[u1]{}\\times100\\placeholder[u2]{}^{3}");
    expect(ends("1.5\\emark-3")).toBe("1.5\\emark-3\\placeholder[u1]{}");
    expect(ends("2\\tfrac12\\times10^{3}")).toBe("2\\tfrac12\\placeholder[u1]{}\\times10\\placeholder[u2]{}^{3}");
    expect(latexToGiacInfo("2\\times10^{3}").giac).toBe("2*10^3"); // Home: a product, as before
  });
  it("the slot reader and the units-mode parser agree: the parser reads exactly the formula's slots", () => {
    for (const l of ["6.62607015\\times10^{-34}", "2\\times10^{3}", "2\\cdot10^{3}", "2\\times10^{3}\\times10^{2}", "5^{2}", "10^{2}", "\\frac{2\\times10^{3}}{4\\cdot10^{-1}}",
      "\\left(3\\pm0.1\\right)\\times10^{3}", "3\\times10^{3}\\pm2", "2\\times10^{x}", "2\\times10^{1.5}", "1.5\\emark-3", "-2\\times10^{3}"]) {
      const f = slotFormula(l);
      expect(latexToGiacInfo(f.latex, { units: true }).units?.slots, l).toEqual(f.slots);
    }
  });
});

describe("filledLatex (G216): the empty prompts dropped, the one rule of the view, Copy as Python and pydiff", () => {
  const f = slotFormula("5\\times2");
  it("drops an empty slot's prompt, and an empty end slot with its →", () => {
    expect(filledLatex(f, (id) => id === "u1")).toBe("5\\placeholder[u1]{}\\times2");
    expect(filledLatex(f, (id) => id !== "u1")).toBe("5\\times2\\placeholder[u2]{}\\to\\placeholder[end]{}");
    expect(filledLatex(f, () => true)).toBe(f.latex);
    expect(filledLatex(f, () => false)).toBe("5\\times2");
  });
});

describe("constLabels (R929): a constant's own unit after its chip, muted and read-only, in the field's LaTeX only", () => {
  const own = (id: string): string | undefined => ({ planck: "J·s", k_B: "J/K", G: "m³/(kg·s²)" })[id];
  it("puts the unit after each constant chip (a symbol with braces too); a pure number (α) gets none", () => {
    expect(constLabels("\\const{planck}{h}", own)).toBe(`\\const{planck}{h}${unitLatex("J·s")}`);
    expect(constLabels("2\\placeholder[u1]{}\\const{planck}{h}\\to\\placeholder[end]{}", own)).toBe(`2\\placeholder[u1]{}\\const{planck}{h}${unitLatex("J·s")}\\to\\placeholder[end]{}`);
    expect(constLabels("\\const{k_B}{k_{\\mathrm{B}}}\\times\\const{G}{G}", own)).toBe(`\\const{k_B}{k_{\\mathrm{B}}}${unitLatex("J/K")}\\times\\const{G}{G}${unitLatex("m³/(kg·s²)")}`);
    expect(constLabels("\\const{alpha}{\\alpha}", own)).toBe("\\const{alpha}{\\alpha}");
    expect(constLabels("\\frac{\\const {planck} {h}}{2}", own)).toBe(`\\frac{\\const {planck} {h}${unitLatex("J·s")}}{2}`);
  });
  it("leaves a line without a constant as it is, and the slots' formula untouched (no label in slotFormula)", () => {
    expect(constLabels("5\\placeholder[u1]{}\\res{3}{7}", own)).toBe("5\\placeholder[u1]{}\\res{3}{7}");
    expect(slotFormula("2\\const{planck}{h}").latex).not.toContain("htmlStyle");
  });
});
