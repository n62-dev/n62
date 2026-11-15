// SPDX-License-Identifier: GPL-3.0-or-later
// G233: a unit of your own, built from Find's units (units/userUnits.ts): a definition `{ name, factor, of }` is one more
// row of the factor table, under the id OWN_PREFIX + name, never its bare name (a unit Find gains later under that name
// never takes it over). Expected values are derived: 201.168 m = 201168/1000 m = 25146/125 m; 5 × 25146/125 = 25146/25 =
// 1005.84; 9.80665 N·m = 196133/20000 kg·m²/s². The golden units stage evaluates the same definitions on Giac (g233 rows).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { IndexItem } from "../find/types.ts";
import type { MathEngine } from "../engine/types.ts";
import { defaultHomeSettings } from "../engine/homeDefaults.ts";
import { buildJob } from "./build.ts";
import { evaluateUnits } from "./calc.ts";
import { factorTable } from "./factors.ts";
import type { Quantity, UnitError, UnitJob, UnitSlot } from "./types.ts";
import { checkDef, factorText, findNames, isOwnId, mergedTable, ownId, ownToken, OWN_PREFIX, validateDef, type UnitDef } from "./userUnits.ts";

const here = dirname(fileURLToPath(import.meta.url));
const indexFile = join(here, "../find/_gen/find-index.json");
const items: IndexItem[] = existsSync(indexFile) ? (JSON.parse(readFileSync(indexFile, "utf8")) as IndexItem[]) : [];
const hasIndex = items.some((it) => it.kind === "unit");
const it_ = hasIndex || process.env["FIND_INDEX"] === "required" ? it : it.skip;
const table = factorTable(items);
const names = findNames(items);

const M: UnitSlot = { tokens: [{ unit: "m" }] };
const NM: UnitSlot = { tokens: [{ unit: "N" }, { unit: "m" }] };
/** Find's furlong is `fur` (names fur, furlong): the package's example name clashes, so the own unit is myfurlong. */
const myfurlong: UnitDef = { name: "myfurlong", factor: "201.168", of: M };
const kgfm: UnitDef = { name: "kgfm", factor: "9.80665", of: NM };

/** The refusal's message key, or "ok". */
const why = (r: { ok: true } | { ok: false; key: string }): string => (r.ok ? "ok" : r.key);

describe("the id of a unit of your own (G233)", () => {
  it("is the name after a prefix of its own", () => {
    expect(OWN_PREFIX).toBe("@");
    expect(ownId("myfurlong")).toBe("@myfurlong");
    expect(isOwnId("@myfurlong")).toBe(true);
    expect(isOwnId("myfurlong")).toBe(false);
    expect(ownToken("myfurlong")).toEqual({ unit: "@myfurlong" });
    expect(ownToken("myfurlong", "k")).toEqual({ prefix: "k", unit: "@myfurlong" });
  });
  it_("no Find unit, prefix or constant id starts with the prefix (the index pins it)", () => {
    const ids = items.filter((i) => i.kind === "unit" || i.kind === "pfx" || i.kind === "const").map((i) => i.id.slice(i.id.indexOf(":") + 1));
    expect(ids.length).toBeGreaterThan(400);
    expect(ids.filter((id) => id.startsWith(OWN_PREFIX))).toEqual([]);
    // nor does any name Find reads: a typed name never reaches an own id by itself
    expect([...names.units.keys(), ...names.prefixes.keys()].filter((n) => n.startsWith(OWN_PREFIX))).toEqual([]);
  });
});

describe("the merged table (G233)", () => {
  it_("a definition of m: m's dimension, the exact SI factor 25146/125, under its prefixed id only", () => {
    expect(why(validateDef(myfurlong, table, names))).toBe("ok");
    const t = mergedTable(table, [myfurlong]);
    expect(t.units.get("@myfurlong")).toEqual({ si: "25146/125", dim: "m1", symbol: "myfurlong" });
    expect(t.units.has("myfurlong")).toBe(false);
    expect(t.units.get("m")).toEqual(table.units.get("m"));
    expect(table.units.has("@myfurlong")).toBe(false); // Find's table is left as it was
  });
  it_("of N·m: a compound, its dimension the sum of N's and m's", () => {
    expect(why(validateDef(kgfm, table, names))).toBe("ok");
    expect(mergedTable(table, [kgfm]).units.get("@kgfm")).toEqual({ si: "196133/20000", dim: "kg1m2s-2", symbol: "kgfm" });
  });
  it_("of a prefix, a power and a ÷: the factor takes them all", () => {
    // 2 km²/h = 2·10⁶/3600 m²/s = 5000/9 m²/s
    const d: UnitDef = { name: "areaflow", factor: "2", of: { tokens: [{ prefix: "k", unit: "m", power: "2" }, { unit: "h" }], per: 1 } };
    expect(why(validateDef(d, table, names))).toBe("ok");
    expect(mergedTable(table, [d]).units.get("@areaflow")).toEqual({ si: "5000/9", dim: "m2s-1", symbol: "areaflow" });
  });
  it_("a half power keeps its exact factor as Giac text", () => {
    const d: UnitDef = { name: "rootm", factor: "2", of: { tokens: [{ unit: "m", power: "1/2" }] } };
    const u = mergedTable(table, [d]).units.get("@rootm");
    expect(u?.dim).toBe("m1/2");
    expect(u?.si).toBeDefined();
    expect(u?.si).not.toContain("+"); // (an offset would read as K = a·x + b)
  });
  it_("5 myfurlong → m is 1005.84 exactly: the job carries 25146/125 and nothing rounded", () => {
    const t = mergedTable(table, [myfurlong]);
    const job = buildJob({ formula: "5*pasu1", slots: [{ tokens: [ownToken("myfurlong")] }], end: M }, t);
    expect("error" in job).toBe(false);
    if ("error" in job) return;
    expect(job.expr).toContain("25146/125");
    expect(job.endUnit).toBe("m");
    const [n, d] = t.units.get("@myfurlong")!.si!.split("/").map(BigInt) as [bigint, bigint];
    expect(5n * n * 25n).toBe(25146n * d); // 5 · 25146/125 = 25146/25
    expect(25146 / 25).toBe(1005.84);
  });
  it_("Calc.units() builds the job with the definitions given (units/calc.ts), and without them refuses the id", async () => {
    const jobs: UnitJob[] = [];
    const engine = { units: (job: UnitJob) => (jobs.push(job), Promise.resolve({ ms: 0 } as Quantity)) } as unknown as MathEngine;
    const source = (): Promise<readonly IndexItem[]> => Promise.resolve(items);
    const req = { formula: "5*pasu1", slots: [{ tokens: [ownToken("myfurlong")] }], end: M };
    await evaluateUnits(engine, source, req, defaultHomeSettings, [myfurlong]);
    expect(jobs[0]?.expr).toContain("25146/125");
    const none = (await evaluateUnits(engine, source, req, defaultHomeSettings, [])) as UnitError;
    expect(none).toEqual({ error: "own", name: "myfurlong" }); // G234: a refusal that names it (ownStore.test.ts)
    expect(jobs).toHaveLength(1);
  });
  it_("an own unit whose name holds rev, rpm or Hz is no cycle unit: 2 brevet·rad → J drops the rad as N·m does (G40)", () => {
    // audit, fix round 1: hasCycles read the id `@brevet` as rev, set cycles, and the rad was never dropped
    const brevet: UnitDef = { name: "brevet", factor: "1", of: NM };
    expect(why(validateDef(brevet, table, names))).toBe("ok");
    const t = mergedTable(table, [brevet]);
    const J: UnitSlot = { tokens: [{ unit: "J" }] };
    const rad: UnitSlot = { tokens: [{ unit: "rad" }] };
    const own = buildJob({ formula: "2*pasu1*pasu2", slots: [{ tokens: [ownToken("brevet")] }, rad], end: J }, t);
    const find = buildJob({ formula: "2*pasu1*pasu2", slots: [NM, rad], end: J }, t);
    expect("error" in own || "error" in find).toBe(false);
    if ("error" in own || "error" in find) return;
    expect(find.cycles).toBeUndefined();
    expect(own.cycles).toBeUndefined();
    // a Find cycle unit still sets it
    const rpm = buildJob({ formula: "2*pasu1*pasu2", slots: [{ tokens: [{ unit: "rpm" }] }, { tokens: [{ unit: "m" }] }] }, t);
    expect("error" in rpm ? undefined : rpm.cycles).toBe(true);
  });
  it_("a stored definition keeps its value when Find gains its name (the merge checks no clash)", () => {
    const gained = factorTable([...items, { id: "unit:myfurlong", kind: "unit", names: ["myfurlong"], title: "Other", dim: "s1", si: "7" } as IndexItem]);
    const t = mergedTable(gained, [myfurlong]);
    expect(t.units.get("@myfurlong")?.si).toBe("25146/125");
    expect(t.units.get("myfurlong")?.si).toBe("7");
  });
  it_("a definition that does not hold is left out of the merge, never half read", () => {
    const t = mergedTable(table, [{ ...myfurlong, factor: "0" }, { name: "bad", factor: "1", of: { tokens: [{ unit: "nosuchunit" }] } }]);
    expect(t.units.has("@myfurlong")).toBe(false);
    expect(t.units.has("@bad")).toBe(false);
  });
});

describe("a definition refused (G233)", () => {
  it_("a name Find has (furlong is Find's fur) or that reads as a prefix and a Find unit", () => {
    expect(why(validateDef({ name: "furlong", factor: "201.168", of: M }, table, names))).toBe("units.own.clash");
    expect(why(validateDef({ name: "m", factor: "1", of: M }, table, names))).toBe("units.own.clash");
    expect(why(validateDef({ name: "k", factor: "1", of: M }, table, names))).toBe("units.own.clash");
    expect(why(validateDef({ name: "Mm", factor: "1", of: M }, table, names))).toBe("units.own.pair");
    expect(why(validateDef({ name: "kilofurlong", factor: "1", of: M }, table, names))).toBe("units.own.pair");
    const r = validateDef({ name: "furlong", factor: "201.168", of: M }, table, names);
    expect(r.ok ? "" : r.message).toBe("Find already has furlong (fur)");
    const pair = validateDef({ name: "Mm", factor: "1", of: M }, table, names);
    expect(pair.ok ? "" : pair.message).toBe("Mm reads as M and m in Find");
  });
  it_("a name already among your own units", () => {
    expect(why(validateDef(myfurlong, table, names, [myfurlong]))).toBe("units.own.twice");
  });
  it_("a name that is no name (empty, a space, a sign, a digit first, too long)", () => {
    for (const name of ["", "my unit", "a/b", "2x", "x".repeat(25), "@x"]) expect(why(validateDef({ ...myfurlong, name }, table, names))).toBe("units.own.name");
  });
  it_("`of` a unit Find does not have, an empty `of`, or `of` your own unit", () => {
    expect(why(validateDef({ ...myfurlong, of: { tokens: [{ unit: "nosuchunit" }] } }, table, names))).toBe("units.own.unknown");
    expect(why(validateDef({ ...myfurlong, of: { tokens: [{ prefix: "q", unit: "m" }, { unit: "m" }] } }, table, names))).toBe("ok");
    expect(why(validateDef({ ...myfurlong, of: { tokens: [{ prefix: "nope", unit: "m" }] } }, table, names))).toBe("units.own.unknown");
    expect(why(validateDef({ ...myfurlong, of: { tokens: [] } }, table, names))).toBe("units.own.ofEmpty");
    expect(why(validateDef({ ...myfurlong, of: { tokens: [ownToken("kgfm")] } }, table, names))).toBe("units.own.ofOwn");
  });
  it_("`of` a unit with rules of its own: an offset (°C), a level (dB), turns (rpm, Hz), a kind of power (VA), no factor", () => {
    for (const unit of ["oC", "oF", "dB", "dBm", "Np", "rpm", "rev", "Hz", "VA", "kvar"]) {
      expect(table.units.has(unit), unit).toBe(true);
      expect(why(validateDef({ ...myfurlong, of: { tokens: [{ unit }] } }, table, names)), unit).toBe("units.own.ofKind");
    }
    const none = [...table.units].find(([, u]) => u.si === undefined)?.[0];
    expect(none).toBeDefined();
    expect(why(validateDef({ ...myfurlong, of: { tokens: [{ unit: none! }] } }, table, names))).toBe("units.own.ofKind");
  });
  it_("`of` a malformed slot (a bad power or ÷ place)", () => {
    expect(why(checkDef({ ...myfurlong, of: { tokens: [{ unit: "m", power: "x" }] } }, table))).toBe("units.own.ofEmpty");
    expect(why(checkDef({ ...myfurlong, of: { tokens: [{ unit: "m" }], per: 1 } }, table))).toBe("units.own.ofEmpty");
  });
  it_("a factor of 0, or no positive number", () => {
    for (const factor of ["0", "0.000", "0e5"]) expect(why(validateDef({ ...myfurlong, factor }, table, names)), factor).toBe("units.own.zero");
    for (const factor of ["", "-1", "1/3", "pi", "1e", "1.", ".5", "1e999", " 1", "1 000"]) expect(why(validateDef({ ...myfurlong, factor }, table, names)), factor).toBe("units.own.factor");
    expect(why(validateDef({ ...myfurlong, factor: "1.5e-3" }, table, names))).toBe("ok");
    expect(mergedTable(table, [{ ...myfurlong, factor: "1.5e-3" }]).units.get("@myfurlong")?.si).toBe("3/2000");
  });
  it_("a factor with a comma is never stored as typed", () => {
    expect(why(validateDef({ ...myfurlong, factor: "201,168" }, table, names))).toBe("units.own.factor");
    expect(mergedTable(table, [{ ...myfurlong, factor: "201,168" }]).units.has("@myfurlong")).toBe(false);
  });
});

describe("the factor as typed (G233): stored with a point, whatever the decimal mark", () => {
  it("the comma mark: 201,168 is 201.168", () => {
    expect(factorText("201,168", "comma")).toEqual({ ok: true, text: "201.168" });
    expect(factorText(" 2,5E-3 ", "comma")).toEqual({ ok: true, text: "2.5E-3" });
  });
  it("the point mark: 201.168 as it is, and a comma is refused (never read as a group separator)", () => {
    expect(factorText("201.168", "point")).toEqual({ ok: true, text: "201.168" });
    expect(why(factorText("201,168", "point"))).toBe("units.own.factor");
  });
  it("the other mark is refused in either setting (1.000,5 is no number we guess at)", () => {
    expect(why(factorText("201.168", "comma"))).toBe("units.own.factor");
    expect(why(factorText("1.000,5", "comma"))).toBe("units.own.factor");
    expect(why(factorText("0", "point"))).toBe("units.own.zero");
  });
});

it("finds the full generated index (otherwise the definition tests were skipped)", () => {
  if (hasIndex) return;
  const msg = "app/src/find/_gen/find-index.json is missing or holds functions only; run npm run index";
  if (process.env["FIND_INDEX"] === "required") expect.fail(msg);
  console.warn(`userUnits.test: ${msg}; the tests were skipped`);
});
