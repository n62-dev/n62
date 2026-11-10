// SPDX-License-Identifier: GPL-3.0-or-later
// R272: the first drop of a history row past 200 adds one note that points to the backup, once per install.
import { describe, expect, it } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import type { CasOutcome, HomeOutcome } from "../calc/port.ts";
import { safePrecision } from "../engine/homeEval.ts";
import { dataText } from "../i18n/enData.ts";
import { HISTORY_LIMIT } from "./results.ts";
import { Session, type View } from "./session.svelte.ts";
import { fakeKv, type FakeKv } from "./fakeKv.ts";

/** An engine that answers at once (FakeCalc waits). */
class QuickCalc extends FakeCalc {
  override ready = (): Promise<{ safeStart?: { skipped: number } } | void> => Promise.resolve();
  override home(): Promise<HomeOutcome> {
    return Promise.resolve({ ok: true, display: "1", approximate: false, ...safePrecision("1") });
  }
  override cas(giac: string): Promise<CasOutcome> {
    return Promise.resolve({ ok: true, text: giac, latex: giac, facts: { exact: true, reliableDigits: null } });
  }
}

const notes = (s: Session, view: View): string[] => (view === "home" ? s.home : s.cas).filter((i) => i.status === "note").map((i) => i.text);
/** The note comes after a lazy import and a store read. */
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 60));

async function enter(s: Session, n: number, view: View = "home"): Promise<void> {
  s.setView(view);
  for (let k = 0; k < n; k++) await s.submit(String(k + 1));
  await settle();
}

describe("the note at the first dropped row (R272)", () => {
  it("the text says what happens and where the backup is", () => {
    expect(dataText("history.dropped")).toBe("Older rows are dropped after 200. Save a backup: Settings › Backup.");
  });

  it("no note before the first drop, and none at exactly the limit", async () => {
    const s = new Session(new QuickCalc(0), fakeKv());
    await s.restoreHistory();
    await enter(s, HISTORY_LIMIT);
    expect(s.home.length).toBe(HISTORY_LIMIT);
    expect(notes(s, "home")).toEqual([]);
  });

  it("the first drop adds one note row, and the flag is stored", async () => {
    const kv = fakeKv();
    const s = new Session(new QuickCalc(0), kv);
    await s.restoreHistory();
    await enter(s, HISTORY_LIMIT + 1);
    expect(notes(s, "home")).toEqual([dataText("history.dropped")]);
    expect(s.home.filter((i) => i.status !== "note").length).toBe(HISTORY_LIMIT);
    expect(kv.data.get("historyDropNoted")).toBe(true);
  });

  it("a second drop adds none, and neither does a drop in the other view", async () => {
    const s = new Session(new QuickCalc(0), fakeKv());
    await s.restoreHistory();
    await enter(s, HISTORY_LIMIT + 3);
    expect(notes(s, "home")).toHaveLength(1);
    await enter(s, HISTORY_LIMIT + 1, "cas");
    expect(notes(s, "cas")).toEqual([]);
    expect(notes(s, "home")).toHaveLength(1);
  });

  it("a relaunch adds none (the flag is stored per install)", async () => {
    const kv: FakeKv = fakeKv();
    const a = new Session(new QuickCalc(0), kv);
    await a.restoreHistory();
    await enter(a, HISTORY_LIMIT + 1);
    const b = new Session(new QuickCalc(0), fakeKv(kv.data)); // a new store object over the same records
    await b.restoreHistory();
    await enter(b, HISTORY_LIMIT + 1);
    expect(notes(b, "home")).toEqual([]);
  });
});
