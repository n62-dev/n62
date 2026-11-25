// SPDX-License-Identifier: GPL-3.0-or-later
// G801: a constant's own unit (find/units.yaml constants.ownUnit, NIST's CODATA unit column as Find ids; the index's
// `ownUnit`) is the unit view's result unit without an end slot, after a named or single-base SI unit and before the base
// form: h is J·s, not kg·m²/s. The value path is unchanged (factor exactly 1). On the real Find index and the real
// engine (skipped without them, unless FIND_INDEX=required or ENGINE=required).
// Values: CODATA 2022 and the exact 2019 SI (find/units.yaml checks); the rounded ones from mpmath (`source: oracle`).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "../engine/host.ts";
import { defaultHomeSettings, precisionFacts } from "../engine/homeEval.ts";
import { markOf } from "../engine/format.ts";
import { giacAvailable, loadNodeGiac } from "../engine/nodeGiac.ts";
import type { IndexItem } from "../find/types.ts";
import { requestOf } from "../../scripts/unit-case.ts";
import { alternatives } from "./alternatives.ts";
import { buildJob } from "./build.ts";
import { parseDimKey, BASES, dimKeyOf } from "./dims.ts";
import { factorTable } from "./factors.ts";
import { isUnitError, type Quantity, type UnitError } from "./types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const indexFile = join(here, "../find/_gen/find-index.json");
const items: IndexItem[] = existsSync(indexFile) ? (JSON.parse(readFileSync(indexFile, "utf8")) as IndexItem[]) : [];
const hasIndex = items.some((i) => i.kind === "const") || process.env["FIND_INDEX"] === "required";
const table = factorTable(items);
const yamlOwn = ((parse(readFileSync(join(here, "../../../find/units.yaml"), "utf8")) as { constants: { ownUnit?: Record<string, string> } }).constants.ownUnit ?? {});

interface Want {
  id: string;
  input: string;
  unit: string;
  /** The value at 12 digits (STD) and its mark; absent: not checked here. */
  expect?: string;
  mark?: "=" | "≈";
  unc?: string;
  source: "derived" | "oracle" | "reference";
}

const CASES: Want[] = [
  { id: "h", input: "{=planck}", unit: "J·s", expect: "6.62607015E-34", mark: "=", source: "derived" },
  // mpmath: 6.62607015e-34/(2*pi) = 1.0545718176461563912e-34
  { id: "hbar-typed", input: "{=planck}/(2*pi)", unit: "J·s", expect: "1.05457181765E-34", mark: "≈", source: "oracle" },
  { id: "hbar", input: "{=planck2pi}", unit: "J·s", source: "derived" },
  // mpmath: 6.62607015e-34*299792458 = 1.9864458571489287e-25
  { id: "hc", input: "{=planck}*{=c}", unit: "J·m", expect: "1.98644585715E-25", mark: "≈", source: "oracle" },
  { id: "hc/c", input: "{=planck}*{=c}/{=c}", unit: "J·s", expect: "6.62607015E-34", mark: "=", source: "derived" },
  // c·c has no named unit: the base form (Gy and Sv share its dimension, but are no unit of a speed squared)
  { id: "cc", input: "{=c}*{=c}", unit: "m²/s²", source: "derived" },
  { id: "kB", input: "{=k_B}", unit: "J/K", expect: "1.380649E-23", mark: "=", source: "derived" },
  // CODATA 2022: 1.256 637 061 27(20) e-6 N A^-2
  { id: "mu0", input: "{=mu_0}", unit: "N/A²", expect: "1.25663706127E-6", mark: "≈", unc: "2.0E-16", source: "reference" },
  { id: "eps0", input: "{=epsilon_0}", unit: "F/m", source: "reference" },
  { id: "R", input: "{=gas_constant}", unit: "J/(mol·K)", source: "reference" },
  { id: "sigma", input: "{=sigma}", unit: "W/(m²·K⁴)", source: "reference" },
  // unchanged: a named SI unit comes first (h·5 Hz = 3.313035075E-33 J, 3 K·k_B = 4.141947E-23 J, exact)
  { id: "h5Hz", input: "{=planck}*5*{Hz}", unit: "J", expect: "3.313035075E-33", mark: "=", source: "derived" },
  { id: "3KkB", input: "3*{K}*{=k_B}", unit: "J", expect: "4.141947E-23", mark: "=", source: "derived" },
  { id: "qe", input: "{=q_e}", unit: "C", source: "derived" },
  // h/c fits no constant's own unit: the base form
  { id: "h/c", input: "{=planck}/{=c}", unit: "kg·m", source: "derived" },
  { id: "alpha", input: "{=alpha}", unit: "", source: "derived" },
  // the product of several constants' units only when shorter than the base form: R·T/p is m³/mol, not J/(mol·Pa)
  { id: "RT/p", input: "{=gas_constant}*{=StdT}/{=StdP}", unit: "m³/mol", source: "derived" },
];

describe.skipIf(!hasIndex)("G801: the index's own units", () => {
  it("find/units.yaml lists about 25 constants, each one the index carries as ownUnit", () => {
    const own = Object.fromEntries(items.filter((i) => i.kind === "const" && i.ownUnit !== undefined).map((i) => [i.id.slice(6), i.ownUnit!]));
    expect(Object.keys(yamlOwn).length).toBeGreaterThan(20);
    expect(own).toEqual(Object.fromEntries(Object.entries(yamlOwn).map(([k, v]) => [k, v.trim().split(/\s+/).join("*")])));
    expect(own["planck"]).toBe("J*s");
  });
  it("every ownUnit is Find unit ids of factor exactly 1 whose dimension is the constant's, and differs from the base form", () => {
    for (const c of items.filter((i) => i.kind === "const" && i.ownUnit !== undefined)) {
      const exps = new Map<string, number>();
      for (const part of c.ownUnit!.split("*")) {
        const m = /^([A-Za-z_]+)(?:\^(-?\d+))?$/.exec(part);
        expect(m, `${c.id}: ${part}`).not.toBeNull();
        const u = table.units.get(m![1]!);
        expect(u?.si, `${c.id}: ${m![1]} factor`).toBe("1");
        for (const [b, e] of parseDimKey(u!.dim!)) exps.set(b, (exps.get(b) ?? 0) + Number(e) * Number(m![2] ?? "1"));
      }
      expect(`${c.id} ${dimKeyOf(BASES.map((b) => `${exps.get(b.key) ?? 0}`))}`).toBe(`${c.id} ${c.dim}`);
      expect(c.ownUnit).not.toBe(c.unit);
    }
  });
});

describe.skipIf(!hasIndex || !giacAvailable())("G801: a constant's own unit is the result's unit (real engine)", () => {
  let host: EngineHost;
  beforeAll(async () => {
    const L = await loadNodeGiac();
    host = new EngineHost(L.giac, L.bridge);
  });
  const run = (input: string): Quantity | UnitError => {
    const job = buildJob(requestOf(input, undefined, table), table);
    return isUnitError(job) ? job : host.units(job, defaultHomeSettings);
  };
  for (const c of CASES) {
    it(`${c.id}: ${c.input} is shown in ${c.unit || "no unit"} (${c.source})`, () => {
      const q = run(c.input);
      if (isUnitError(q)) throw new Error(JSON.stringify(q));
      expect(q.unit).toBe(c.unit);
      if (c.expect !== undefined) {
        expect(q.value.display).toBe(c.expect);
        expect(markOf(precisionFacts(q.value), { format: "STD", digits: 12 })?.mark).toBe(c.mark);
      }
      if (c.unc !== undefined) expect(q.unc?.text).toBe(c.unc);
    });
  }
  it("h + 1 is refused: a constant's own unit changes no dimension check", () => {
    const q = run("{=planck}+1");
    expect(isUnitError(q) && q.error).toBe("dimension");
  });
  it("the alternatives row of h holds the base SI form kg·m²/s", () => {
    const req = requestOf("{=planck}", undefined, table);
    const q = run("{=planck}");
    if (isUnitError(q)) throw new Error(JSON.stringify(q));
    const texts = alternatives(q, { table, pad: [], user: [], req }).map((a) => a.text);
    expect(texts).toContain("kg·m²/s");
    expect(texts).not.toContain("J·s");
  });
  it("a typed unit that fits is shown, and the row offers the constant's own unit beside it", () => {
    const input = "{=planck}+1*{N m s}";
    const q = run(input);
    if (isUnitError(q)) throw new Error(JSON.stringify(q));
    expect(q.unit).toBe("N·m·s");
    const texts = alternatives(q, { table, pad: [], user: [], req: requestOf(input, undefined, table) }).map((a) => a.text);
    expect(texts).toContain("J·s");
  });
});
