// SPDX-License-Identifier: GPL-3.0-or-later
// R194 (docs/04 5.4, 6.2): the word size and sign are one stamped record under the key `word`, `{ bits, signed }`, in the
// backup with a validator that takes only those values; the calc reads it (EngineCalc, lazily) and sends it to the engine
// only when it was set (the default, 64 bits unsigned, is the engine's own).
import { describe, expect, it } from "vitest";
import { BACKUP_KEYS, checkBackup, VALIDATORS, type CheckedBackup, type RefusedBackup } from "./backup.ts";
import { EngineCalc } from "../calc/engine.ts";
import type { HomeSettings, MathEngine } from "../engine/types.ts";
import { DATA_VERSION } from "./storage.ts";
import { fakeKv } from "./fakeKv.ts";
import { validWord, WORD_KEY } from "./wordSetting.ts";
import { WordStore, wordStore } from "./wordStore.svelte.ts";

const at = (value: unknown): { "@n62": number; value: unknown } => ({ "@n62": DATA_VERSION, value });
const file = (word: unknown): Uint8Array =>
  new TextEncoder().encode(JSON.stringify({ "n62-backup": 1, dataVersion: DATA_VERSION, made: "2026-11-13T12:00:00.000Z", parts: { word: at(word) } }));

describe("the key `word` (R194)", () => {
  it("is in BACKUP_KEYS and has a validator", () => {
    expect(WORD_KEY).toBe("word");
    expect(BACKUP_KEYS).toContain("word");
    expect(VALIDATORS["word"]).toBeTypeOf("function");
  });

  it("checkBackup takes { bits: 16, signed: true } and each size and sign", () => {
    const r = checkBackup(file({ bits: 16, signed: true })) as CheckedBackup;
    expect(r.ok).toBe(true);
    expect(r.parts["word"]).toEqual({ bits: 16, signed: true });
    for (const bits of [8, 16, 32, 64]) for (const signed of [true, false]) expect(checkBackup(file({ bits, signed })).ok, `${bits} ${signed}`).toBe(true);
  });

  it("checkBackup refuses a bits of 12, a signed that is no boolean and a field it does not know", () => {
    for (const bad of [{ bits: 12, signed: true }, { bits: "16", signed: true }, { bits: 16, signed: "yes" }, { bits: 16, signed: 1 }, { bits: 16, signed: true, extra: 1 }, { bits: 16 }, { signed: true }, 16, null, []]) {
      const r = checkBackup(file(bad)) as RefusedBackup;
      expect(r.ok, JSON.stringify(bad)).toBe(false);
      expect(r.part, JSON.stringify(bad)).toBe("word");
    }
  });

  it("validWord and the backup's `word` check agree on one table of good and bad records", () => {
    const good = [{ bits: 8, signed: false }, { bits: 16, signed: true }, { bits: 32, signed: false }, { bits: 64, signed: true }];
    const bad = [{ bits: 12, signed: true }, { bits: "16", signed: true }, { bits: 16, signed: "yes" }, { bits: 16, signed: 1 }, { bits: 16, signed: true, extra: 1 }, { bits: 16 }, { signed: true }, { bits: 16, signed: true, bits2: 8 }, 16, "word", null, undefined, true, []];
    for (const v of [...good, ...bad]) {
      expect(VALIDATORS["word"]?.(v), JSON.stringify(v)).toBe(validWord(v) !== undefined);
      if (v !== undefined) expect(checkBackup(file(v)).ok, JSON.stringify(v)).toBe(validWord(v) !== undefined);
    }
    expect(good.every((v) => validWord(v) !== undefined)).toBe(true);
    expect(bad.every((v) => validWord(v) === undefined)).toBe(true);
  });

  it("validWord keeps a whole record and nothing else", () => {
    expect(validWord({ bits: 8, signed: false })).toEqual({ bits: 8, signed: false });
    expect(validWord({ bits: 12, signed: false })).toBeUndefined();
    expect(validWord({ bits: 8, signed: false, x: 1 })).toBeUndefined();
    expect(validWord(undefined)).toBeUndefined();
  });
});

describe("the word store (R194)", () => {
  it("reads the stored record once, and a record that is not whole is as none", async () => {
    const whole = new WordStore(fakeKv([["word", { bits: 8, signed: true }]]));
    expect(whole.value).toBeUndefined(); // nothing until it is read
    await whole.restore();
    expect(whole.value).toEqual({ bits: 8, signed: true });
    for (const bad of [{ bits: 12, signed: true }, { bits: 8 }, { bits: 8, signed: true, x: 1 }, 8]) {
      const s = new WordStore(fakeKv([["word", bad]]));
      await s.restore();
      expect(s.value, JSON.stringify(bad)).toBeUndefined();
    }
  });

  it("set keeps the record in the store, and a read still running does not undo it", async () => {
    const kv = fakeKv();
    const s = new WordStore(kv);
    s.set({ bits: 32, signed: true });
    expect(kv.data.get("word")).toEqual({ bits: 32, signed: true });
    await s.restore();
    expect(s.value).toEqual({ bits: 32, signed: true });
  });

  it("a set that came while the read was pending is not undone by the read finishing", async () => {
    const s = new WordStore(fakeKv([["word", { bits: 8, signed: true }]]));
    const read = s.restore();
    s.set({ bits: 16, signed: true });
    await read;
    expect(s.value).toEqual({ bits: 16, signed: true });
    await s.restore();
    expect(s.value).toEqual({ bits: 16, signed: true });
  });

  it("gives the engine's settings the word only once it is set", async () => {
    const s = new WordStore(fakeKv());
    const base = { digits: 9, angle: "deg", format: "std" } as const;
    await s.restore();
    for (const out of [s.home(base), s.cas(base)]) {
      expect(out).toMatchObject({ digits: 9, angle: "deg" });
      expect(out).not.toHaveProperty("word");
      expect(out).not.toHaveProperty("signed");
    }
    s.set({ bits: 16, signed: false });
    for (const out of [s.home(base), s.cas(base)]) expect(out).toMatchObject({ digits: 9, angle: "deg", word: 16, signed: false });
    expect(s.home(base).budgetSteps).toBeGreaterThan(0); // Home's defaults come with it
    expect(s.cas(base).hardTimeoutS).toBeGreaterThan(0);
  });
});

describe("the calc sends the word (R194)", () => {
  /** A calc over an engine that keeps the settings each Home input came with; its word is the app's store. */
  const spied = (): { calc: EngineCalc; seen: HomeSettings[] } => {
    const seen: HomeSettings[] = [];
    const engine = { home: (_g: string, s: HomeSettings) => (seen.push(s), Promise.resolve({ display: "2" })) } as unknown as MathEngine;
    return { calc: new EngineCalc(engine), seen };
  };

  it("sends no word while none is set, and the word with every request after a row set it", async () => {
    const { calc, seen } = spied();
    const s = { digits: 12, angle: "rad", format: "std" } as const;
    await calc.home("1+1", s);
    expect(seen[0]?.word).toBeUndefined(); // as if absent: the engine uses its own word
    expect(seen[0]?.signed).toBeUndefined();
    wordStore.set({ bits: 8, signed: true });
    await calc.home("1+1", s);
    expect(seen[1]).toMatchObject({ word: 8, signed: true });
  });
});
