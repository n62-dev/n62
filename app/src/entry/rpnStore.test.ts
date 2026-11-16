// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it, vi } from "vitest";
import type { Chip } from "../input/chips.ts";
import { fakeIndexedDb } from "../state/fakeIdb.ts";
import { fakeKv } from "../state/fakeKv.ts";
import { rowUid } from "../state/results.ts";
import type { RpnLevel } from "./rpn.ts";
import { RPN_KEY, readStack, saveStack } from "./rpnStore.ts";

const L = (uid: string, value: string, extra: Partial<Chip> = {}, inputs: string[] = []): RpnLevel => ({
  uid,
  chip: { value, exact: true, ...extra },
  shown: value,
  inputs,
});

describe("the RPN stack is kept across a relaunch (R252)", () => {
  it("a new instance reads the same levels in the same order", async () => {
    const kv = fakeKv();
    const saved = [L("u2", "3"), L("u1", "2")];
    await saveStack(kv, saved);
    expect(kv.writes).toEqual([RPN_KEY]);
    expect(await readStack(kv)).toEqual(saved);
  });
  it("a stored level keeps its uid, and a new row of this run never takes it", async () => {
    const kv = fakeKv();
    const old = `${(Date.now() - 86_400_000).toString(36)}-1`; // a row of an earlier run (G211)
    await saveStack(kv, [L(old, "7")]);
    const back = await readStack(kv);
    expect(back[0]?.uid).toBe(old);
    expect(rowUid(1)).not.toBe(old);
  });
  it("a unit and a σ stay on the level, with the inputs that keep the σ honest (mh-D3)", async () => {
    const kv = fakeKv();
    const level = L(
      "u1",
      "12.5",
      { exact: false, unc: "0.2", unit: { text: "km/h", dim: "m1s-1", slot: { tokens: [{ unit: "km" }, { unit: "h", power: "-1" }] } } },
      ["row:u1"],
    );
    await saveStack(kv, [level]);
    const [back] = await readStack(kv);
    expect(back?.chip.unit?.text).toBe("km/h");
    expect(back?.chip.unc).toBe("0.2");
    expect(back?.inputs).toEqual(["row:u1"]);
    expect(back).toEqual(level);
  });
  it("accepts every key kind in inputs", async () => {
    const kv = fakeKv();
    const level = L("u1", "1.5", { exact: false, unc: "0.1" }, ["const:c", "pasl_leaf", "row:u1"]);
    await saveStack(kv, [level]);
    expect(await readStack(kv)).toEqual([level]);
  });
  it("drops a level whose chip is malformed and keeps the others", async () => {
    const kv = fakeKv([[RPN_KEY, { levels: [{ uid: "a", chip: { value: 1 }, shown: "1", inputs: [] }, L("b", "2"), L("c", "3")] }]]);
    expect((await readStack(kv)).map((l) => l.uid)).toEqual(["b", "c"]);
  });
  it("drops a σ level whose inputs are absent, not an array, or hold a foreign key", async () => {
    const chip = { value: "1.5", exact: false, unc: "0.1" };
    const bad = [
      { uid: "a", chip, shown: "x" },
      { uid: "b", chip, shown: "x", inputs: "row:b" },
      { uid: "c", chip, shown: "x", inputs: ["row:c", "foo"] },
      { uid: "d", chip, shown: "x", inputs: [3] },
      { uid: "e", chip, shown: "x", inputs: ["row:"] },
    ];
    const kv = fakeKv([[RPN_KEY, { levels: [...bad, L("ok", "1.5", { exact: false, unc: "0.1" }, ["row:ok"])] }]]);
    expect((await readStack(kv)).map((l) => l.uid)).toEqual(["ok"]);
  });
  it("drops a level whose uid is not a non-empty string", async () => {
    const kv = fakeKv([[RPN_KEY, { levels: [{ uid: "", chip: { value: "1", exact: true }, shown: "1", inputs: [] }, { chip: { value: "1", exact: true }, shown: "1", inputs: [] }, { uid: 4, chip: { value: "1", exact: true }, shown: "1", inputs: [] }, L("k", "5")] }]]);
    expect((await readStack(kv)).map((l) => l.uid)).toEqual(["k"]);
  });
  it("a stored value that is not an object, or levels that is not an array, reads as an empty stack", async () => {
    for (const v of [3, "x", null, [], { levels: 3 }, { levels: "x" }, {}]) expect(await readStack(fakeKv([[RPN_KEY, v]])), JSON.stringify(v)).toEqual([]);
    expect(await readStack(fakeKv())).toEqual([]);
  });
  it("reads no more levels than the stack holds", async () => {
    const levels = Array.from({ length: 250 }, (_, i) => L(`u${i}`, String(i)));
    const kv = fakeKv([[RPN_KEY, { levels }]]);
    expect((await readStack(kv)).length).toBe(200);
  });
  it("a failed read leaves the store unwritten, and storeHealth says unread (R93, R96)", async () => {
    const idb = fakeIndexedDb();
    vi.stubGlobal("indexedDB", idb.factory);
    vi.stubGlobal("localStorage", { getItem: () => "1", setItem: () => undefined });
    vi.resetModules();
    try {
      const storage = await import("../state/storage.ts");
      const store = await import("./rpnStore.ts");
      await storage.kvSet("seed", 0); // makes the store
      idb.stores.get("kv")?.set(store.RPN_KEY, storage.stamp({ levels: [L("u1", "1")] }));
      idb.failGets.add(store.RPN_KEY);
      expect(await store.readStack(storage.idbKv)).toEqual([]);
      expect(storage.storeHealth()).toBe("unread");
      await store.saveStack(storage.idbKv, [L("u9", "9")]);
      expect(idb.stores.get("kv")?.get(store.RPN_KEY)).toEqual(storage.stamp({ levels: [L("u1", "1")] })); // the record is still there
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
