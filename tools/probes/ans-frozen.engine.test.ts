// SPDX-License-Identifier: GPL-3.0-or-later
// G640 (sandra's probe of 2026-11-20, H3, moved into the repo): how Ans behaves in the history today, on the real engine:
// what a row that read Ans keeps (`ans`), what a recall of it gives, what a store round trip keeps, Ans after an error row,
// on a fresh history, after an inexact result and in CAS. Prints, asserts nothing; the tests are app/src/state/ansFrozen*.
// Run from the checkout (GIAC_OUT set): env -C app npx vitest run -c ../tools/probes/ans-frozen.vitest.config.mts
// Output: tools/probes/_out/ans-frozen.out (PROBE_OUT moves it), and on the console.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";
import { EngineCalc } from "../../app/src/calc/engine.ts";
import { createRequestHandler } from "../../app/src/engine/host.ts";
import { giacAvailable, loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";
import type { Request, Response } from "../../app/src/engine/protocol.ts";
import { WorkerEngine, type WorkerLike } from "../../app/src/engine/workerEngine.ts";
import { fakeKv } from "../../app/src/state/fakeKv.ts";
import { Session, type HistoryItem } from "../../app/src/state/session.svelte.ts";
import { restoredItem } from "../../app/src/state/storedItem.ts";
import { chipOf } from "../../app/src/state/results.ts";

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
const row = (i?: HistoryItem): string =>
  i ? JSON.stringify({ latex: i.latex, status: i.status, text: i.text, approx: i.approximate, inexactInput: i.inexactInput, full: i.full, fullExact: i.fullExact, ans: i.ans, chips: i.chips, giac: i.giac, unitDropped: i.unitDropped }) : "none";
const out: string[] = [];
const log = (k: string, i?: HistoryItem): void => void out.push(`PROBE ${k}: ${row(i)}`);

describe.skipIf(!giacAvailable())("G640: the Ans probe", () => {
  it("runs", { timeout: 120_000 }, async () => {
    const mk = (): Session => new Session(new EngineCalc(new WorkerEngine({ createWorker: () => new InProcessWorker() })), fakeKv());
    // A: Ans², another row, then recall the Ans² row with its stored latex and chips (what ◀ / Enter on a pick does)
    let s = mk();
    await s.submit("5");
    await s.submit("\\ans^{2}");
    await s.submit("7");
    const r2 = s.home[1] as HistoryItem;
    log("A1 5", s.home[0]);
    log("A2 Ans^2", r2);
    await s.submit(r2.latex, undefined, r2.chips ?? {});
    log("A4 recall of row 2", s.home[3]);
    log("A2 after (row 2 unchanged?)", s.home[1]);
    // restored from the store: the row's ans snapshot survives?
    log("A2 restored", restoredItem(JSON.parse(JSON.stringify(r2)), 1));
    // B: 1/3 then Ans×3; literal decimals as alternatives
    s = mk();
    await s.submit("\\frac{1}{3}");
    await s.submit("\\ans\\times3");
    log("B1 1/3", s.home[0]);
    log("B2 Ans*3", s.home[1]);
    await s.submit("0.333333333333\\times3");
    log("B3 12-digit literal *3", s.home[2]);
    await s.submit("0.3333333333333333333333333333333333333333\\times3");
    log("B4 40-digit literal *3", s.home[3]);
    // C: an error row between: Ans skips it
    s = mk();
    await s.submit("4");
    await s.submit("\\sqrt{");
    await s.submit("\\ans+1");
    log("C2 error row", s.home[1]);
    log("C3 Ans+1 after error", s.home[2]);
    // D: no result yet
    s = mk();
    await s.submit("\\ans+1");
    log("D1 Ans on fresh history", s.home[0]);
    // E: inexact result: Ans by name with facts; the chip value vs its digits typed in
    s = mk();
    await s.submit("\\sin\\left(1\\right)");
    await s.submit("\\ans\\times2");
    const e1 = s.home[0] as HistoryItem;
    log("E1 sin(1)", e1);
    log("E2 Ans*2", s.home[1]);
    out.push(`PROBE E1 chipOf: ${JSON.stringify(chipOf(e1))}`);
    // F: CAS keeps its own Ans
    s.setView("cas");
    await s.submit("\\ans+1");
    log("F1 CAS Ans+1 with no CAS result", s.cas[0]);
    await s.submit("x+1");
    await s.submit("\\ans^{2}");
    log("F3 CAS Ans^2", s.cas[2]);
    s.setView("home");
    await s.submit("\\ans+1");
    log("F4 Home Ans+1 after CAS rows", s.home[2]);
    const file = process.env["PROBE_OUT"] ?? join(dirname(fileURLToPath(import.meta.url)), "_out", "ans-frozen.out");
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, out.join("\n") + "\n");
    console.log(out.join("\n"));
  });
});
