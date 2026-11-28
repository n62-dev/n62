// SPDX-License-Identifier: GPL-3.0-or-later
// G640 (owner, 2026-11-20 night, H3): a row that used Ans shows and copies the value Ans had (frozen in history); on the line
// Ans stays live, and a recalled row comes back live. On the real engine, behind the port and the worker protocol, as
// session.homeuses.engine.test.ts runs it. The pins pass today and stay green; the cases G642 (the snapshot) makes pass are
// in KNOWN_FAIL (`it.fails`: a known-fail that passes fails the run), and G642 deletes each line as it turns green.
// Expected values are derived: 5² = 25, 7² = 49, 1/3 · 3 = 1; the others are the session's own (the chip, the uid, the
// drawn LaTeX of the source row), never typed in here.
import { describe, expect, it } from "vitest";
import { EngineCalc } from "../calc/engine.ts";
import type { Chip } from "../input/chips.ts";
import { createRequestHandler } from "../engine/host.ts";
import { giacAvailable, loadNodeGiac } from "../engine/nodeGiac.ts";
import type { Request, Response } from "../engine/protocol.ts";
import { WorkerEngine, type WorkerLike } from "../engine/workerEngine.ts";
import { fakeKv } from "./fakeKv.ts";
import { Session, type HistoryItem } from "./session.svelte.ts";
import { restoredItem } from "./storedItem.ts";

class InProcessWorker implements WorkerLike {
  onmessage: ((ev: { data: Response }) => void) | null = null;
  onerror: ((ev: { message?: string }) => void) | null = null;
  terminated = false;
  private handle = createRequestHandler(
    () => loadNodeGiac(),
    (r) => setTimeout(() => !this.terminated && this.onmessage?.({ data: r }), 0),
  );
  postMessage(msg: Request): void {
    setTimeout(() => void this.handle(msg), 0);
  }
  terminate(): void {
    this.terminated = true;
  }
}

const session = (): Session => new Session(new EngineCalc(new WorkerEngine({ createWorker: () => new InProcessWorker() })), fakeKv());
/** A row as the store writes and reads it: JSON, then restoredItem. */
const roundTrip = (i: HistoryItem): HistoryItem => restoredItem(JSON.parse(JSON.stringify(i)) as HistoryItem, i.id);
const row = (s: Session, k: number): HistoryItem => {
  const r = s.home[k];
  if (!r) throw new Error(`no row ${k}`);
  return r;
};
const casRow = (s: Session, k: number): HistoryItem => {
  const r = s.cas[k];
  if (!r) throw new Error(`no CAS row ${k}`);
  return r;
};
/** G×5.972ᴇ24 with G as a constant chip of find/factors.yaml's numbers (value 6.67430E-11, σ 1.5E-15): a result with σ. */
const G_CHIP: Chip = { value: "6.67430E-11", exact: false, unc: "1.5E-15" };
const G_TIMES_M = "\\const{G}{G}\\times5.972\\times10^{24}";

// ---- cases that fail today, each with the package that makes it pass (that package deletes its line) ------------------
const KNOWN_FAIL = new Map<string, string>([]);
const known = (id: string, what: string, fn: () => Promise<void>): void => {
  const pkg = KNOWN_FAIL.get(id);
  (pkg ? it.fails : it)(`${pkg ? `${pkg} (known-fail) ` : ""}${what}`, { timeout: 60_000 }, fn);
};

describe.skipIf(!giacAvailable())("G640: Ans frozen in history, live on the line (real Giac)", () => {
  // ---- pins: green today, kept green ----
  it("recall stays live: 5, Ans², 7, recall row 2 and Enter gives 49; the old row still reads 25 (probe A4)", { timeout: 60_000 }, async () => {
    const s = session();
    await s.submit("5");
    await s.submit("\\ans^{2}");
    await s.submit("7");
    const r2 = row(s, 1);
    expect(r2.text).toBe("25");
    expect(r2.ans).toMatchObject({ value: "5", exact: true });
    expect(Object.keys(r2.chips ?? {})).not.toContain("ans"); // the chip table never holds Ans: a recall resolves it again
    await s.submit(r2.latex, undefined, r2.chips ?? {}); // what a recall puts on the line, then Enter
    const r4 = row(s, 3);
    expect(r4.latex).toBe("\\ans^{2}");
    expect(r4.text).toBe("49");
    expect(r4.ans).toMatchObject({ value: "7", exact: true });
    expect(row(s, 1).text).toBe("25");
    expect(row(s, 1).ans).toMatchObject({ value: "5", exact: true });
  });

  it("a store round trip keeps ans.value and ans.exact", { timeout: 60_000 }, async () => {
    const s = session();
    await s.submit("5");
    await s.submit("\\ans^{2}");
    expect(roundTrip(row(s, 1)).ans).toMatchObject({ value: "5", exact: true });
  });

  it("1/3, then Ans×3 gives = 1: Ans holds the exact 1/3, not its 12 shown digits", { timeout: 60_000 }, async () => {
    const s = session();
    await s.submit("\\frac{1}{3}");
    await s.submit("\\ans\\times3");
    const r2 = row(s, 1);
    expect(r2.text).toBe("1");
    expect(r2.fullExact).toBe(true);
    expect(r2.ans).toMatchObject({ value: "1/3", exact: true });
  });

  it("G×5.972ᴇ24, then Ans×2: the row's Ans is the source row's chip with its σ, and the result has σ", { timeout: 60_000 }, async () => {
    const s = session();
    await s.submit(G_TIMES_M, undefined, { "const:G": G_CHIP });
    const r1 = row(s, 0);
    const chip = s.chipFor(r1);
    expect(chip?.unc).toBeTruthy(); // the source row has σ (G355)
    await s.submit("\\ans\\times2");
    const r2 = row(s, 1);
    expect(r2.status).toBe("done");
    expect(r2.ans).toMatchObject({ value: chip?.value, exact: false, unc: chip?.unc }); // in memory: the chip Ans read
    expect(s.sigma(r2)).toBeTruthy(); // the result shows σ
  });

  // ---- G642: green since the snapshot ----
  known("snapshot-source", "sin(1), then Ans×2: the snapshot names its source row (`from`, the uid) and the LaTeX it showed (`shown`)", async () => {
    const s = session();
    await s.submit("\\sin\\left(1\\right)");
    const r1 = row(s, 0);
    const shown = s.display(r1, true).latex; // the source row's result as the screen drew it when Ans was read (App.svelte: grouped)
    await s.submit("\\ans\\times2");
    expect(row(s, 1).ans).toMatchObject({ ...s.chipFor(r1), from: r1.uid, shown });
  });

  known("snapshot-roundtrip", "sin(1), then Ans×2: the whole snapshot (reliableDigits, shown, from) survives a store round trip", async () => {
    const s = session();
    await s.submit("\\sin\\left(1\\right)");
    const r1 = row(s, 0);
    const chip = s.chipFor(r1);
    expect(chip?.reliableDigits).toEqual(expect.any(Number)); // probe E1: 38 at the default digits
    await s.submit("\\ans\\times2");
    const r2 = row(s, 1);
    const back = roundTrip(r2).ans as unknown as Record<string, unknown>;
    expect(back).toMatchObject({ value: chip?.value, exact: false, reliableDigits: chip?.reliableDigits });
    expect(back).toEqual(r2.ans);
  });

  known("snapshot-sigma-roundtrip", "G×5.972ᴇ24, then Ans×2: the snapshot keeps σ (`unc`) through a store round trip", async () => {
    const s = session();
    await s.submit(G_TIMES_M, undefined, { "const:G": G_CHIP });
    const chip = s.chipFor(row(s, 0));
    await s.submit("\\ans\\times2");
    expect(roundTrip(row(s, 1)).ans).toMatchObject({ value: chip?.value, exact: false, unc: chip?.unc });
  });

  it("G642: CAS in DEG, sin(x), then Ans×2: the snapshot keeps the radian `value` (the chip's) and the drawn `shown` (the degree one)", { timeout: 60_000 }, async () => {
    const s = session();
    s.setView("cas");
    s.setAngle("deg");
    await s.submit("\\sin\\left(x\\right)");
    const r1 = casRow(s, 0);
    expect(r1.view).toBe("cas");
    expect(r1.drawn).toBeTruthy(); // G46f1: the radian text and the drawn one differ
    const shown = s.display(r1, true).latex;
    await s.submit("\\ans\\times2");
    const a = roundTrip(casRow(s, 1)).ans;
    expect(a?.value).toBe(r1.full); // the radian text, as the chip and the line's `exact`
    expect(a?.value).not.toBe(r1.drawn);
    expect(a?.shown).toBe(shown);
    expect(a?.from).toBe(r1.uid);
  });
});
