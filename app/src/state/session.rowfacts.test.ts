// SPDX-License-Identifier: GPL-3.0-or-later
// G211: a history row keeps the Giac text it was sent as, the angle and digits it ran in, the word in force (R194), its
// uid (the same across runs) and when it finished (`at`); stored rows keep the six with their shape (storedItem.ts).
// The engine is a fake that records what it is sent; the clock is given (Date only, so the fake's timers still run).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EngineCalc } from "../calc/engine.ts";
import { FakeCalc } from "../calc/fake.ts";
import type { CalcSettings, CasOutcome, HomeOutcome } from "../calc/port.ts";
import { safePrecision } from "../engine/homeEval.ts";
import type { MathEngine } from "../engine/types.ts";
import { putRow } from "../units/row.ts";
import { fakeKv, type FakeKv } from "./fakeKv.ts";
import { FULL_LIMIT } from "./results.ts";
import { Session, type HistoryItem } from "./session.svelte.ts";
import { sessionLine } from "./sessionLine.ts";
import { restoredItem } from "./storedItem.ts";
import { wordStore } from "./wordStore.svelte.ts";

/** The fake engine, with every Giac text and settings it was sent recorded. */
class SpyCalc extends FakeCalc {
  sent: { view: "home" | "cas"; giac: string; s?: CalcSettings }[] = [];
  override home(giac: string, s?: CalcSettings): Promise<HomeOutcome> {
    this.sent.push({ view: "home", giac, ...(s ? { s: { ...s } } : {}) });
    return super.home(giac);
  }
  override cas(giac: string, s?: CalcSettings): Promise<CasOutcome> {
    this.sent.push({ view: "cas", giac, ...(s ? { s: { ...s } } : {}) });
    return super.cas(giac);
  }
}

const T0 = Date.UTC(2026, 10, 14, 3, 0, 0);
const uidAt = (t: number, id: number): string => `${t.toString(36)}-${id}`;
const rows = (s: Session): HistoryItem[] => s.home.map((i) => ({ ...i }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

describe("the row's Giac text, angle and digits (G211)", () => {
  it("a DEG Home row has angle deg, the digits setting and the Giac text the engine received", async () => {
    const calc = new SpyCalc();
    const s = new Session(calc, fakeKv());
    s.setAngle("deg");
    s.setDigits(8);
    await s.submit("\\sin(30)");
    const item = s.home[0] as HistoryItem;
    expect(item.status).toBe("done");
    expect(calc.sent).toHaveLength(1);
    expect(item.giac).toBe(calc.sent[0]?.giac);
    expect(item.angle).toBe("deg");
    expect(item.digits).toBe(8);
  });

  it("a CAS row the same, in RAD", async () => {
    const calc = new SpyCalc();
    const s = new Session(calc, fakeKv());
    s.setView("cas");
    s.setDigits(15);
    await s.submit("x^2+1");
    const item = s.cas[0] as HistoryItem;
    expect(calc.sent[0]?.view).toBe("cas");
    expect(item.giac).toBe(calc.sent[0]?.giac);
    expect(item).toMatchObject({ angle: "rad", digits: 15 });
  });

  it("a \\res chip in the input: giac is the text sent (pasr_k), not the LaTeX", async () => {
    const calc = new SpyCalc();
    const s = new Session(calc, fakeKv());
    await s.submit("\\res{1}{0.333333333333}\\times3", undefined, { "res:1": { value: "0.333333333333", exact: false } });
    const item = s.home[0] as HistoryItem;
    expect(calc.sent[0]?.giac).toContain("pasr_1");
    expect(item.giac).toBe(calc.sent[0]?.giac);
  });

  it("a CAS error row keeps them too", async () => {
    const calc = new SpyCalc();
    calc.cas = (giac: string) => (calc.sent.push({ view: "cas", giac, s: { digits: 0, angle: "rad", format: "std" } }), Promise.resolve({ ok: false, text: "bad", latex: "", facts: { exact: false, reliableDigits: null } }));
    const s = new Session(calc, fakeKv());
    s.setView("cas");
    await s.submit("x", "1/0");
    expect(s.cas[0]).toMatchObject({ status: "error", giac: "1/0", angle: "rad", digits: 12 });
  });

  it("a Giac text over FULL_LIMIT is not kept (as `full` is not)", async () => {
    const s = new Session(new SpyCalc(), fakeKv());
    const long = "1+".repeat(FULL_LIMIT / 2) + "1";
    await s.submit("x", long);
    const item = s.home[0] as HistoryItem;
    expect(item.giac).toBeUndefined();
    expect(item).toMatchObject({ angle: "rad", digits: 12 });
  });

  it("the fake engine reports no word: the row has none and its line says null", async () => {
    const s = new Session(new SpyCalc(), fakeKv());
    await s.submit("x", "2+2");
    const item = s.home[0] as HistoryItem;
    expect(item.word).toBeUndefined();
    expect(sessionLine(item, { t: new Date(T0), app: "0" })).toContain(`"digits":12,"word":null`);
  });
});

describe("the word in force at job time (G211, R194)", () => {
  /** EngineCalc over a fake engine that answers every Home and CAS job. */
  const engineCalc = (): EngineCalc => {
    const engine = {
      ready: () => Promise.resolve({ instantiateMs: 0, initMs: 0, replayMs: 0, readyMs: 0 }),
      home: (g: string) => Promise.resolve({ ok: true, display: g, path: "exact", approximate: false, exactMs: 0, totalMs: 0, ...safePrecision(g) }),
      cas: (g: string) => Promise.resolve({ ok: true, text: g, latex: g, facts: { exact: true, reliableDigits: null } }),
    } as unknown as MathEngine;
    return new EngineCalc(engine);
  };

  it("no word set: 64 bits unsigned, the engine's own; Word 8 signed: { bits: 8, signed: true } and its line", async () => {
    const s = new Session(engineCalc(), fakeKv());
    await s.submit("x", "shl(3,7)");
    expect(s.home[0]?.word).toEqual({ bits: 64, signed: false });
    wordStore.set({ bits: 8, signed: true });
    await s.submit("x", "shl(3,7)");
    s.setView("cas");
    await s.submit("x", "shl(3,7)");
    for (const item of [s.home[1], s.cas[0]] as HistoryItem[]) {
      expect(item.word).toEqual({ bits: 8, signed: true });
      expect(sessionLine(item, { t: new Date(T0), app: "0" })).toContain(`"digits":12,"word":{"bits":8,"signed":true}`);
    }
    wordStore.set({ bits: 64, signed: false });
  });
});

describe("uid and at (G211)", () => {
  const T1 = T0 + 1000;
  it("a finished row has both: the clock in base 36, a hyphen, the row's id; at is when it finished", async () => {
    const s = new Session(new SpyCalc(), fakeKv());
    await s.submit("x", "1");
    const item = s.home[0] as HistoryItem;
    expect(item.uid).toBe(uidAt(T0, item.id));
    expect(item.at).toBe(T0);
    vi.setSystemTime(T1);
    s.setView("cas");
    await s.submit("x", "1/0");
    const c = s.cas[0] as HistoryItem;
    expect(c.uid).toBe(uidAt(T1, c.id));
    expect(c.at).toBe(T1);
  });

  it("three rows, the second deleted, a restart, a fourth row: four different uids, the kept rows keep theirs", async () => {
    const kv = fakeKv();
    const s1 = new Session(new SpyCalc(), kv);
    await s1.restoreHistory();
    for (const [k, g] of ["1", "2", "3"].entries()) {
      vi.setSystemTime(T0 + k * 1000);
      await s1.submit(g, g);
    }
    const before = rows(s1);
    expect(await s1.removeItem(before[1] as HistoryItem)).toBe(true);
    vi.setSystemTime(T0 + 60_000);
    const s2 = new Session(new SpyCalc(), kv);
    await s2.restoreHistory();
    expect(s2.home.map((i) => i.uid)).toEqual([before[0]?.uid, before[2]?.uid]);
    await s2.submit("4", "4");
    const uids = [...before.map((i) => i.uid), s2.home[2]?.uid];
    expect(uids.every((u) => typeof u === "string")).toBe(true);
    expect(new Set(uids).size).toBe(4);
    expect(s2.home.map((i) => i.at)).toEqual([T0, T0 + 2000, T0 + 60_000]);
  });

  it("a replaced unit row keeps its uid; a new one gets its own; each has the angle and digits", async () => {
    const s = new Session(new SpyCalc(), fakeKv());
    await s.restoreHistory();
    s.setAngle("deg");
    s.setDigits(9);
    const row = (text: string): Omit<HistoryItem, "id"> => ({ view: "home", latex: "x", status: "done", resultLatex: text, text, approximate: false, startedAt: 0 });
    const id = putRow(s, row("1"));
    const uid = s.home[0]?.uid;
    expect(uid).toBe(uidAt(T0, id));
    vi.setSystemTime(T0 + 5000);
    expect(putRow(s, row("2"), id)).toBe(id);
    expect(s.home).toHaveLength(1);
    expect(s.home[0]).toMatchObject({ text: "2", uid, at: T0 + 5000, angle: "deg", digits: 9 });
    const other = putRow(s, row("3"));
    expect(s.home[1]?.uid).toBe(uidAt(T0 + 5000, other));
  });

  it("an old stored row gains a uid at its first read and keeps it over the next read", async () => {
    const old = { id: 7, view: "home", latex: "1", status: "done", resultLatex: "1", text: "1", approximate: false, startedAt: 5 };
    const kv: FakeKv = fakeKv([["history", { home: [old] }]]);
    const s1 = new Session(new SpyCalc(), kv);
    await s1.restoreHistory();
    const uid = s1.home[0]?.uid;
    expect(uid).toBe(uidAt(T0, s1.home[0]?.id ?? -1));
    vi.setSystemTime(T0 + 60_000);
    const s2 = new Session(new SpyCalc(), kv);
    await s2.restoreHistory();
    expect(s2.home[0]?.uid).toBe(uid);
  });
});

describe("stored rows keep the six with their shape (storedItem.ts, G211)", () => {
  const base = { id: 3, view: "home", latex: "1", status: "done", resultLatex: "1", text: "1", approximate: false, startedAt: 0 } as const;
  const six = { uid: "mhyj0w00-3", at: T0, giac: "sin(pasdeg*30)", angle: "deg", digits: 8, word: { bits: 8, signed: true } } as const;

  it("a row stored and read back keeps them (a fresh id, the same uid)", async () => {
    const s = new Session(new SpyCalc(), fakeKv());
    s.setAngle("deg");
    s.setDigits(8);
    await s.submit("\\sin(30)");
    const item = structuredClone({ ...(s.home[0] as HistoryItem), word: { bits: 8 as const, signed: true } });
    const back = restoredItem(item, 99);
    expect(back.id).toBe(99);
    for (const k of ["uid", "at", "giac", "angle", "digits", "word"] as const) expect(back[k], k).toEqual(item[k]);
    expect(back.giac).toBeDefined();
  });

  it("each with its shape; a field without it reads as absent", () => {
    expect(restoredItem({ ...base, ...six } as HistoryItem, 1)).toMatchObject(six);
    const bad = { uid: 5, at: "now", giac: "x".repeat(FULL_LIMIT + 1), angle: "grad", digits: 31, word: { bits: 12, signed: true } };
    const r = restoredItem({ ...base, ...bad } as unknown as HistoryItem, 1);
    expect(r.uid).toBe(uidAt(T0, 1)); // a uid of the wrong shape: a new one, as for none
    for (const k of ["at", "giac", "angle", "digits", "word"] as const) expect(r[k], k).toBeUndefined();
    for (const d of [0, 2.5, Number.NaN]) expect(restoredItem({ ...base, digits: d } as HistoryItem, 1).digits).toBeUndefined();
    expect(restoredItem({ ...base, digits: 30 } as HistoryItem, 1).digits).toBe(30);
    expect(restoredItem({ ...base, word: { bits: 8, signed: true, x: 1 } } as unknown as HistoryItem, 1).word).toBeUndefined();
  });

  it("an old stored row without them reads as absent (bar the uid it gains)", () => {
    const r = restoredItem({ ...base } as HistoryItem, 4);
    for (const k of ["at", "giac", "angle", "digits", "word"] as const) expect(k in r, k).toBe(false);
    expect(r.uid).toBe(uidAt(T0, 4));
  });
});
