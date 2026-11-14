// SPDX-License-Identifier: GPL-3.0-or-later
// G219: the sync queue between a finished row (sync/files.ts gives its texts) and the sync folder (appendChecked,
// clipboard/folder.ts). The rules:
// - At least once: a line is stored in the queue (the store, SYNC_QUEUE_KEY) before it is appended, and leaves it only
//   when appendChecked answers "appended". A crash between the two writes the line again at the next start: the same
//   text, so the same `id`, and G210's reader keeps the last line of an id.
// - In order: a file's lines are appended in the order they were added, in one text; a file that answers "cantAppend"
//   keeps its lines (the others go on), "unavailable" (no folder) stops the write and keeps them all. Nothing retries
//   by itself: the next add, flush or start writes again.
// - Coalesced: the first add of a burst starts a 2 s timer (an add during it does not move it); then each file gets
//   one append. A hide (flush, main.ts's pagehide and visibilitychange) writes at once.
// - Capped at SYNC_QUEUE_CAP lines: past it the oldest are dropped and counted per file; the next text written to that
//   file carries the count, so the file says it is not whole: a .jsonl line gets G210's `"gap":n`, a .py a comment
//   line before its next cell; a file with no line left gets the mark alone. The status counts every drop.
// The key is per install (state/backup.ts LEFT_OUT): a restore on another device must never write this one's lines
// under that device's name. Lazy: reached only through the sync hook (R182), never from the start chunk.
import type { CheckedAppend } from "../clipboard/folder.ts";
import { HISTORY_LIMIT } from "../state/results.ts";
import type { Kv } from "../state/storage.ts";

/** The store key of the queue (docs/04 6.2; not backed up). */
export const SYNC_QUEUE_KEY = "sync.queue";
/** Lines kept at most: a view's history (HISTORY_LIMIT rows), each row a .jsonl line and a .py cell. */
export const SYNC_QUEUE_CAP = 2 * HISTORY_LIMIT;
/** A burst of adds within this time is one append per file. */
export const COALESCE_MS = 2000;

/** One file's text to append (sync/files.ts SyncFile). */
export interface QueueText {
  readonly file: string;
  readonly text: string;
}

/** The two things the queue reaches: the checked append and the store. */
export interface SyncQueuePort {
  appendChecked(file: string, text: string): Promise<CheckedAppend>;
  kv: Kv;
}

/** `ok`: nothing waits; `queued`: lines wait for their write; `cantAppend`, `unavailable`: the last write's answer, the
 *  lines kept. `queued` counts the lines waiting, `dropped` every line dropped at the cap (this install). */
export interface SyncStatus {
  readonly state: "ok" | "queued" | "cantAppend" | "unavailable";
  readonly queued: number;
  readonly dropped: number;
}

interface Line {
  seq: number;
  file: string;
  text: string;
}
/** The stored record: the lines in order, the next seq, the drops per file not yet written, all drops. */
interface Stored {
  next: number;
  lines: Line[];
  gaps: Record<string, number>;
  dropped: number;
}

const count = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;
const isLine = (l: unknown): l is Line => {
  const o = l as Partial<Line> | null;
  return typeof o === "object" && o !== null && count(o.seq) && typeof o.file === "string" && typeof o.text === "string";
};
/** The stored record, or an empty queue for anything else (a record of the wrong shape cannot be written). */
function readStored(v: unknown): Stored {
  const o = v as Partial<Stored> | null | undefined;
  const empty: Stored = { next: 0, lines: [], gaps: {}, dropped: 0 };
  if (typeof o !== "object" || o === null || !count(o.next) || !Array.isArray(o.lines) || !o.lines.every(isLine)) return empty;
  const gaps: Record<string, number> = {};
  if (typeof o.gaps === "object" && o.gaps !== null) for (const [f, n] of Object.entries(o.gaps)) if (count(n) && n > 0) gaps[f] = n;
  return { next: o.next, lines: o.lines, gaps, dropped: count(o.dropped) ? o.dropped : 0 };
}

/** The text with the file's mark of `n` dropped lines: G210's `"gap":n` in the first .jsonl line, else a line of its
 *  own (`{"v":0,"gap":n}`, which the reader reads as a line with no result); a comment line before a .py's text. */
export function withGap(file: string, text: string, n: number): string {
  if (n <= 0) return text;
  if (file.endsWith(".py")) return `# N62: gap: ${n} earlier cells were dropped\n${text}`;
  const end = text.indexOf("\n");
  const first = end < 0 ? text : text.slice(0, end);
  if (/^\{.+\}$/.test(first) && first !== "{}") return `${first.slice(0, -1)},"gap":${n}}${text.slice(first.length)}`;
  return `{"v":0,"gap":${n}}\n${text}`;
}

export class SyncQueue {
  private lines: Line[] = [];
  private next = 0;
  private gaps: Record<string, number> = {};
  private dropped = 0;
  private failed: "cantAppend" | "unavailable" | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  /** Every store write and every append, one after another. */
  private chain: Promise<void> = Promise.resolve();

  constructor(
    private readonly port: SyncQueuePort,
    private readonly onStatus: (s: SyncStatus) => void = () => {},
  ) {
    this.chain = this.load().catch(() => {});
  }

  /** Lines waiting. */
  get size(): number {
    return this.lines.length;
  }

  get status(): SyncStatus {
    const queued = this.lines.length;
    return { state: this.failed ?? (queued || Object.keys(this.gaps).length ? "queued" : "ok"), queued, dropped: this.dropped };
  }

  /** Writes what the stored queue holds (the store is read first: the constructor started that read). */
  start(): Promise<void> {
    return this.run(async () => {
      if (this.lines.length || Object.keys(this.gaps).length) await this.write();
    });
  }

  /** Reads the stored queue: its lines come before any added while it was read. Every write waits for it. */
  private async load(): Promise<void> {
    let stored: unknown;
    try {
      stored = await this.port.kv.get(SYNC_QUEUE_KEY);
    } catch {
      stored = undefined;
    }
    const s = readStored(stored);
    const added = this.lines.map((l, i) => ({ ...l, seq: s.next + i }));
    this.lines = [...s.lines, ...added];
    this.next = s.next + added.length;
    for (const [f, n] of Object.entries(s.gaps)) this.gaps[f] = (this.gaps[f] ?? 0) + n;
    this.dropped += s.dropped;
    const over = this.lines.length - SYNC_QUEUE_CAP;
    if (over > 0) for (const l of this.lines.splice(0, over)) this.drop(l.file);
    this.report();
  }

  /** Queues one row's texts (stored before anything is appended) and starts the burst's timer. */
  add(texts: readonly QueueText[]): Promise<void> {
    for (const t of texts) this.lines.push({ seq: this.next++, file: t.file, text: t.text });
    const over = this.lines.length - SYNC_QUEUE_CAP;
    if (over > 0) for (const l of this.lines.splice(0, over)) this.drop(l.file);
    this.report();
    this.timer ??= setTimeout(() => {
      this.timer = undefined;
      void this.run(() => this.write());
    }, COALESCE_MS);
    return this.run(() => this.save());
  }

  /** Writes at once (a hide); resolves when the write is done. */
  flush(): Promise<void> {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    return this.run(() => this.write());
  }

  /** Resolves when every store write and append started so far is done. */
  idle(): Promise<void> {
    return this.run(async () => {});
  }

  private drop(file: string): void {
    this.gaps[file] = (this.gaps[file] ?? 0) + 1;
    this.dropped++;
  }

  private run(f: () => Promise<void>): Promise<void> {
    this.chain = this.chain.then(f).catch(() => {});
    return this.chain;
  }

  private report(): void {
    this.onStatus(this.status);
  }

  private save(): Promise<void> {
    const s: Stored = { next: this.next, lines: this.lines, gaps: this.gaps, dropped: this.dropped };
    return this.port.kv.set(SYNC_QUEUE_KEY, s);
  }

  /** One append per file, in the order of the files' oldest lines (a file with only a mark first: its lines were
   *  older). A file's lines leave the queue only on "appended". */
  private async write(): Promise<void> {
    const files = [...new Set([...Object.keys(this.gaps).filter((f) => !this.lines.some((l) => l.file === f)), ...this.lines.map((l) => l.file)])];
    let failed: "cantAppend" | "unavailable" | undefined;
    let changed = false;
    for (const file of files) {
      const batch = this.lines.filter((l) => l.file === file);
      const gap = this.gaps[file] ?? 0;
      const text = withGap(file, batch.map((l) => l.text).join(""), gap);
      let r: CheckedAppend;
      try {
        r = await this.port.appendChecked(file, text);
      } catch {
        r = "cantAppend";
      }
      if (r !== "appended") {
        failed = r === "unavailable" || failed === "unavailable" ? "unavailable" : "cantAppend";
        if (r === "unavailable") break;
        continue;
      }
      changed = true;
      const sent = new Set(batch.map((l) => l.seq));
      // a line of the batch dropped at the cap while it was appended is in the file after all: not a gap
      const kept = new Set(this.lines.map((l) => l.seq));
      const landed = batch.filter((l) => !kept.has(l.seq)).length;
      this.dropped -= landed;
      this.lines = this.lines.filter((l) => !sent.has(l.seq));
      const left = (this.gaps[file] ?? 0) - gap - landed;
      if (left > 0) this.gaps[file] = left;
      else delete this.gaps[file];
    }
    this.failed = failed;
    if (changed) await this.save();
    this.report();
  }
}
