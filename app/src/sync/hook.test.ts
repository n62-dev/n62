// SPDX-License-Identifier: GPL-3.0-or-later
// R182: each finished row goes to the sync queue once, through the hook main.ts loads when idle (sync/hook.ts): the
// session with the fake engine, the folder a map (sync/fakeFolder.ts), the queue the real one (sync/queue.ts).
import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import type { CasOutcome } from "../calc/port.ts";
import { fakeKv } from "../state/fakeKv.ts";
import { Session, type HistoryItem } from "../state/session.svelte.ts";
import { putRow } from "../units/row.ts";
import { fakeFolder, fakePort, memKv } from "./fakeFolder.ts";
import { SyncFeed } from "./feed.ts";
import { hookRows, start, type FeedPorts } from "./hook.ts";
import type { QueueText } from "./queue.ts";

/** CAS answers an error for `bad`. */
class Calc extends FakeCalc {
  override cas(giac: string): Promise<CasOutcome> {
    return giac === "bad" ? Promise.resolve({ ok: false, text: "Error: Bad Argument Value", latex: "", facts: { exact: false, reliableDigits: null } }) : super.cas(giac);
  }
}

async function setup(chosen = true) {
  const s = new Session(new Calc(), fakeKv());
  await s.restoreHistory();
  const dir = fakeFolder();
  const feed = new SyncFeed({ ...fakePort(dir, memKv()), names: async () => [], model: async () => "Pixel 7", app: "0.1.0", start: new Date() });
  const add = vi.spyOn(feed.queue, "add");
  let loads = 0;
  const p: FeedPorts = {
    chosen: async () => chosen,
    feed: async () => (loads++, feed),
  };
  return { s, dir, feed, add, p, loads: () => loads };
}
/** The texts of each queue.add call. */
const added = (add: { mock: { calls: unknown[][] } }): QueueText[][] => add.mock.calls.map((c) => c[0] as QueueText[]);
const lineOf = (texts: QueueText[]): Record<string, unknown> => JSON.parse((texts.find((t) => t.file.endsWith(".jsonl")) as QueueText).text) as Record<string, unknown>;

afterEach(() => vi.useRealTimers());

describe("the sync hook (R182)", () => {
  it("a finished Home row reaches queue.add once, with its line and its cell; a later save adds nothing", async () => {
    const { s, dir, add, p } = await setup();
    const flush = hookRows(s, p);
    await s.submit("1+2");
    s.saveHistory(); // any other save (a Clear, a setting) hands nothing again
    await flush();
    expect(add).toHaveBeenCalledTimes(1);
    const texts = added(add)[0] as QueueText[];
    expect(texts.map((t) => t.file.replace(/\d{4}-\d\d-\d\d/, "D"))).toEqual([expect.stringMatching(/^n62-Pixel-7-[0-9a-f]{4}-D\.jsonl$/), expect.stringMatching(/^n62-Pixel-7-[0-9a-f]{4}-D\.py$/)]);
    expect(lineOf(texts)).toMatchObject({ id: s.home[0]?.uid, view: "home", input: "1+2", ok: true });
    expect(dir.files.get(texts[0]?.file as string)).toBe(texts[0]?.text); // flushed: in the folder
  });

  it("an error row and a CAS row each reach it once; a cancelled row does not", async () => {
    const { s, add, p } = await setup();
    const flush = hookRows(s, p);
    s.view = "cas";
    await s.submit("bad", "bad"); // (the Giac text as sent)
    await s.submit("x+1");
    await flush();
    const lines = added(add).map(lineOf);
    expect(lines).toMatchObject([
      { id: s.cas[0]?.uid, view: "cas", input: "bad", ok: false, error: "Error: Bad Argument Value" },
      { id: s.cas[1]?.uid, view: "cas", input: "x+1", ok: true },
    ]);
    const slow = new Session(new FakeCalc(1000), fakeKv());
    await slow.restoreHistory();
    const other = await setup();
    const flush2 = hookRows(slow, other.p);
    const job = slow.submit("5");
    await slow.cancel();
    await job;
    await flush2();
    expect(slow.home[0]?.status).toBe("cancelled");
    expect(other.add).not.toHaveBeenCalled();
  });

  it("a later result of the same unit visit (it replaces the row) is a new line with the same id; the last is the result", async () => {
    const { s, dir, add, p } = await setup();
    const flush = hookRows(s, p);
    const row = (text: string): Omit<HistoryItem, "id"> => ({ view: "home", latex: "3\\,\\mathrm{m}", status: "done", resultLatex: text, text, approximate: false, startedAt: 0 });
    const id = putRow(s, row("3"));
    putRow(s, row("4"), id);
    await flush();
    const lines = added(add).map(lineOf);
    expect(lines).toHaveLength(2);
    expect(lines[0]?.id).toBe(lines[1]?.id);
    expect(s.home).toHaveLength(1);
    const file = [...dir.files.entries()].find(([f]) => f.endsWith(".jsonl")) as [string, string];
    const inFile = file[1].trim().split("\n").map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(inFile.map((l) => l.id)).toEqual([lines[0]?.id, lines[0]?.id]); // G210's reader keeps the last line of an id
    expect(String(inFile[1]?.value)).toBe("4");
  });

  it("no chosen folder: queue.add is not called and the feed is never loaded", async () => {
    const { s, add, p, loads } = await setup(false);
    const flush = hookRows(s, p);
    await s.submit("1+2");
    await flush();
    expect(add).not.toHaveBeenCalled();
    expect(loads()).toBe(0);
  });

  it("rows restored from before this page are not handed again; one finished before the hook is", async () => {
    const kv = fakeKv();
    const old = new Session(new Calc(), kv);
    await old.restoreHistory();
    await old.submit("7");
    const restored = (old.home[0] as HistoryItem).uid;
    // the stored row finished before this page: as a relaunch reads it
    await kv.set("history", { home: [{ ...JSON.parse(JSON.stringify(old.home[0])), at: Date.now() - performance.now() - 60_000 }] });
    const s = new Session(new Calc(), kv);
    await s.restoreHistory();
    await s.submit("8"); // before the hook starts
    const { add, p } = await setup();
    const flush = hookRows(s, p);
    await flush();
    expect(added(add).map(lineOf).map((l) => l.id)).toEqual([s.home[1]?.uid]);
    expect(s.home[0]?.uid).toBe(restored);
  });

  it("a hide flushes the queue (Android); the web listens for nothing", async () => {
    const { s, dir, p } = await setup();
    let onHide: (() => void) | undefined;
    const doc = { hidden: false, addEventListener: (_: string, f: () => void) => void (onHide = f) } as unknown as Document;
    const shell = { calc: new FakeCalc(), showMenu: () => {}, clip: undefined } as unknown as Parameters<typeof start>[1];
    start(s, shell, doc, false, p);
    expect(onHide).toBeUndefined();
    start(s, shell, doc, true, p);
    await s.submit("1+2");
    await new Promise((r) => setTimeout(r, 0));
    expect(dir.calls).toEqual([]); // queued: the 2 s burst timer has not run
    (doc as { hidden: boolean }).hidden = true;
    onHide?.();
    await vi.waitFor(() => expect(dir.calls.length).toBe(2));
  });
});
