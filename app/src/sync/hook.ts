// SPDX-License-Identifier: GPL-3.0-or-later
// R128: the seam main.ts reaches for the sync folder, once the history is in: a chunk with no imports of its own, so the
// start chunk names this one file, not the list of sync/live.ts's chunks (the backup, the restore, the folder port). On
// the web (no folder can be chosen there) it does nothing and live.ts never loads.
// R182: the hook of the sync queue sits here too, so neither the session nor main.ts (the start chunk) gains a line:
// every finished row ends in `session.saveHistory()` (submit's end, the Ans-too-long line, units/row.ts putRow, which
// puts a later result of a unit visit in its row's place), so the hook wraps that call and hands each row finished in
// this page, once, to the feed (sync/feed.ts: the files' texts, the queue). With no folder chosen (the plugin's
// folderName) nothing is handed and the feed's chunk is never loaded. A hide flushes the queue.
import type { AppShell } from "../apps/shell.svelte.ts";
import type { HistoryItem, Session } from "../state/session.svelte.ts";

type Shell = Pick<AppShell, "calc" | "showMenu" | "clip">;
/** What the hook hands rows to (sync/feed.ts SyncFeed). */
export interface Feed {
  add(row: HistoryItem, now: Date): Promise<void>;
  flush(): Promise<void>;
}
/** The hook's ports: whether a folder is chosen, and the feed (its chunk loaded at the first need). */
export interface FeedPorts {
  chosen(): Promise<boolean>;
  feed(): Promise<Feed>;
}
const ports: FeedPorts = {
  chosen: () => import("../clipboard/folder.ts").then((m) => m.folderName()).then((r) => r !== "unavailable"),
  feed: () => import("./feed.ts").then((m) => m.pageFeed()),
};

const native = (): boolean => (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() === true;
const live = (run: (m: typeof import("./live.ts")) => Promise<unknown>): void => void import("./live.ts").then(run).catch(() => {});
/** When this page started: a row that finished before it (a restored one) is not handed again. */
const pageStart = Date.now() - performance.now();

/** Called once the history is in: the other devices' backups are looked at (sync/live.ts onStart), from now on each
 *  finished row goes to the sync queue (a folder chosen), and each hide flushes the queue and writes this device's
 *  files (sync/live.ts leave), after main.ts's own hide handler has flushed the store. */
export function start(session: Session, shell: Shell, doc: Document = document, android: boolean = native(), p: FeedPorts = ports): void {
  if (!android) return;
  live((m) => m.onStart(session, shell));
  const flush = hookRows(session, p);
  doc.addEventListener("visibilitychange", () => {
    if (!doc.hidden) return;
    void flush();
    live((m) => m.leave(session, shell));
  });
}

/** The row's line is worked out from what it is now: a later change (the Format key) is not a new result. */
const copy = (row: HistoryItem): HistoryItem => JSON.parse(JSON.stringify(row)) as HistoryItem;

/** Hooks `session.saveHistory`; returns the flush of a hide. Each row done or in error that finished in this page is
 *  handed once per result (its uid, finish time and text: a unit row's later result is a new line with the same id). */
export function hookRows(session: Session, p: FeedPorts): () => Promise<void> {
  const handed = new Set<string>();
  let feed: Promise<Feed> | undefined;
  let chain: Promise<unknown> = Promise.resolve();
  const loadFeed = (): Promise<Feed> => {
    const f = (feed ??= p.feed());
    f.catch(() => (feed = undefined)); // (a chunk that will not load: tried again by the next row)
    return f;
  };
  const scan = (): void => {
    const now = new Date();
    for (const row of [...session.home, ...session.cas]) {
      if ((row.status !== "done" && row.status !== "error") || row.uid === undefined || row.at === undefined || row.at < pageStart) continue;
      const key = `${row.uid} ${row.at} ${row.status} ${row.text}`;
      if (handed.has(key)) continue;
      handed.add(key);
      const r = copy(row);
      chain = chain.then(async () => (await p.chosen()) && (await loadFeed()).add(r, now)).catch(() => {});
    }
  };
  const save = session.saveHistory.bind(session);
  session.saveHistory = (): void => {
    save();
    scan();
  };
  scan(); // rows finished before the hook (a quick Enter while the history was read)
  // a folder chosen: the queue's stored lines (a hide or a kill before their write) go out now
  chain = chain.then(async () => (await p.chosen()) && loadFeed()).catch(() => {});
  return () => (chain = chain.then(() => feed?.then((f) => f.flush())).catch(() => {})).then(() => {});
}
