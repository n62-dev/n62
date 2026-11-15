// SPDX-License-Identifier: GPL-3.0-or-later
// G234: the units of your own (G233) are kept in the stamped store under `units.own` (`{ units: [{ name, factor, of }] }`),
// are in the backup with a restore that checks their shape, are Find's items of kind unit, and a definition that is gone
// (deleted) leaves a unit slot readable: a refusal in words. Expected values are derived: 201.168 m = 25146/125 m, so
// 5 of it is 25146/25 m = 1005.84 m (G233's tests); the stored text is exactly what the user typed with a point.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultHomeSettings } from "../engine/homeDefaults.ts";
import type { MathEngine } from "../engine/types.ts";
import { search } from "../find/rank.ts";
import { ownUnitItem } from "../find/names.svelte.ts";
import type { IndexItem } from "../find/types.ts";
import { unitText } from "../i18n/enUnits.ts";
import { BACKUP_KEYS, checkBackup, makeBackup, VALIDATORS } from "../state/backup.ts";
import { fakeIndexedDb, type FakeIdb } from "../state/fakeIdb.ts";
import { fakeKv } from "../state/fakeKv.ts";
import { DATA_VERSION, stamp } from "../state/storage.ts";
import { evaluateUnits } from "./calc.ts";
import { unitErrorMessage } from "./messages.ts";
import { OwnUnits, UNITS_OWN } from "./ownUnits.ts";
import type { Quantity, UnitError, UnitJob, UnitSlot } from "./types.ts";
import { clashNote, findClash, findNames, ownToken, type UnitDef } from "./userUnits.ts";

const here = dirname(fileURLToPath(import.meta.url));
const indexFile = join(here, "../find/_gen/find-index.json");
const items: IndexItem[] = existsSync(indexFile) ? (JSON.parse(readFileSync(indexFile, "utf8")) as IndexItem[]) : [];
const hasIndex = items.some((it) => it.kind === "unit");
const it_ = hasIndex || process.env["FIND_INDEX"] === "required" ? it : it.skip;

const M: UnitSlot = { tokens: [{ unit: "m" }] };
const myfurlong: UnitDef = { name: "myfurlong", factor: "201.168", of: M };
const kgfm: UnitDef = { name: "kgfm", factor: "9.80665", of: { tokens: [{ unit: "N" }, { unit: "m" }] } };

/** The store writes after its read has settled, a task later. */
const written = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe("the store of your units (G234)", () => {
  it("keeps a definition under units.own as { units: [...] }, and a relaunch reads it", async () => {
    const kv = fakeKv();
    const own = new OwnUnits(kv);
    await own.restore();
    expect(own.list()).toEqual([]);
    own.add(myfurlong);
    own.add(kgfm);
    await written();
    expect(kv.data.get(UNITS_OWN)).toEqual({ units: [myfurlong, kgfm] });
    expect(UNITS_OWN).toBe("units.own");
    const again = new OwnUnits(kv); // a relaunch: a new store object on the same kv
    expect(again.list()).toEqual([]); // (before the read: none)
    await again.restore();
    expect(again.list()).toEqual([myfurlong, kgfm]);
  });
  it("add, replace by name and remove each write the whole record", async () => {
    const kv = fakeKv();
    const own = new OwnUnits(kv);
    await own.restore();
    own.add(myfurlong);
    own.add(kgfm);
    own.replace("myfurlong", { ...myfurlong, factor: "201.17" });
    expect(own.list().map((d) => d.factor)).toEqual(["201.17", "9.80665"]);
    own.remove("kgfm");
    await written();
    expect(kv.data.get(UNITS_OWN)).toEqual({ units: [{ ...myfurlong, factor: "201.17" }] });
    expect(kv.writes.filter((k) => k === UNITS_OWN)).toHaveLength(4);
  });
  it("a record the start cannot read is no crash: its good definitions stay, the others are dropped, and nothing is written on the read", async () => {
    const kv = fakeKv([[UNITS_OWN, { units: [myfurlong, { name: "", factor: "1", of: M }, { name: "x", factor: "1,5", of: M }, 7, kgfm] }]]);
    const own = new OwnUnits(kv);
    await own.restore();
    expect(own.list()).toEqual([myfurlong, kgfm]);
    expect(kv.writes).toEqual([]);
    for (const bad of [null, 5, "x", [], { units: "no" }, { units: null }]) {
      const o = new OwnUnits(fakeKv([[UNITS_OWN, bad]]));
      await o.restore();
      expect(o.list()).toEqual([]);
    }
  });
  it("the snapshot a caller gets is its own copy: a change to it changes no definition", async () => {
    const own = new OwnUnits(fakeKv());
    own.add(myfurlong);
    const [d] = own.list();
    (d as { factor: string }).factor = "1";
    expect(own.list()[0]?.factor).toBe("201.168");
  });
});

describe("the backup holds units.own (G234)", () => {
  const file = (value: unknown, key = "units.own"): Uint8Array =>
    new TextEncoder().encode(JSON.stringify({ "n62-backup": 1, parts: { [key]: { "@n62": DATA_VERSION, value } } }));
  const refused = (value: unknown): boolean => !checkBackup(file(value)).ok;

  it("units.own is in BACKUP_KEYS, and a backup carries it as stored", async () => {
    expect(BACKUP_KEYS).toContain("units.own");
    const rec = { "@n62": DATA_VERSION, value: { units: [myfurlong] } };
    const b = await makeBackup(async (k) => (k === "units.own" ? rec : undefined), new Date("2026-11-15T12:00:00Z"));
    expect(b.parts["units.own"]).toEqual(rec);
    const back = checkBackup(file(b.parts["units.own"]?.value));
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.parts["units.own"]).toEqual({ units: [myfurlong] });
  });
  it("a restore checks the shape: every good record passes, including an empty list and a prefixed, powered, ÷ slot", () => {
    expect(VALIDATORS["units.own"]?.({ units: [] })).toBe(true);
    expect(VALIDATORS["units.own"]?.({ units: [myfurlong, kgfm] })).toBe(true);
    const slot: UnitSlot = { tokens: [{ prefix: "k", unit: "m", power: "2" }, { unit: "h" }], per: 1 };
    expect(VALIDATORS["units.own"]?.({ units: [{ name: "areaflow", factor: "1.5e-3", of: slot }] })).toBe(true);
    expect(VALIDATORS["units.own"]?.({ units: [{ name: "Ωm", factor: "2", of: M }] })).toBe(true); // a letter of any script
  });
  it("refuses a unit without a name, or with a name that is none", () => {
    expect(refused({ units: [{ factor: "1.5", of: M }] })).toBe(true);
    for (const name of ["", "1m", "my unit", "my-unit", "a".repeat(25), 7, null, "@x"]) expect(refused({ units: [{ name, factor: "1.5", of: M }] }), String(name)).toBe(true);
  });
  it("refuses a factor that is no decimal text with a point (a comma, a number, a sign, nothing, zero, text)", () => {
    for (const factor of ["201,168", "", " 2", "-2", "+2", "1e", ".5", "5.", "1.2.3", "abc", "1e999", "0", "0.0", 201.168, null, undefined])
      expect(refused({ units: [{ name: "x", factor, of: M }] }), String(factor)).toBe(true);
    for (const factor of ["2", "201.168", "1.5e-3", "1E3", "0.001"]) expect(refused({ units: [{ name: "x", factor, of: M }] }), factor).toBe(false);
  });
  it("refuses an `of` that is no UnitSlot", () => {
    const bad: unknown[] = [
      undefined,
      null,
      "m",
      [],
      {},
      { tokens: [] },
      { tokens: "m" },
      { tokens: [{}] },
      { tokens: [{ unit: "" }] },
      { tokens: [{ unit: 5 }] },
      { tokens: [{ unit: "m", prefix: "" }] },
      { tokens: [{ unit: "m", prefix: 3 }] },
      { tokens: [{ unit: "m", power: 2 }] },
      { tokens: [{ unit: "m", power: "x" }] },
      { tokens: [{ unit: "m", power: "0" }] },
      { tokens: [{ unit: "@other" }] }, // built from Find's units, never from another of yours
      { tokens: [{ unit: "m", extra: 1 }] },
      { tokens: [{ unit: "m" }], per: 1 }, // a ÷ with nothing after it
      { tokens: [{ unit: "m" }, { unit: "s" }], per: 0 },
      { tokens: [{ unit: "m" }, { unit: "s" }], per: 1.5 },
      { tokens: [{ unit: "m" }], extra: true },
      { tokens: Array.from({ length: 17 }, () => ({ unit: "m" })) },
    ];
    for (const of of bad) expect(refused({ units: [{ name: "x", factor: "2", of }] }), JSON.stringify(of)).toBe(true);
  });
  it("refuses a field it does not know, at each level, and a record that is no { units: [...] }", () => {
    expect(refused({ units: [{ name: "x", factor: "2", of: M, note: "hi" }] })).toBe(true);
    expect(refused({ units: [myfurlong], extra: 1 })).toBe(true);
    expect(refused({ units: [myfurlong, myfurlong] })).toBe(true); // a name twice: mergedTable would drop both
    for (const v of [null, 5, "x", [], {}, { units: {} }, { units: "x" }, { units: [null] }, { units: [5] }, { units: [[]] }]) expect(refused(v), JSON.stringify(v)).toBe(true);
    expect(checkBackup(file({ units: [] }, "units.own2")).ok).toBe(false); // (only the key it knows)
  });
  it("a record is refused as a part with the part's name", () => {
    const r = checkBackup(file({ units: [{ name: "", factor: "1", of: M }] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.part).toBe("units.own");
  });
});

describe("Find lists an own unit as a unit (G234)", () => {
  it("is a live item of kind unit under the own id, found by its name, with its factor as the line under it", () => {
    const it = ownUnitItem(myfurlong);
    expect(it).toMatchObject({ id: "unit:@myfurlong", kind: "unit", names: ["myfurlong"], title: "myfurlong", tier: 0 });
    expect(it.desc).toContain("201.168");
    const hits = search({ items: [] }, "myfurlong", { live: [ownUnitItem(myfurlong), ownUnitItem(kgfm)] });
    expect(hits.map((h) => h.item.id)).toEqual(["unit:@myfurlong"]);
    expect(hits[0]?.item.kind).toBe("unit");
    expect(search({ items: [] }, "kgf", { live: [ownUnitItem(myfurlong), ownUnitItem(kgfm)], filter: ["unit"] })[0]?.item.id).toBe("unit:@kgfm");
  });
});

describe("a definition that is gone (G234)", () => {
  const engine = { units: () => Promise.reject(new Error("a refused job never reaches the engine")) } as unknown as MathEngine;
  const source = (): Promise<readonly IndexItem[]> => Promise.resolve(items);

  it_("leaves a unit slot readable: a refusal in words that names the unit, never the generic engine message nor a crash", async () => {
    const req = { formula: "5*pasu1", slots: [{ tokens: [ownToken("myfurlong")] }], end: M };
    const r = (await evaluateUnits(engine, source, req, defaultHomeSettings, [])) as UnitError;
    expect(r).toEqual({ error: "own", name: "myfurlong" });
    const words = unitErrorMessage(r);
    expect(words).toContain("myfurlong");
    expect(words).not.toBe(unitText("units.engine"));
    expect(words).toBe(unitText("units.own.gone", { name: "myfurlong" }));
  });
  it_("also as the end slot, in a sum, and with a prefix typed before it", async () => {
    const reqEnd = { formula: "5*pasu1", slots: [M], end: { tokens: [ownToken("myfurlong")] } };
    expect(await evaluateUnits(engine, source, reqEnd, defaultHomeSettings, [])).toEqual({ error: "own", name: "myfurlong" });
    const reqSum = { formula: "pasu1+pasu2", slots: [M, { tokens: [ownToken("myfurlong")] }] };
    expect(await evaluateUnits(engine, source, reqSum, defaultHomeSettings, [])).toEqual({ error: "own", name: "myfurlong" });
    const reqPrefix = { formula: "pasu1", slots: [{ tokens: [ownToken("myfurlong", "k")] }] };
    expect(await evaluateUnits(engine, source, reqPrefix, defaultHomeSettings, [])).toEqual({ error: "own", name: "myfurlong" });
  });
  it_("a unit Find gains with that name does not take the slot over: the stored row still gives the own unit's value", async () => {
    const jobs: UnitJob[] = [];
    const spy = { units: (job: UnitJob) => (jobs.push(job), Promise.resolve({ ms: 0 } as Quantity)) } as unknown as MathEngine;
    const gained: IndexItem = { id: "unit:myfurlong", kind: "unit", names: ["myfurlong"], title: "Other", dim: "s1", si: "7", tier: 0 };
    const more = (): Promise<readonly IndexItem[]> => Promise.resolve([...items, gained]);
    const req = { formula: "5*pasu1", slots: [{ tokens: [ownToken("myfurlong")] }], end: M };
    await evaluateUnits(spy, more, req, defaultHomeSettings, [myfurlong]);
    expect(jobs[0]?.expr).toContain("25146/125");
    expect(jobs[0]?.expr).not.toContain("(7)");
  });
  it_("and the definition says so in Your units: the name is now also Find's (findClash, for R201's list)", () => {
    const gained: IndexItem = { id: "unit:myfurlong", kind: "unit", names: ["myfurlong", "Other unit"], title: "Other", dim: "s1", si: "7", tier: 0 };
    expect(findClash(myfurlong, findNames(items))).toBeUndefined();
    expect(findClash(kgfm, findNames(items))).toBeUndefined();
    expect(findClash(myfurlong, findNames([...items, gained]))).toBe("myfurlong");
    const zzq: IndexItem = { id: "unit:zzq", kind: "unit", names: ["zzq"], title: "Other", dim: "s1", si: "7", tier: 0 };
    expect(findClash({ ...myfurlong, name: "mzzq" }, findNames([...items, zzq]))).toBe("zzq"); // m and zzq read together
    expect(clashNote(myfurlong, findNames(items))).toBeUndefined();
    expect(clashNote(myfurlong, findNames([...items, gained]))).toBe(unitText("units.own.nowFind", { name: "myfurlong", unit: "myfurlong" }));
    expect(clashNote(myfurlong, findNames([...items, gained]))).toContain("also");
  });
});

describe("Calc.units reads the stored definitions (G234)", () => {
  let idb: FakeIdb;
  beforeEach(() => {
    idb = fakeIndexedDb();
    vi.stubGlobal("indexedDB", idb.factory);
    vi.resetModules();
  });
  afterEach(() => vi.unstubAllGlobals());

  it_("a definition stored by one run is in the job of the next one (5 myfurlong → m carries 25146/125), and a run with none refuses in words", async () => {
    const { EngineCalc } = await import("../calc/engine.ts");
    const jobs: UnitJob[] = [];
    const engine = { units: (job: UnitJob) => (jobs.push(job), Promise.resolve({ ms: 0 } as Quantity)) } as unknown as MathEngine;
    const req = { formula: "5*pasu1", slots: [{ tokens: [ownToken("myfurlong")] }], end: M };
    const settings = { digits: 12, angle: "rad", format: "std" } as const;
    const run = new EngineCalc(engine, { findIndex: async () => items });
    expect(await run.units(req, settings)).toEqual({ error: "own", name: "myfurlong" }); // nothing stored yet

    idb.stores.set("kv", new Map([[UNITS_OWN, stamp({ units: [myfurlong] })]])); // what the first run left
    vi.resetModules(); // a relaunch: no module keeps the first run's read
    const { EngineCalc: Next } = await import("../calc/engine.ts");
    await new Next(engine, { findIndex: async () => items }).units(req, settings);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.expr).toContain("25146/125");
  });
});
