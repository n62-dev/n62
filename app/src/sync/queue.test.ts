// SPDX-License-Identifier: GPL-3.0-or-later
// G219: the sync queue. The folder port (appendChecked, folderTail) and the store are stubs (fakeFolder.ts): the "folder"
// is a map of file texts the stub appends to, the store a map of values; the clock is vitest's fake timers.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HISTORY_LIMIT } from "../state/results.ts";
import { LEFT_OUT } from "../state/backup.ts";
import { COALESCE_MS, SYNC_QUEUE_CAP, SYNC_QUEUE_KEY, SyncQueue, type SyncStatus } from "./queue.ts";
import { fakeFolder, fakePort, memKv } from "./fakeFolder.ts";

/** A session line as G210 writes it (the fields the queue never reads, cut short). */
const line = (id: string, n: number): string => `${JSON.stringify({ v: 0, app: "0.1.0", id, t: "2026-11-14T10:00:00Z", view: "home", input: String(n), ok: true })}\n`;
const J = "n62-dev-2026-11-14.jsonl";
const P = "n62-dev-2026-11-14.py";
const cell = (n: number): string => `# %%\n_${n} = ${n}\n`;
const row = (n: number): { file: string; text: string }[] => [
  { file: J, text: line(`u${n}`, n) },
  { file: P, text: cell(n) },
];

let kv: ReturnType<typeof memKv>;
let dir: ReturnType<typeof fakeFolder>;
let seen: SyncStatus[];
const make = (): SyncQueue => new SyncQueue(fakePort(dir, kv), (s) => seen.push(s));
const last = (): SyncStatus | undefined => seen[seen.length - 1];

beforeEach(() => {
  vi.useFakeTimers();
  kv = memKv();
  dir = fakeFolder();
  seen = [];
});
afterEach(() => vi.useRealTimers());

describe("the sync queue (G219)", () => {
  it("writes the lines in order, one append per file for a burst within 2 s, text joined in order", async () => {
    const q = make();
    await q.start();
    await q.add(row(1));
    await vi.advanceTimersByTimeAsync(500);
    await q.add(row(2));
    await q.add(row(3));
    expect(dir.calls).toEqual([]);
    expect(last()).toEqual({ state: "queued", queued: 6, dropped: 0 });
    await vi.advanceTimersByTimeAsync(COALESCE_MS - 500);
    await q.idle();
    expect(dir.calls.map((c) => c.file)).toEqual([J, P]);
    expect(dir.files.get(J)).toBe(line("u1", 1) + line("u2", 2) + line("u3", 3));
    expect(dir.files.get(P)).toBe(cell(1) + cell(2) + cell(3));
    expect(last()).toEqual({ state: "ok", queued: 0, dropped: 0 });
    expect(q.size).toBe(0);
  });

  it("a hide (flush) writes at once, without the 2 s wait", async () => {
    const q = make();
    await q.start();
    await q.add(row(1));
    await q.flush();
    expect(dir.files.get(J)).toBe(line("u1", 1));
    expect(dir.files.get(P)).toBe(cell(1));
    await vi.advanceTimersByTimeAsync(COALESCE_MS * 2);
    expect(dir.calls).toHaveLength(2);
  });

  it("a failed write leaves the lines; the next add or flush writes them, in order", async () => {
    const q = make();
    await q.start();
    dir.answer = "unavailable";
    await q.add(row(1));
    await q.flush();
    expect(dir.files.size).toBe(0);
    expect(last()).toEqual({ state: "unavailable", queued: 2, dropped: 0 });
    // no retry of its own: the timer does not come back without an add
    const calls = dir.calls.length;
    await vi.advanceTimersByTimeAsync(COALESCE_MS * 10);
    expect(dir.calls.length).toBe(calls);
    dir.answer = "appended";
    await q.add(row(2));
    expect(last()).toEqual({ state: "unavailable", queued: 4, dropped: 0 });
    await vi.advanceTimersByTimeAsync(COALESCE_MS);
    await q.idle();
    expect(dir.files.get(J)).toBe(line("u1", 1) + line("u2", 2));
    expect(dir.files.get(P)).toBe(cell(1) + cell(2));
    expect(last()).toEqual({ state: "ok", queued: 0, dropped: 0 });
  });

  it("cantAppend keeps the queue and says so; a flush later writes it", async () => {
    const q = make();
    await q.start();
    dir.answer = "cantAppend";
    await q.add(row(1));
    await q.flush();
    expect(last()).toEqual({ state: "cantAppend", queued: 2, dropped: 0 });
    expect(q.size).toBe(2);
    dir.answer = "appended";
    await q.flush();
    expect(dir.files.get(J)).toBe(line("u1", 1));
    expect(last()).toEqual({ state: "ok", queued: 0, dropped: 0 });
  });

  it("one file it cannot append to keeps its lines; the other file's lines go", async () => {
    const q = make();
    await q.start();
    dir.appendChecked = async (file, text) => {
      dir.calls.push({ file, text });
      if (file === J) return "cantAppend";
      dir.files.set(file, (dir.files.get(file) ?? "") + text);
      return "appended";
    };
    await q.add(row(1));
    await q.flush();
    expect(dir.files.get(P)).toBe(cell(1));
    expect(last()).toEqual({ state: "cantAppend", queued: 1, dropped: 0 });
  });

  it("a crash after the append and before the dequeue: the next start reads the file's end and writes each line once (G219f1)", async () => {
    const q = make();
    await q.start();
    await q.add(row(1));
    dir.afterAppend = () => (kv.frozen = true); // the append lands, the dequeue's write never does
    await q.flush();
    expect(dir.files.get(J)).toBe(line("u1", 1));
    kv.frozen = false;
    dir.afterAppend = () => {};
    const calls = dir.calls.length;
    const again = make();
    await again.start();
    await again.idle();
    expect(dir.files.get(J)).toBe(line("u1", 1));
    expect(dir.files.get(P)).toBe(cell(1));
    expect(dir.calls.length).toBe(calls); // nothing appended again
    expect(dir.tails.map((t) => t.file)).toEqual([J, P]);
    expect(again.size).toBe(0);
    expect(last()).toEqual({ state: "ok", queued: 0, dropped: 0 });
    // a line added after it goes on as usual
    await again.add(row(2));
    await again.flush();
    expect(dir.files.get(J)).toBe(line("u1", 1) + line("u2", 2));
    expect(dir.files.get(P)).toBe(cell(1) + cell(2));
  });

  it("a crash between the mark and the append: the file does not end with the lines, so they are written", async () => {
    const q = make();
    await q.start();
    await q.add(row(1));
    dir.answer = "unavailable"; // the append never lands; the mark is stored
    await q.flush();
    dir.answer = "appended";
    const again = make();
    await again.start();
    await again.idle();
    expect(dir.files.get(J)).toBe(line("u1", 1));
    expect(dir.files.get(P)).toBe(cell(1));
    expect(again.size).toBe(0);
  });

  it("a failed tail read writes the lines again, as before G219f1 (at least once): G210's reader keeps the last line of an id", async () => {
    const q = make();
    await q.start();
    await q.add(row(1));
    dir.afterAppend = () => (kv.frozen = true);
    await q.flush();
    kv.frozen = false;
    dir.afterAppend = () => {};
    dir.tailAnswer = "failed";
    const again = make();
    await again.start();
    await again.idle();
    const lines = (dir.files.get(J) ?? "").split("\n").filter((l) => l !== "");
    expect(lines).toHaveLength(2);
    const ids = lines.map((l) => (JSON.parse(l) as { id: string }).id);
    expect(ids).toEqual(["u1", "u1"]);
    // G210's reader: a repeated id that is not null, the last one wins: one row
    const rows = new Map(lines.map((l) => [(JSON.parse(l) as { id: string }).id, l]));
    expect([...rows.keys()]).toEqual(["u1"]);
    expect(dir.files.get(P)).toBe(cell(1) + cell(1));
    expect(again.size).toBe(0);
  });

  it("a cantAppend whose text did land is not written again: the next write starts after it", async () => {
    const q = make();
    await q.start();
    dir.answer = "cantAppend";
    dir.lands = true;
    await q.add(row(1));
    await q.flush();
    expect(last()).toEqual({ state: "cantAppend", queued: 2, dropped: 0 });
    dir.answer = "appended";
    dir.lands = false;
    await q.add(row(2));
    await q.flush();
    expect(dir.files.get(J)).toBe(line("u1", 1) + line("u2", 2));
    expect(dir.files.get(P)).toBe(cell(1) + cell(2));
    expect(dir.calls.slice(2)).toEqual(row(2)); // only row 2's texts went out
    expect(last()).toEqual({ state: "ok", queued: 0, dropped: 0 });
  });

  it("a cantAppend that landed with nothing new: the flush appends nothing and the queue is empty", async () => {
    const q = make();
    await q.start();
    dir.answer = "cantAppend";
    dir.lands = true;
    await q.add(row(1));
    await q.flush();
    dir.answer = "appended";
    dir.lands = false;
    await q.flush();
    expect(dir.calls).toHaveLength(2);
    expect(dir.files.get(J)).toBe(line("u1", 1));
    expect(dir.files.get(P)).toBe(cell(1));
    expect(last()).toEqual({ state: "ok", queued: 0, dropped: 0 });
  });

  it("a landed cantAppend that carried the gap mark: the mark is not written again either", async () => {
    dir.answer = "unavailable";
    const q = make();
    await q.start();
    for (let n = 1; n <= SYNC_QUEUE_CAP / 2 + 1; n++) await q.add(row(n));
    dir.answer = "cantAppend";
    dir.lands = true;
    await q.flush();
    const sent = { j: dir.files.get(J), p: dir.files.get(P) };
    expect(JSON.parse((sent.j ?? "").split("\n")[0] as string)).toMatchObject({ id: "u2", gap: 1 });
    dir.answer = "appended";
    dir.lands = false;
    await q.flush();
    expect(dir.files.get(J)).toBe(sent.j);
    expect(dir.files.get(P)).toBe(sent.p);
    expect(q.size).toBe(0);
    await q.add(row(999));
    await q.flush();
    expect(dir.files.get(J)).toBe(sent.j + line("u999", 999));
    expect(dir.files.get(P)).toBe(sent.p + cell(999));
    expect(last()).toEqual({ state: "ok", queued: 0, dropped: 2 });
  });

  it("a sent line dropped at the cap while the tail is read, and found in the file, is no gap", async () => {
    const q = make();
    await q.start();
    dir.answer = "cantAppend";
    dir.lands = true;
    await q.add([{ file: J, text: line("u0", 0) }]);
    await q.flush();
    dir.answer = "appended";
    dir.lands = false;
    let release: () => void = () => {};
    const held = new Promise<void>((r) => (release = r));
    const plain = dir.tail;
    dir.tail = async (file, n) => {
      await held;
      return plain(file, n);
    };
    const writing = q.flush();
    await vi.advanceTimersByTimeAsync(0);
    for (let n = 1; n <= SYNC_QUEUE_CAP; n++) void q.add([{ file: J, text: line(`u${n}`, n) }]);
    expect(q.status.dropped).toBe(1);
    release();
    await writing;
    dir.tail = plain;
    await q.flush();
    const lines = (dir.files.get(J) ?? "").split("\n").filter((l) => l !== "");
    expect(lines).toHaveLength(SYNC_QUEUE_CAP + 1);
    expect(lines.some((l) => "gap" in (JSON.parse(l) as object))).toBe(false);
    expect(last()).toEqual({ state: "ok", queued: 0, dropped: 0 });
  });

  it("a stored queue from before G219f1 (no sent mark) is read and written", async () => {
    await kv.set(SYNC_QUEUE_KEY, { next: 2, lines: row(1).map((t, seq) => ({ seq, ...t })), gaps: {}, dropped: 0 });
    const q = make();
    await q.start();
    await q.idle();
    expect(dir.files.get(J)).toBe(line("u1", 1));
    expect(dir.tails).toEqual([]);
  });

  it("the queue persists: a second instance reads the lines the first could not write", async () => {
    dir.answer = "unavailable";
    const q = make();
    await q.start();
    await q.add(row(1));
    await q.add(row(2));
    await q.flush();
    expect(kv.data.has(SYNC_QUEUE_KEY)).toBe(true);
    dir.answer = "appended";
    seen = [];
    const again = make();
    await again.start();
    await again.idle();
    expect(dir.files.get(J)).toBe(line("u1", 1) + line("u2", 2));
    expect(dir.files.get(P)).toBe(cell(1) + cell(2));
    expect(last()).toEqual({ state: "ok", queued: 0, dropped: 0 });
  });

  it("a line added before the stored queue is read comes after the stored lines", async () => {
    dir.answer = "unavailable";
    const q = make();
    await q.start();
    await q.add(row(1));
    dir.answer = "appended";
    const again = make();
    const started = again.start();
    void again.add(row(2));
    await started;
    await again.flush();
    expect(dir.files.get(J)).toBe(line("u1", 1) + line("u2", 2));
  });

  it(`its cap is ${2 * HISTORY_LIMIT} lines (a view's history, a .jsonl line and a .py cell per row)`, () => {
    expect(SYNC_QUEUE_CAP).toBe(2 * HISTORY_LIMIT);
  });

  it("over its cap the oldest lines are dropped, the status counts them, and the next line of the file carries gap: n", async () => {
    dir.answer = "unavailable";
    const q = make();
    await q.start();
    const rows = SYNC_QUEUE_CAP / 2 + 3;
    for (let n = 1; n <= rows; n++) await q.add(row(n));
    expect(q.size).toBe(SYNC_QUEUE_CAP);
    expect(last()).toEqual({ state: "queued", queued: SYNC_QUEUE_CAP, dropped: 6 });
    dir.answer = "appended";
    await q.flush();
    const lines = (dir.files.get(J) ?? "").split("\n").filter((l) => l !== "");
    expect(lines).toHaveLength(rows - 3);
    const first = JSON.parse(lines[0] as string) as { id: string; gap?: number };
    expect(first.id).toBe("u4");
    expect(first.gap).toBe(3);
    expect(lines[0]).toBe(line("u4", 4).replace(/}\n$/, ',"gap":3}'));
    expect(lines.slice(1).every((l) => !("gap" in (JSON.parse(l) as object)))).toBe(true);
    // the .py says it too, as a comment before its next cell
    expect((dir.files.get(P) ?? "").startsWith(`# N62: gap: 3 earlier cells were dropped\n${cell(4)}`)).toBe(true);
    expect(last()).toEqual({ state: "ok", queued: 0, dropped: 6 });
    // the mark is written once: a later line has none
    await q.add(row(99));
    await q.flush();
    const after = (dir.files.get(J) ?? "").split("\n").filter((l) => l !== "");
    expect(JSON.parse(after[after.length - 1] as string)).not.toHaveProperty("gap");
  });

  it("a dropped line whose file has no later line still leaves its mark: a line with gap alone", async () => {
    dir.answer = "unavailable";
    const q = make();
    await q.start();
    const Y = "n62-dev-2026-11-13.jsonl";
    await q.add([{ file: Y, text: line("y1", 1) }]);
    for (let n = 1; n <= SYNC_QUEUE_CAP; n++) await q.add([{ file: J, text: line(`u${n}`, n) }]);
    expect(q.size).toBe(SYNC_QUEUE_CAP);
    dir.answer = "appended";
    await q.flush();
    expect(dir.files.get(Y)).toBe('{"v":0,"gap":1}\n');
    expect((dir.files.get(J) ?? "").split("\n").filter((l) => l !== "")).toHaveLength(SYNC_QUEUE_CAP);
  });

  it("a line dropped at the cap while its append runs, and the append lands, is no gap", async () => {
    const q = make();
    await q.start();
    let release: () => void = () => {};
    const held = new Promise<void>((r) => (release = r));
    const plain = dir.appendChecked;
    dir.appendChecked = async (file, text) => {
      await held;
      return plain(file, text);
    };
    await q.add([{ file: J, text: line("u0", 0) }]);
    const writing = q.flush();
    await vi.advanceTimersByTimeAsync(0);
    for (let n = 1; n <= SYNC_QUEUE_CAP; n++) void q.add([{ file: J, text: line(`u${n}`, n) }]);
    expect(q.status.dropped).toBe(1);
    release();
    await writing;
    dir.appendChecked = plain;
    await q.flush();
    const lines = (dir.files.get(J) ?? "").split("\n").filter((l) => l !== "");
    expect(lines).toHaveLength(SYNC_QUEUE_CAP + 1);
    expect(lines.some((l) => "gap" in (JSON.parse(l) as object))).toBe(false);
    expect(last()).toEqual({ state: "ok", queued: 0, dropped: 0 });
  });

  it("the gap survives a restart until it is written", async () => {
    dir.answer = "unavailable";
    const q = make();
    await q.start();
    for (let n = 1; n <= SYNC_QUEUE_CAP / 2 + 1; n++) await q.add(row(n));
    dir.answer = "appended";
    const again = make();
    await again.start();
    await again.idle();
    const first = (dir.files.get(J) ?? "").split("\n")[0] as string;
    expect(JSON.parse(first)).toMatchObject({ id: "u2", gap: 1 });
    expect(last()).toMatchObject({ state: "ok", dropped: 2 });
  });

  it("a stored queue of the wrong shape is read as empty", async () => {
    await kv.set(SYNC_QUEUE_KEY, { lines: [{ file: 3 }], next: "x" });
    const q = make();
    await q.start();
    expect(q.size).toBe(0);
    await q.add(row(1));
    await q.flush();
    expect(dir.files.get(J)).toBe(line("u1", 1));
  });

  it("its key is per install: left out of the backup, so its lines are never written under another device's name", () => {
    expect(LEFT_OUT).toContain(SYNC_QUEUE_KEY);
  });
});
