// SPDX-License-Identifier: GPL-3.0-or-later
// G216: Copy as Python, unit rows through pint. Exact expected code, no engine: the templates are the package's own (G216
// block), the `# N62:` answers are the rows' own text as given here (5 kg in lb is 5/0.45359237, 20 °C is 68 °F, 2 s·c is
// 599584916 m: derived), never computed. Whether the code runs and agrees is the pydiff stage's (scripts/pydiff.ts).
import { describe, expect, it } from "vitest";
import { translateCells, translateRows, type PyRow } from "./python.ts";
import { PY_UNITS, absTemp, pintAttr, pintDim, pintText } from "./pyUnits.ts";
import type { UnitSlot } from "../units/types.ts";

const HEAD = "# N62 0.1.0 · Copy as Python · preview: the form of this file can change";
const PINT = ["from pint import UnitRegistry", "ureg = UnitRegistry()"];
const PINT_Q = [...PINT, "Q_ = ureg.Quantity"];
const py = (rows: PyRow[]): string => translateRows(rows, { app: "0.1.0" });
const file = (...lines: string[]): string => `${[HEAD, ...lines].join("\n")}\n`;
/** A slot as text: tokens by space ("k:N", "m^2"), one "/" for the ÷. */
const slot = (text: string): UnitSlot => {
  const parts = text.split(" ");
  const per = parts.indexOf("/");
  const tokens = parts
    .filter((p) => p !== "/")
    .map((p) => {
      const [pre, rest] = p.includes(":") ? (p.split(":") as [string, string]) : [undefined, p];
      const [unit, power] = rest.split("^") as [string, string | undefined];
      return { ...(pre ? { prefix: pre } : {}), unit, ...(power ? { power } : {}) };
    });
  return per >= 0 ? { tokens, per } : { tokens };
};
/** A done unit row: its line, its slots by prompt id, and its answer as the session line keeps it. */
const unitRow = (input: string, slots: Record<string, string>, o: Partial<PyRow>): PyRow => ({
  view: "home",
  input,
  ok: true,
  slots: Object.fromEntries(Object.entries(slots).map(([k, v]) => [k, slot(v)])),
  ...o,
});

describe("translateRows: a unit row through pint (G216)", () => {
  it("5 kg → lb", () => {
    expect(py([unitRow("5", { u1: "kg", end: "lb" }, { mark: "≈", value: "11.0231131092", unit: "lb", dim: "kg1" })])).toBe(
      file(...PINT, "_1 = (5*ureg.kg).to('lb')  # N62: ≈ 11.0231131092 lb"),
    );
  });
  it("20 °C → °F: an absolute temperature alone carries its offset (docs/04 4.3)", () => {
    expect(py([unitRow("20", { u1: "oC", end: "oF" }, { mark: "=", exact: "68", unit: "°F", dim: "K1" })])).toBe(
      file(...PINT_Q, "_1 = Q_(20, 'degC').to('degF')  # N62: = 68 °F"),
    );
    expect(py([unitRow("-5", { u1: "oC", end: "K" }, { mark: "=", exact: "5363/20", unit: "K", dim: "K1" })])).toBe(
      file(...PINT_Q, "_1 = Q_(-5, 'degC').to('K')  # N62: = 5363/20 K"),
    );
  });
  it("5 N × 2 m, shown in N·m: no end slot, pint keeps the product", () => {
    expect(py([unitRow("5\\times2", { u1: "N", u2: "m" }, { mark: "=", exact: "10", unit: "N·m", dim: "kg1m2s-2" })])).toBe(
      file(...PINT, "_1 = (5*ureg.N)*(2*ureg.m)  # N62: = 10 N·m"),
    );
  });
  it("a constant is N62's value as a literal with its SI unit, never pint's", () => {
    const out = py([
      unitRow("2\\cdot\\const{c}{c}", { u1: "s", end: "km" }, { mark: "=", exact: "2997924580/5000", value: "599584.916", unit: "km", dim: "m1", chips: { "const:c": { value: "299792458", exact: true } } }),
    ]);
    expect(out).toBe(file(...PINT_Q, "_1 = ((2*ureg.s)*Q_(299792458, 'm/s')).to('km')  # N62: = 2997924580/5000 km"));
    expect(out).not.toContain("speed_of_light");
    // a constant not in the table, or whose value the line does not keep
    expect(py([unitRow("\\const{G}{G}", {}, { mark: "≈", value: "6.6743E-11", unit: "m³/(kg·s²)", dim: "kg-1m3s-2", chips: { "const:G": { value: "6.6743E-11", exact: false } } })])).toBe(
      file("# N62 NOT TRANSLATED (constant G): \\const{G}{G}", "# N62: ≈ 6.6743E-11 m³/(kg·s²)"),
    );
    expect(py([unitRow("\\const{c}{c}", {}, { mark: "=", exact: "299792458", unit: "m/s", dim: "m1s-1" })])).toBe(
      file("# N62 NOT TRANSLATED (the value of constant c is not kept): \\const{c}{c}", "# N62: = 299792458 m/s"),
    );
  });
  it("a unit not in the table is NOT TRANSLATED (unit <id>), and binds nothing", () => {
    expect(py([unitRow("5", { u1: "rpm", end: "rad/s" }, { mark: "≈", value: "0.523598775598", unit: "rad/s", dim: "rad1s-1" })])).toBe(
      file("# N62 NOT TRANSLATED (unit rpm): 5", "# N62: ≈ 0.523598775598 rad/s"),
    );
    expect(py([unitRow("5", { u1: "kg", end: "Mi:lb" }, { mark: "≈", value: "1", unit: "Milb", dim: "kg1" })])).toBe(
      file("# N62 NOT TRANSLATED (unit Milb): 5", "# N62: ≈ 1 Milb"),
    );
  });
  it("a decimal is an exact Fraction, a quotient of whole numbers too; slots with ÷, prefixes and powers", () => {
    expect(py([unitRow("2.5", { u1: "kg" }, { mark: "=", exact: "5/2", unit: "kg", dim: "kg1" })])).toBe(
      file("from fractions import Fraction", ...PINT, "_1 = Fraction('2.5')*ureg.kg  # N62: = 5/2 kg"),
    );
    // the slot after a numerator is the numerator's unit (1 m / 3); a quotient of whole numbers is a Fraction
    expect(py([unitRow("\\frac{1}{3}", { u1: "m" }, { mark: "=", exact: "1/3", unit: "m", dim: "m1" })])).toBe(file(...PINT, "_1 = 1*ureg.m/3  # N62: = 1/3 m"));
    expect(py([unitRow("\\frac{1}{3}\\times2", { u3: "m" }, { mark: "=", exact: "2/3", unit: "m", dim: "m1" })])).toBe(
      file("from fractions import Fraction", ...PINT, "_1 = Fraction(1, 3)*(2*ureg.m)  # N62: = 2/3 m"),
    );
    expect(py([unitRow("72", { u1: "km / h", end: "m / s" }, { mark: "=", exact: "20", unit: "m/s", dim: "m1s-1" })])).toBe(
      file(...PINT, "_1 = (72*(ureg.km/ureg.h)).to('m/s')  # N62: = 20 m/s"),
    );
    expect(py([unitRow("3", { u1: "k:N m^2", end: "N" }, { mark: "=", exact: "3000", unit: "N", dim: "kg1m3s-2" })])).toContain(
      "_1 = (3*(ureg.kN*ureg.m**2)).to('N')",
    );
  });
  it("a unit whose pint name is a Python keyword is written ureg('<name>'): in, and as (attosecond)", () => {
    expect(py([unitRow("3", { u1: "in", end: "cm" }, { mark: "=", exact: "381/50", unit: "cm", dim: "m1" })])).toBe(
      file(...PINT, "_1 = (3*ureg('in')).to('cm')  # N62: = 381/50 cm"),
    );
    expect(py([unitRow("2", { u1: "a:s", end: "s" }, { mark: "=", exact: "1/500000000000000000", unit: "s", dim: "s1" })])).toBe(
      file(...PINT, "_1 = (2*ureg('as')).to('s')  # N62: = 1/500000000000000000 s"),
    );
    expect(pintAttr(slot("in^2"))).toEqual({ s: "ureg('in')**2", p: 4 });
    expect(pintAttr(slot("in^3 / a:s")).s).toBe("ureg('in')**3/ureg('as')");
    expect(pintText(slot("in^2"))).toBe("in**2");
  });
  it("°C and °F inside a compound unit are an interval (pint's delta unit)", () => {
    expect(py([unitRow("4186", { u1: "J / kg oC" }, { mark: "=", exact: "4186", unit: "J/(kg·°C)", dim: "K-1m2s-2" })])).toBe(
      file(...PINT, "_1 = 4186*(ureg.J/(ureg.kg*ureg.delta_degC))  # N62: = 4186 J/(kg·°C)"),
    );
  });
  it("what a unit row does not translate: a function, a store, a chip, an old line without its slots", () => {
    expect(py([unitRow("\\sin\\left(30\\right)", { u1: "deg" }, { mark: "=", exact: "1/2", unit: "", dim: "" })])).toBe(
      file("# N62 NOT TRANSLATED (Sin in a unit row is not translated): \\sin\\left(30\\right)", "# N62: = 1/2"),
    );
    expect(py([{ view: "home", input: "2\\times3", ok: true, mark: "=", exact: "6", unit: "m", dim: "m1" }])).toBe(
      file("# N62 NOT TRANSLATED (a unit row that does not keep its slots is not translated): 2\\times3", "# N62: = 6 m"),
    );
  });
  it("a unit row binds a Quantity: a Home row after it reads Ans as the number it held", () => {
    expect(
      py([
        unitRow("5\\times2", { u1: "N", u2: "m" }, { mark: "=", exact: "10", unit: "N·m", dim: "kg1m2s-2" }),
        { view: "home", input: "\\ans\\times2", ok: true, mark: "=", exact: "20", ans: { value: "10", exact: true } },
      ]),
    ).toBe(file(...PINT, "_1 = (5*ureg.N)*(2*ureg.m)  # N62: = 10 N·m", "_2 = 10*2  # an earlier result  # N62: = 20"));
  });
});

// G217: σ through uncertainties. The rows' answers are given here as the session line keeps them; σ's texts are derived
// (GUM 5.1.2 with its note, N62's rule, evaluate.ts): (1 ± 0.5)² has σ² = 1 + 1/8, σ ≈ 1.06 → "1.1", share 1/9 > 0.1
// (order2); 3 ± 0.2 squared has σ² = 1.44 + 0.0032, σ ≈ 1.2013 → "1.2", share 0.002 (no why); 2·(1 ± 0.1) is 0.20;
// (1 ± 0.1) + (1 ± 0.1)·2.5 has σ = √0.0725 ≈ 0.269 → "0.27".
const UFLOAT = "from uncertainties import ufloat";
const NOTE = "(N62's σ includes the second-order term; uncertainties is first-order)";
describe("translateRows: σ through uncertainties (G217)", () => {
  it("(1 ± 0.5)²: one ufloat named once, the expression x**2, and the second-order note after the value and σ", () => {
    expect(py([unitRow("\\left(1\\pm0.5\\right)^2", {}, { mark: "≈", value: "1", unit: "", dim: "", sigma: "1.1", sigmaWhy: "order2" })])).toBe(
      file(UFLOAT, "_1_u1 = ufloat(1, 0.5)", `_1 = _1_u1**2  # N62: ≈ 1 ± 1.1 ${NOTE}`),
    );
  });
  it("a linear row has no note; a slot makes the ufloat a Quantity", () => {
    const out = py([unitRow("2\\times\\left(1\\pm0.1\\right)", { u2: "kg" }, { mark: "≈", value: "2", unit: "kg", dim: "kg1", sigma: "0.20" })]);
    expect(out).toBe(file(...PINT, UFLOAT, "_1_u1 = ufloat(1, 0.1)", "_1 = 2*(_1_u1*ureg.kg)  # N62: ≈ 2 ± 0.20 kg"));
    expect(py([unitRow("5\\pm0.1", { u1: "kg" }, { mark: "≈", value: "5", unit: "kg", dim: "kg1", sigma: "0.10" })])).toBe(
      file(...PINT, UFLOAT, "_1_u1 = ufloat(5, 0.1)", "_1 = _1_u1*ureg.kg  # N62: ≈ 5 ± 0.10 kg"),
    );
    // two typed ± values are two inputs (G18), a sum of them is linear; a decimal in a σ row is a float (no Fraction × ufloat)
    expect(py([unitRow("\\left(1\\pm0.1\\right)+\\left(1\\pm0.1\\right)\\times2.5", {}, { mark: "≈", value: "3.5", unit: "", dim: "", sigma: "0.27" })])).toBe(
      file(UFLOAT, "_1_u1 = ufloat(1, 0.1)", "_1_u2 = ufloat(1, 0.1)", "_1 = _1_u1 + _1_u2*2.5  # N62: ≈ 3.5 ± 0.27"),
    );
  });
  it("R115: a chip used twice is one ufloat; a non-linear row has the note whatever its why", () => {
    const chips = { "res:1": { value: "3", exact: false, unc: "0.2" } };
    expect(py([unitRow("\\res{1}{3}\\times\\res{1}{3}", {}, { mark: "≈", value: "9", unit: "", dim: "", sigma: "1.2", chips })])).toBe(
      file(UFLOAT, "_1_u1 = ufloat(3, 0.2)", `_1 = _1_u1*_1_u1  # N62: ≈ 9 ± 1.2 ${NOTE}`),
    );
  });
  it("a why of jump or singular adds N62's ⚠ reason", () => {
    expect(py([unitRow("\\frac{1}{0.1\\pm0.2}", {}, { mark: "≈", value: "10", unit: "", dim: "", sigma: "110", sigmaWhy: "singular" })])).toBe(
      file(UFLOAT, "_1_u1 = ufloat(0.1, 0.2)", `_1 = 1/_1_u1  # N62: ≈ 10 ± 110 ⚠ the interval reaches a singular point ${NOTE}`),
    );
  });
  it("the sync file's tag ends the ufloat's name too; Home's Ans after a σ row is its number", () => {
    expect(translateCells([unitRow("5\\pm0.1", {}, { mark: "≈", value: "5", unit: "", dim: "", sigma: "0.10" })], { tag: "_p" })[0]?.code).toBe(
      "_1_p_u1 = ufloat(5, 0.1)\n_1_p = _1_p_u1  # N62: ≈ 5 ± 0.10",
    );
    expect(
      py([unitRow("5\\pm0.1", {}, { mark: "≈", value: "5", unit: "", dim: "", sigma: "0.10" }), { view: "home", input: "\\ans\\times2", ok: true, mark: "=", exact: "10", ans: { value: "5", exact: false } }]),
    ).toBe(file(UFLOAT, "_1_u1 = ufloat(5, 0.1)", "_1 = _1_u1  # N62: ≈ 5 ± 0.10", "_2 = 5*2  # an earlier result  # N62: = 10"));
  });
  it("not translated: a result chip as σ (R271), a constant with an uncertainty", () => {
    const chips = { "res:1": { value: "0.1", exact: false } };
    expect(py([unitRow("5\\pm\\res{1}{0.1}", {}, { mark: "≈", value: "5", unit: "", dim: "", sigma: "0.10", chips })])).toBe(
      file("# N62 NOT TRANSLATED (a result chip as σ is not translated): 5\\pm\\res{1}{0.1}", "# N62: ≈ 5 ± 0.10"),
    );
    const c = { "const:c": { value: "299792458", exact: false, unc: "1" } };
    expect(py([unitRow("\\const{c}{c}", {}, { mark: "≈", value: "299792458", unit: "m/s", dim: "m1s-1", sigma: "1", chips: c })])).toBe(
      file("# N62 NOT TRANSLATED (a constant with an uncertainty is not translated): \\const{c}{c}", "# N62: ≈ 299792458 ± 1 m/s"),
    );
  });
});

describe("pyUnits: the table's forms", () => {
  it("a slot as attributes and as text; °C alone is absolute", () => {
    expect(pintAttr(slot("kg"))).toEqual({ s: "ureg.kg", p: 5 });
    expect(pintAttr(slot("m^2"))).toEqual({ s: "ureg.m**2", p: 4 });
    expect(pintAttr(slot("/ s"))).toEqual({ s: "1/ureg.s", p: 2 });
    expect(pintAttr(slot("ft^3 / min")).s).toBe("ureg.ft**3/ureg.min");
    expect(pintAttr(slot("cfm")).s).toBe("ureg('ft**3/min')");
    expect(pintText(slot("m / s^2"))).toBe("m/s**2");
    expect(pintText(slot("oF"))).toBe("degF");
    expect(absTemp(slot("oC"))).toBe("degC");
    expect(absTemp(slot("oC^-1"))).toBeUndefined();
    expect(pintDim("kg1m2s-2")).toBe("kg*m**2/s**2");
    expect(pintDim("K-1kg1m2mol-1s-2")).toBe("kg*m**2/(K*mol*s**2)");
    expect(pintDim("mol-1")).toBe("1/mol");
  });
  it("a Find id that is a power of a name is that name with its power", () => {
    expect(pintAttr(slot("m^2"))).toEqual({ s: "ureg.m**2", p: 4 });
    expect(pintText(slot("ft^2"))).toBe("ft**2");
    expect(pintText(slot("m^2 / s"))).toBe("m**2/s");
  });
  it("leaves out what N62 reads otherwise (rpm counts turns, G40; dB is G17's)", () => {
    for (const id of ["rpm", "tr", "dB", "dBm", "Np", "Btu", "gauss", "c_unit"]) expect(PY_UNITS.has(id)).toBe(false);
  });
});
