// SPDX-License-Identifier: GPL-3.0-or-later
// G216: the unit table's check (scripts/pyunits-check.ts) against pint in tests/golden/.venv and find/factors.yaml. It
// passes on the table as kept and goes red on one wrong entry; without the venv it fails, never skips (as pydiff).
import { describe, expect, it } from "vitest";
import { PY_CONSTS, PY_UNITS } from "../src/clipboard/pyUnits.ts";
import { pyunitsCheck, siParts } from "./pyunits-check.ts";
import { venvPython } from "./pydiff.ts";

const py = venvPython() ?? "python-missing";

describe("pyunits-check (G216)", () => {
  it("reads Find's factor forms exactly", () => {
    expect(siParts("45359237/100000000")).toEqual({ q: "45359237/100000000", pi: 0 });
    expect(siParts("pi/180")).toEqual({ q: "1/180", pi: 1 });
    expect(siParts("pi^2/32400")).toEqual({ q: "1/32400", pi: 2 });
    expect(siParts("2*pi")).toEqual({ q: "2", pi: 1 });
    expect(siParts("5/9+45967/180")).toEqual({ q: "5/9", pi: 0, offset: "45967/180" });
    expect(siParts("96939420213600000/pi")).toBeUndefined();
  });
  it("the table agrees with pint and find/factors.yaml", () => {
    const r = pyunitsCheck(py);
    expect(r.problems).toEqual([]);
    expect(r.checked).toBeGreaterThan(PY_UNITS.size);
  }, 120_000);
  it("goes red on a wrong entry: lb as pint's kg, a constant's dimension", () => {
    const units = PY_UNITS as Map<string, string>;
    const consts = PY_CONSTS as Map<string, string>;
    units.set("lb", "kg");
    consts.set("c", "m1s-2");
    try {
      const r = pyunitsCheck(py);
      expect(r.problems.some((p) => p.startsWith("unit lb: pint's kg is 1 in SI"))).toBe(true);
      expect(r.problems.some((p) => p.startsWith("constant c: dimension m1s-2"))).toBe(true);
    } finally {
      units.set("lb", "lb");
      consts.set("c", "m1s-1");
    }
  }, 120_000);
});
