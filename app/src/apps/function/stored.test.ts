// SPDX-License-Identifier: GPL-3.0-or-later
// R361: the Plot draws a definition that reads a stored real value at the engine's value (compile.ts with `values`,
// stored.ts). Expected values derived: 3·2² = 12, 4700·2 = 9400.
import { describe, expect, it } from "vitest";
import { compileDefinition } from "./compile.ts";
import { drawValues, nameRead, noteOf, usesOf } from "./stored.ts";
import type { PlotValue } from "../../engine/plotValues.ts";

const id = (s: string): string => s;
const reads = (...vs: PlotValue[]) => new Map(vs.map((v) => [v.name, nameRead(v)]));

describe("compileDefinition with stored values (R361)", () => {
  it("A·x² with A = 3: an evaluator, fn(2) = 12; it names A as the engine read it", () => {
    const c = compileDefinition("A\\cdot x^{2}", "rad", new Map([["A", 3]]), ["A"]);
    expect(c.fn?.(2)).toBe(12);
    expect(c.uses).toEqual(["A"]);
    expect(c.giac).not.toBe("");
  });
  it("R·x with R = 4700: fn(2) = 9400", () => {
    expect(compileDefinition("R\\cdot x", "rad", new Map([["R", 4700]])).fn?.(2)).toBe(9400);
  });
  it("a name with no value given: no evaluator; the names read are the engine's answer, none before it", () => {
    expect(compileDefinition("A\\cdot x^{2}", "rad").fn).toBeUndefined();
    expect(compileDefinition("A\\cdot x^{2}", "rad").uses).toBeUndefined();
    expect(compileDefinition("A\\cdot x^{2}", "rad", undefined, ["A"]).uses).toEqual(["A"]);
  });
  it("a value that is not a real number (complex, a list, a matrix): no evaluator, and its note names the slot and the name", () => {
    for (const v of [
      { name: "B", kind: "var", re: 1, im: 2 }, // complex
      { name: "B", kind: "var" }, // a list or a matrix: no single number
    ] as PlotValue[]) {
      const r = reads(v);
      const c = compileDefinition("B\\cdot x", "rad", drawValues(r), usesOf([v]));
      expect(c.fn).toBeUndefined();
      expect(c.uses).toEqual(["B"]);
      expect(noteOf("F2", "B", r.get("B")!, false, id, id)).toBe("F2 uses B: not drawn, its value is not a real number");
    }
  });
  it("a name the log does not hold, or a function: not drawn, it holds no value", () => {
    expect(noteOf("F1", "y", nameRead({ name: "y", kind: "none" }), false, id, id)).toBe("F1 uses y: not drawn, it holds no value");
    expect(nameRead({ name: "g", kind: "fn" })).toEqual({ why: "noValue" });
  });
  it("a user function f(x): no evaluator, and the engine's fn kind is no name to note, even with a value for f", () => {
    const c = compileDefinition("f\\left(x\\right)", "rad", new Map([["f", 2]]), usesOf([{ name: "f", kind: "fn" }]));
    expect(c.fn).toBeUndefined();
    expect(c.uses).toBeUndefined();
  });
  it("control: x² draws as before and reads no name", () => {
    const c = compileDefinition("x^2");
    expect(c.fn?.(3)).toBe(9);
    expect(c.uses).toBeUndefined();
  });
});

describe("the Plot's note for a stored name (R361)", () => {
  it("a plain real value drawn: no note", () => {
    expect(noteOf("F1", "A", nameRead({ name: "A", kind: "var", re: 3, im: 0 }), true, id, id)).toBeUndefined();
  });
  it("a value with σ: drawn at its central value, the note names σ (G18's form)", () => {
    const r = nameRead({ name: "A", kind: "var", re: 3, im: 0, sigma: "0.1" });
    expect(drawValues(new Map([["A", r]])).get("A")).toBe(3);
    expect(noteOf("F1", "A", r, true, id, id)).toBe("F1 uses A = 3.00 ± 0.10: drawn at 3");
  });
  it("a value with a unit: drawn at its number, the note names the unit dropped", () => {
    expect(noteOf("F1", "R", nameRead({ name: "R", kind: "var", re: 4.7, im: 0, unit: "kΩ" }), true, id, id)).toBe("F1 uses R in kΩ: unit dropped, drawn at 4.7");
  });
  it("σ and a unit: both named", () => {
    expect(noteOf("F1", "G", nameRead({ name: "G", kind: "var", re: 9.81, im: 0, sigma: "0.01", unit: "m/s²" }), true, id, id)).toBe("F1 uses G = 9.810 ± 0.010 m/s²: unit dropped, drawn at 9.81");
  });
  it("a slot that is not drawn for another reason says nothing of σ", () => {
    expect(noteOf("F1", "A", nameRead({ name: "A", kind: "var", re: 3, im: 0, sigma: "0.1" }), false, id, id)).toBeUndefined();
  });
});
