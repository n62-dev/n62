// SPDX-License-Identifier: GPL-3.0-or-later
// G800: the unit sweep's checks (unitsweep-checks.ts) on the owner-style hunt's three wrong drawings (2026-11-23, h3 #4, #5 and the row
// R886 gave its ⚠: each is the text phase-1 drew before R885 and R886, from their reports), on their right drawings, and on the
// evaluator and the screen's code with real Giac (unitsweep.ts rowOf, the view's headline, Copy as shown). Expected σ values: derived
// (the GUM's formula, units.yaml's header) and checked against units.yaml's g01, g03, g04 rows.
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { decimalFromString, type DecimalValue } from "../src/engine/format.ts";
import { defaultHomeSettings } from "../src/engine/homeEval.ts";
import { giacAvailable } from "../src/engine/nodeGiac.ts";
import type { EngineHost } from "../src/engine/host.ts";
import type { IndexItem } from "../src/find/types.ts";
import { loadTidy } from "../src/state/tidyLoad.ts";
import { buildJob } from "../src/units/build.ts";
import { factorTable, type FactorTable } from "../src/units/factors.ts";
import { shownOf, type UnitShown } from "../src/units/result.ts";
import { isUnitError, type Quantity } from "../src/units/types.ts";
import { freshHost, root } from "./golden/lib.ts";
import { requestOf } from "./unit-case.ts";
import { drawingCheck, placeOf, readNumber, sigmaCheck, sigmaOracle, tripCheck, type DrawingIn } from "./unitsweep-checks.ts";
import { generateUnitCases, poolsOf } from "./unitsweep-gen.ts";
import { loadUnitKnown, rowOf, unitSweep } from "./unitsweep.ts";

const dec = (s: string): DecimalValue => decimalFromString(s)!;
const ts = " ";
const checks = (d: Partial<DrawingIn> & Pick<DrawingIn, "row" | "head">): string[] =>
  drawingCheck({ value: dec("1"), sigma: dec("0.1"), reliable: null, unit: "m", copy: d.row, viewWarn: false, ...d }).map((f) => f.check);

describe("the drawing check (G800)", () => {
  it("h3 #4: a row cut above σ fails (phase-1 drew 1234567890.12 ± 0.00010 m); to σ's digit it passes", () => {
    const at = { value: dec("1234567890.12345"), sigma: dec("0.0001") };
    expect(checks({ ...at, row: "1234567890.12 ± 0.00010 m", head: "1234567890.12345 ± 0.00010" })).toContain("cut");
    expect(checks({ ...at, row: "1234567890.12345 ± 0.00010 m", head: "1234567890.12345 ± 0.00010" })).toEqual([]);
  });

  it("h3 #5: PFX σ in plain units beside a prefixed value fails (4.7 k ± 100 m); σ in the value's prefix passes", () => {
    const at = { value: dec("4700"), sigma: dec("100") };
    expect(checks({ ...at, row: `4.7${ts}k ± 100 m`, head: `4.70${ts}k ± 0.10${ts}k` })).toEqual(expect.arrayContaining(["form", "cut"]));
    expect(checks({ ...at, row: `4.70${ts}k ± 0.10${ts}k m`, head: `4.70${ts}k ± 0.10${ts}k` })).toEqual([]);
    // σ read as 0.10 k is 100: right; read as 0.10 (no prefix) it is 1000 times too small
    expect(checks({ ...at, row: `4.70${ts}k ± 0.10 m`, head: `4.70${ts}k ± 0.10${ts}k` })).toEqual(expect.arrayContaining(["sigma", "form"]));
  });

  it("R886: a row that drops σ's ⚠ the view has fails (ln(1 ± 0.5)); with the ⚠ it passes", () => {
    const at = { value: dec("0"), sigma: dec("0.637377439199"), unit: "", viewWarn: true };
    expect(checks({ ...at, row: "0.00 ± 0.64", head: "0.00 ± 0.64" })).toEqual(["warn"]);
    expect(checks({ ...at, row: "0.00 ± ⚠0.64", head: "0.00 ± 0.64" })).toEqual([]);
  });

  it("Copy as shown must be the row; the headline's σ is the row's", () => {
    const at = { value: dec("9.81"), sigma: dec("0.05") };
    expect(checks({ ...at, row: "9.810 ± 0.050 m", copy: "9.81 ± 0.05 m", head: "9.810 ± 0.050" })).toEqual(["copy"]);
    expect(checks({ ...at, row: "9.810 ± 0.050 m", head: "9.810 ± 0.05" })).toEqual(["same"]);
  });

  it("controls: a zero padded after a value cut at σ, a value at its confirmed digits above σ, a zero value", () => {
    expect(checks({ value: dec("-0.000338"), sigma: dec("0.00027"), unit: "", row: "-340E-6 ± 270E-6", head: "-340E-6 ± 270E-6" })).toEqual([]);
    expect(checks({ value: dec("314159265358979323846.264"), sigma: dec("3"), reliable: 22, row: "314159265358979323846.3 ± 3.0 m", head: "314159265358979323846.3 ± 3.0" })).toEqual([]);
    expect(checks({ value: dec("3"), sigma: dec("111.8"), row: "3 ± 110 m", head: "0 ± 110" })).toEqual([]);
    // and a wrong digit is still a failure
    expect(checks({ value: dec("-0.000338"), sigma: dec("0.00027"), unit: "", row: "-330E-6 ± 270E-6", head: "-340E-6 ± 270E-6" })).toEqual(["value"]);
  });

  it("reads the forms the screen draws", () => {
    expect(readNumber(`4.70${ts}k`)).toEqual({ int: 470n, last: 1, form: "p:k", decimals: 2 });
    expect(readNumber("0.000090E14")).toEqual({ int: 90n, last: 8, form: "E14", decimals: 6 });
    expect(readNumber("−3")).toEqual({ int: -3n, last: 0, form: "", decimals: 0 });
    expect(placeOf(readNumber("150000")!, dec("151180"))).toBe(4);
    expect(placeOf(readNumber("160000")!, dec("151180"))).toBeNull();
    expect(placeOf(readNumber("150.0")!, dec("151.18"))).toBeNull();
  });
});

describe("the σ oracle and the round trip (G800)", () => {
  it("the GUM with G41's second order: units.yaml g01 (product), g03 (quotient), g04 (power)", () => {
    const g01 = sigmaOracle({ kind: "product", a: { x: 12.34, s: 0.05 }, b: { x: 3.2, s: 0.1 } });
    expect(g01.rel * 12.34 * 3.2).toBeCloseTo(Math.sqrt((3.2 * 0.05) ** 2 + (12.34 * 0.1) ** 2 + 0.05 ** 2 * 0.1 ** 2), 12);
    expect((g01.rel * 12.34 * 3.2).toPrecision(2)).toBe("1.2");
    expect((sigmaOracle({ kind: "quotient", a: { x: 10, s: 0.2 }, b: { x: 4, s: 0.1 } }).rel * 2.5).toPrecision(2)).toBe("0.080");
    expect(sigmaOracle({ kind: "power", a: { x: 2, s: 0.1 }, n: 3 }).rel * 8).toBeCloseTo(Math.sqrt(1.4544), 12);
  });

  it("σ's ⚠: a singular point first, else the second order over 10 % of σ²", () => {
    const q = sigmaOracle({ kind: "quotient", a: { x: 10, s: 2 }, b: { x: 4, s: 1 } });
    expect(q.share).toBeGreaterThan(0.1);
    expect(sigmaCheck(q, { rel: q.rel, why: "order2" })).toEqual([]);
    expect(sigmaCheck(q, { rel: q.rel }).map((f) => f.check)).toEqual(["sigmawarn"]);
    const s = sigmaOracle({ kind: "power", a: { x: 0.3, s: 0.2 }, n: -1 });
    expect(sigmaCheck(s, { rel: s.rel, why: "order2" }).map((f) => f.check)).toEqual(["sigmawarn"]);
    expect(sigmaCheck(s, { rel: s.rel * (1 + 1e-6), why: "singular" }).map((f) => f.check)).toEqual(["sigma1"]);
  });

  it("the trip: the same text both ways, σ scaled like the value", () => {
    expect(tripCheck({ from: "12.50 ± 0.50", back: "12.50 ± 0.50", relFrom: 0.04, relThere: 0.04 })).toEqual([]);
    expect(tripCheck({ from: "12.50 ± 0.50", back: "12.5 ± 0.50", relFrom: 0.04, relThere: 0.04004 }).map((f) => f.check)).toEqual(["trip", "tripsigma"]);
  });
});

const indexFile = `${root}app/src/find/_gen/find-index.json`;
const indexItems = ((): IndexItem[] | null => {
  try {
    return JSON.parse(readFileSync(indexFile, "utf8")) as IndexItem[];
  } catch {
    return null;
  }
})();

describe.skipIf(!giacAvailable() || !indexItems)("the unit sweep on the hunt's inputs (G800, real Giac)", () => {
  let host: EngineHost;
  let table: FactorTable;
  beforeAll(async () => {
    host = await freshHost();
    table = factorTable(indexItems!);
    await loadTidy();
  });
  const q = (input: string, digits = 12): Quantity => {
    const job = buildJob(requestOf(input, undefined, table), table);
    const r = isUnitError(job) ? job : host.units(job, { ...defaultHomeSettings, digits });
    if (isUnitError(r)) throw new Error(JSON.stringify(r));
    return r;
  };
  const drawn = (input: string, format: "std" | "sci" | "eng" | "pfx", digits = 12): string[] => {
    const r = q(input, digits);
    const row = rowOf(r, format, digits);
    const h = shownOf(r, { format: format.toUpperCase() as "STD", digits }) as UnitShown;
    return drawingCheck({ value: r.value.value!.re, sigma: r.unc!.value.value!.re, reliable: r.value.facts.reliableDigits ?? null, row: row.text, unit: r.unit, copy: row.copy, head: h.text, viewWarn: h.warn }).map((f) => `${f.check}: ${f.detail}`);
  };

  it.each([
    ["pasupm(1234567890.12345,0.0001)*{m}", "std"],
    ["pasupm(4.7,0.1)*10^3*{m}", "pfx"],
    ["pasupm(9.81,0.05)*10^(-6)*{m}", "pfx"],
    ["ln(pasupm(1,0.5))", "std"],
    ["pasupm(2.5,0.1)*{k:m / h}*{=c}", "eng"],
    ["pasupm(9.81,0.05)*{m}", "sci"],
  ] as const)("%s in %s: the row, the headline and Copy draw by the one rule", (input, format) => {
    expect(drawn(input, format)).toEqual([]);
  });

  it("the hunt's ln(1 ± 0.5): the view's ⚠ is in the row", () => {
    const r = q("ln(pasupm(1,0.5))");
    expect(rowOf(r, "std", 12).text).toBe("0.00 ± ⚠0.64");
  });

  it("twenty cases of the gate's seed fail only as the known file says (F490: σ below 1E-154)", async () => {
    const cases = generateUnitCases(20261123, 20, poolsOf(indexItems!));
    const r = await unitSweep(cases, table, host);
    const known = new Set(loadUnitKnown(root).map((k) => `${k.id} ${k.check}`));
    expect(r.failures.filter((f) => !known.has(`${f.id} ${f.check}`))).toEqual([]);
    expect(r.failures.map((f) => f.check).sort()).toEqual(["sigma1", "sigmawarn"]);
    expect(r.runs).toBeGreaterThan(60);
  });
});
