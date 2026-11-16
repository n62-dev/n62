// SPDX-License-Identifier: GPL-3.0-or-later
// G275: the formula set's model and its text form. Structural only: no value is evaluated, so every expectation is a
// name, an order or an error the module's own rules give (no engine, no oracle).
import { describe, expect, it } from "vitest";
import { namesIn } from "../engine/giacPrint.ts";
import { isSetError, readSet, stepOrder, writeSet, type FormulaSet } from "./model.ts";

/** An RC filter as a set (the step idea of docs/archive/mockups/results-mode.html): two inputs with units, three steps. */
const RC: FormulaSet = {
  name: "RC filter",
  inputs: [
    { name: "R", value: "4.7", sigma: "0.24", slot: { tokens: [{ prefix: "k", unit: "ohm" }] } },
    { name: "C", value: "100", slot: { tokens: [{ prefix: "n", unit: "F" }] } },
  ],
  steps: [
    { name: "tau", expr: "R*C", end: { tokens: [{ prefix: "u", unit: "s" }] } },
    { name: "f", expr: "1/(2*pi*tau)", end: { tokens: [{ unit: "Hz" }] } },
    { name: "H", expr: "1/sqrt(1+(1000/f)^2)" },
  ],
};

/** RC as writeSet writes it: the format number first, two-space JSON, fields in the model's order, a final newline. */
const RC_TEXT = `{
  "n62-set": 1,
  "name": "RC filter",
  "inputs": [
    {
      "name": "R",
      "value": "4.7",
      "sigma": "0.24",
      "slot": {
        "tokens": [
          {
            "prefix": "k",
            "unit": "ohm"
          }
        ]
      }
    },
    {
      "name": "C",
      "value": "100",
      "slot": {
        "tokens": [
          {
            "prefix": "n",
            "unit": "F"
          }
        ]
      }
    }
  ],
  "steps": [
    {
      "name": "tau",
      "expr": "R*C",
      "end": {
        "tokens": [
          {
            "prefix": "u",
            "unit": "s"
          }
        ]
      }
    },
    {
      "name": "f",
      "expr": "1/(2*pi*tau)",
      "end": {
        "tokens": [
          {
            "unit": "Hz"
          }
        ]
      }
    },
    {
      "name": "H",
      "expr": "1/sqrt(1+(1000/f)^2)"
    }
  ]
}
`;

/** A set's text with `edit` applied to its parsed JSON (the base: RC's text). */
function edited(edit: (j: Record<string, unknown>) => void, base: string = RC_TEXT): string {
  const j = JSON.parse(base) as Record<string, unknown>;
  edit(j);
  return JSON.stringify(j);
}
const inputs = (j: Record<string, unknown>): Record<string, unknown>[] => j["inputs"] as Record<string, unknown>[];
const steps = (j: Record<string, unknown>): Record<string, unknown>[] => j["steps"] as Record<string, unknown>[];
/** The steps list as untrusted data, to put a non-object in it. */
const rawSteps = (j: Record<string, unknown>): unknown[] => j["steps"] as unknown[];

describe("G275 first check: namesIn reads a set's step", () => {
  it("returns a multi-letter name as one and leaves out a called function", () => {
    expect(namesIn("2*Mass+sqrt(M)", "typed")).toEqual(["Mass", "M"]);
    expect(namesIn("1/sqrt(1+(1000/f)^2)", "typed")).toEqual(["f"]);
  });
});

describe("G275 the text form", () => {
  it("reads and writes a valid set unchanged", () => {
    expect(readSet(RC_TEXT)).toEqual(RC);
    expect(writeSet(RC)).toBe(RC_TEXT);
    const read = readSet(RC_TEXT);
    expect(isSetError(read)).toBe(false);
    if (!isSetError(read)) expect(writeSet(read)).toBe(RC_TEXT);
    expect(readSet(writeSet(RC))).toEqual(RC);
  });

  it("starts with the format number", () => {
    expect(writeSet(RC)).toMatch(/^\{\s*"n62-set": 1,/);
  });

  it("keeps a field it does not hold absent, and a step that reads only inputs", () => {
    const small: FormulaSet = { name: "s", inputs: [{ name: "M", value: "-2.5e3" }], steps: [{ name: "S", expr: "M^2" }] };
    expect(readSet(writeSet(small))).toEqual(small);
    expect(Object.keys((readSet(writeSet(small)) as FormulaSet).inputs[0]!)).toEqual(["name", "value"]);
  });

  it("allows Giac's constants and called functions in a step", () => {
    const set = readSet(edited((j) => (steps(j)[2]!["expr"] = "exp(i*pi)*e+abs(f)")));
    expect(isSetError(set)).toBe(false);
  });
});

describe("G275 stepOrder", () => {
  it("puts a step after the steps it reads", () => {
    const set: FormulaSet = { name: "s", inputs: [{ name: "x", value: "1" }], steps: [{ name: "S", expr: "M+1" }, { name: "M", expr: "2*x" }] };
    expect(stepOrder(set)).toEqual(["M", "S"]);
    expect(isSetError(readSet(writeSet(set)))).toBe(false);
  });

  it("keeps the listed order where no step reads another", () => {
    expect(stepOrder(RC)).toEqual(["tau", "f", "H"]);
    const free: FormulaSet = { name: "s", inputs: [{ name: "x", value: "1" }], steps: [{ name: "B", expr: "x" }, { name: "A", expr: "x" }] };
    expect(stepOrder(free)).toEqual(["B", "A"]);
  });

  it("refuses a name that is neither an input nor a step", () => {
    const set: FormulaSet = { name: "s", inputs: [{ name: "x", value: "1" }], steps: [{ name: "S", expr: "x+Z" }] };
    expect(stepOrder(set)).toEqual({ error: "unknown", step: "S", name: "Z" });
  });

  it("refuses a cycle with its steps", () => {
    const set: FormulaSet = { name: "s", inputs: [], steps: [{ name: "M", expr: "S+1" }, { name: "S", expr: "M*2" }] };
    expect(stepOrder(set)).toEqual({ error: "cycle", steps: ["M", "S"] });
    const self: FormulaSet = { name: "s", inputs: [], steps: [{ name: "S", expr: "S+1" }] };
    expect(stepOrder(self)).toEqual({ error: "cycle", steps: ["S"] });
  });

  it("refuses a step or an input called as a function (fix round 1)", () => {
    const before: FormulaSet = { name: "s", inputs: [{ name: "x", value: "1" }], steps: [{ name: "S", expr: "M(2)+1" }, { name: "M", expr: "2*x" }] };
    expect(stepOrder(before)).toEqual({ error: "call", step: "S", name: "M" });
    expect(readSet(writeSet(before))).toEqual({ error: "call", step: "S", name: "M" });
    const loop: FormulaSet = { name: "s", inputs: [], steps: [{ name: "M", expr: "S(1)" }, { name: "S", expr: "M(1)" }] };
    expect(stepOrder(loop)).toEqual({ error: "call", step: "M", name: "S" });
    expect(readSet(writeSet(loop))).toEqual({ error: "call", step: "M", name: "S" });
    const input: FormulaSet = { name: "s", inputs: [{ name: "tau", value: "1" }], steps: [{ name: "S", expr: "tau(1+x)" }] };
    expect(stepOrder(input)).toEqual({ error: "call", step: "S", name: "tau" });
  });
});

describe("G275 readSet refuses untrusted text", () => {
  it("a newer format", () => {
    expect(readSet(edited((j) => (j["n62-set"] = 2)))).toEqual({ error: "newer", version: 2 });
  });

  it("a text without the format number, or a format number that is not one", () => {
    expect(readSet(edited((j) => delete j["n62-set"]))).toEqual({ error: "format" });
    expect(readSet(edited((j) => (j["n62-set"] = "1")))).toEqual({ error: "format" });
    expect(readSet(edited((j) => (j["n62-set"] = 0)))).toEqual({ error: "format" });
    expect(readSet("[1]")).toEqual({ error: "format" });
  });

  it("text that is not JSON", () => {
    expect(readSet("{\"n62-set\": 1,")).toEqual({ error: "json" });
    expect(readSet("n62-set 1")).toEqual({ error: "json" });
  });

  it("an unknown name in a step", () => {
    expect(readSet(edited((j) => (steps(j)[1]!["expr"] = "1/(2*pi*Z)")))).toEqual({ error: "unknown", step: "f", name: "Z" });
  });

  it("a cycle", () => {
    const text = edited((j) => {
      j["steps"] = [{ name: "M", expr: "S+R" }, { name: "S", expr: "M*C" }];
    });
    expect(readSet(text)).toEqual({ error: "cycle", steps: ["M", "S"] });
  });

  it("a repeated name, input or step", () => {
    expect(readSet(edited((j) => (inputs(j)[1]!["name"] = "R")))).toEqual({ error: "repeat", name: "R" });
    expect(readSet(edited((j) => (steps(j)[2]!["name"] = "tau")))).toEqual({ error: "repeat", name: "tau" });
    expect(readSet(edited((j) => (steps(j)[0]!["name"] = "C")))).toEqual({ error: "repeat", name: "C" });
  });

  it("a name of a function Giac reads, a constant, a keyword or one of ours", () => {
    expect(readSet(edited((j) => (inputs(j)[0]!["name"] = "sin")))).toEqual({ error: "reserved", name: "sin" });
    expect(readSet(edited((j) => (steps(j)[0]!["name"] = "pi")))).toEqual({ error: "reserved", name: "pi" });
    expect(readSet(edited((j) => (inputs(j)[0]!["name"] = "while")))).toEqual({ error: "reserved", name: "while" });
    expect(readSet(edited((j) => (inputs(j)[0]!["name"] = "pasdeg")))).toEqual({ error: "reserved", name: "pasdeg" });
    expect(readSet(edited((j) => (inputs(j)[0]!["name"] = "sigfig")))).toEqual({ error: "reserved", name: "sigfig" });
  });

  it("a name the caller says the engine reads", () => {
    const own = (n: string): boolean => n === "R";
    expect(readSet(RC_TEXT, own)).toEqual({ error: "reserved", name: "R" });
  });

  it("a name that is not a name", () => {
    expect(readSet(edited((j) => (inputs(j)[0]!["name"] = "2R")))).toEqual({ error: "name", name: "2R" });
    expect(readSet(edited((j) => (inputs(j)[0]!["name"] = "__proto__")))).toEqual({ error: "name", name: "__proto__" });
    expect(readSet(edited((j) => (steps(j)[0]!["name"] = "")))).toEqual({ error: "name", name: "" });
  });

  it("a negative sigma", () => {
    expect(readSet(edited((j) => (inputs(j)[0]!["sigma"] = "-0.24")))).toEqual({ error: "sigma", input: "R" });
  });

  it("a value that is not a decimal", () => {
    for (const v of ["4,7", "1/3", "pi", "", " 4.7", "0x10", "Infinity", "NaN", "4.7.1"]) {
      expect(readSet(edited((j) => (inputs(j)[0]!["value"] = v)))).toEqual({ error: "value", input: "R" });
    }
    expect(readSet(edited((j) => (inputs(j)[0]!["value"] = 4.7)))).toEqual({ error: "value", input: "R" });
  });

  it("a sigma that is not a decimal", () => {
    for (const s of ["0,24", "2/10", "x", ""]) {
      expect(readSet(edited((j) => (inputs(j)[0]!["sigma"] = s)))).toEqual({ error: "sigma", input: "R" });
    }
    expect(readSet(edited((j) => (inputs(j)[0]!["sigma"] = 0.24)))).toEqual({ error: "sigma", input: "R" });
  });

  it("a step that is not an object", () => {
    expect(readSet(edited((j) => (rawSteps(j)[1] = "R*C")))).toEqual({ error: "field", path: "steps[1]" });
    expect(readSet(edited((j) => (rawSteps(j)[1] = null)))).toEqual({ error: "field", path: "steps[1]" });
    expect(readSet(edited((j) => (rawSteps(j)[1] = ["f", "R*C"])))).toEqual({ error: "field", path: "steps[1]" });
  });

  it("a field missing, of the wrong type, or not the model's", () => {
    expect(readSet(edited((j) => delete j["name"]))).toEqual({ error: "field", path: "name" });
    expect(readSet(edited((j) => (j["steps"] = {})))).toEqual({ error: "field", path: "steps" });
    expect(readSet(edited((j) => (j["extra"] = 1)))).toEqual({ error: "field", path: "extra" });
    expect(readSet(edited((j) => (steps(j)[0]!["expr"] = 3)))).toEqual({ error: "field", path: "steps[0].expr" });
    expect(readSet(edited((j) => (steps(j)[0]!["expr"] = "(R*C")))).toEqual({ error: "field", path: "steps[0].expr" });
    expect(readSet(edited((j) => (inputs(j)[0]!["note"] = "x")))).toEqual({ error: "field", path: "inputs[0].note" });
    expect(readSet(edited((j) => (inputs(j)[0]!["slot"] = { tokens: [{ unit: "" }] })))).toEqual({ error: "field", path: "inputs[0].slot" });
    expect(readSet(edited((j) => (inputs(j)[0]!["slot"] = { tokens: [{ unit: "m", power: "1/0" }] })))).toEqual({ error: "field", path: "inputs[0].slot" });
    expect(readSet(edited((j) => (inputs(j)[0]!["slot"] = { tokens: [{ unit: "m" }], per: 2 })))).toEqual({ error: "field", path: "inputs[0].slot" });
    expect(readSet(edited((j) => (steps(j)[0]!["end"] = { tokens: "s" })))).toEqual({ error: "field", path: "steps[0].end" });
  });

  it("a slot with a power and a per is kept", () => {
    const text = edited((j) => (inputs(j)[0]!["slot"] = { tokens: [{ unit: "m" }, { unit: "s", power: "2" }], per: 1 }));
    const set = readSet(text);
    expect(isSetError(set)).toBe(false);
    if (!isSetError(set)) expect(set.inputs[0]!.slot).toEqual({ tokens: [{ unit: "m" }, { unit: "s", power: "2" }], per: 1 });
  });
});
