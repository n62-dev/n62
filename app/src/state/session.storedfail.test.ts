// SPDX-License-Identifier: GPL-3.0-or-later
// R264: the stored rows' reader (state/storedItem.ts) is a lazy chunk, loaded by the history's start read. A chunk that
// will not load (a tab open across a redeploy, a first visit on a bad network) must not read the stored history as
// empty: the app starts, nothing writes over the stored rows on the next store, and the next start reads them.
import { describe, expect, it, vi } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import type { HomeOutcome } from "../calc/port.ts";
import { safePrecision } from "../engine/homeEval.ts";
import type { Kv } from "./storage.ts";

/** While `on`, every import of the reader fails, as a missing hashed file does. */
const fail = vi.hoisted(() => ({ on: true, tries: 0 }));
vi.mock("./storedItem.ts", async (actual) => {
  if (fail.on) {
    fail.tries++;
    throw new TypeError("Failed to fetch dynamically imported module: storedItem");
  }
  return await actual<typeof import("./storedItem.ts")>();
});

class QuickCalc extends FakeCalc {
  override ready = (): Promise<void> => Promise.resolve();
  override names(): Promise<never[]> {
    return Promise.resolve([]);
  }
  override home(): Promise<HomeOutcome> {
    return Promise.resolve({ ok: true, display: "1", approximate: false, ...safePrecision("1") });
  }
}

const row = (latex: string): Record<string, unknown> => ({ id: 1, view: "home", latex, status: "done", resultLatex: latex, text: latex, approximate: false, startedAt: 0 });

/** An in-memory store holding three Home rows; counts its writes of `history`. */
function storeOfThree(): Kv & { data: Map<string, unknown>; writes: number } {
  const data = new Map<string, unknown>([["history", { home: [row("1"), row("2"), row("3")], cas: [] }]]);
  const kv = {
    data,
    writes: 0,
    get: <T>(k: string) => Promise.resolve(structuredClone(data.get(k)) as T | undefined),
    set: (k: string, v: unknown) => {
      if (k === "history") kv.writes++;
      data.set(k, structuredClone(v));
      return Promise.resolve();
    },
  };
  return kv;
}

const stored = (kv: { data: Map<string, unknown> }): string[] => ((kv.data.get("history") as { home: { latex: string }[] }).home ?? []).map((i) => i.latex);

describe("the stored rows' reader fails to load (R264)", () => {
  it("the start goes on, the stored rows are not overwritten, and the next start reads them", async () => {
    const { Session } = await import("./session.svelte.ts");
    const kv = storeOfThree();
    const a = new Session(new QuickCalc(), kv);
    await expect(a.restoreHistory()).resolves.toBeUndefined(); // the app starts: the kept line's wait (main.ts) settles
    expect(fail.tries).toBe(2); // the reader was asked for twice (one more try after the first failure)
    expect(a.home.map((i) => i.latex)).toEqual([]);
    await a.submit("4"); // the next store
    a.flushHistory();
    await new Promise((r) => setTimeout(r, 0));
    expect(kv.writes).toBe(0);
    expect(stored(kv)).toEqual(["1", "2", "3"]);

    fail.on = false; // the next start, with the chunk in place
    const b = new Session(new QuickCalc(), kv);
    await b.restoreHistory();
    expect(b.home.map((i) => i.latex)).toEqual(["1", "2", "3"]);
    await b.submit("5");
    b.flushHistory();
    await new Promise((r) => setTimeout(r, 0));
    expect(stored(kv)).toEqual(["1", "2", "3", "5"]);
  });
});
