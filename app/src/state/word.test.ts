// SPDX-License-Identifier: GPL-3.0-or-later
// R194 (docs/04 5.4, 6.2): the word size and sign are one stamped record under the key `word`, `{ bits, signed }`, in the
// backup with a validator that takes only those values; the session reads it when it starts, and sends it to the engine
// only when it was set (the default, 64 bits unsigned, is the engine's own).
import { describe, expect, it } from "vitest";
import { BACKUP_KEYS, checkBackup, VALIDATORS, type CheckedBackup, type RefusedBackup } from "./backup.ts";
import { FakeCalc } from "../calc/fake.ts";
import type { CalcSettings } from "../calc/port.ts";
import { DATA_VERSION } from "./storage.ts";
import { fakeKv } from "./fakeKv.ts";
import { Session } from "./session.svelte.ts";
import { validWord, WORD_KEY } from "./wordSetting.ts";

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

  it("validWord keeps a whole record and nothing else", () => {
    expect(validWord({ bits: 8, signed: false })).toEqual({ bits: 8, signed: false });
    expect(validWord({ bits: 12, signed: false })).toBeUndefined();
    expect(validWord({ bits: 8, signed: false, x: 1 })).toBeUndefined();
    expect(validWord(undefined)).toBeUndefined();
  });
});

describe("the session and the word (R194)", () => {
  /** A calc that keeps the settings each Home input came with. */
  const spied = (): { calc: FakeCalc; seen: CalcSettings[] } => {
    const calc = new FakeCalc();
    const seen: CalcSettings[] = [];
    const home = calc.home.bind(calc);
    (calc as { home: (giac: string, s: CalcSettings) => ReturnType<FakeCalc["home"]> }).home = (giac, s) => (seen.push(s), home(giac));
    return { calc, seen };
  };

  it("sends no word while none is set", async () => {
    const { calc, seen } = spied();
    const s = new Session(calc, fakeKv());
    await s.restore();
    await s.submit("1+1");
    expect(seen.length).toBe(1);
    expect(seen[0]?.word).toBeUndefined(); // as if absent: the engine uses its own word
    expect(seen[0]?.signed).toBeUndefined();
    expect(s.word).toBeUndefined();
  });

  it("reads the stored word at the start and sends it with every input", async () => {
    const { calc, seen } = spied();
    const s = new Session(calc, fakeKv([["word", { bits: 8, signed: true }]]));
    await s.restore();
    expect(s.word).toEqual({ bits: 8, signed: true });
    await s.submit("1+1");
    expect(seen.at(-1)).toMatchObject({ word: 8, signed: true });
  });

  it("ignores a stored word that is not whole", async () => {
    const s = new Session(new FakeCalc(), fakeKv([["word", { bits: 12, signed: true }]]));
    await s.restore();
    expect(s.word).toBeUndefined();
  });
});
