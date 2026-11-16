// SPDX-License-Identifier: GPL-3.0-or-later
// R182: from a finished row to the sync queue: the texts sync/files.ts gives it (the device's `.jsonl` line and `.py`
// cell, G218), added to the page's one SyncQueue (G219) in the order the rows finished. The device's name is read (or
// made) at the first row. Lazy: loaded by sync/hook.ts only when a folder is chosen, never in the start chunk.
import { appendChecked, folderList, folderModel, folderTail } from "../clipboard/folder.ts";
import type { HistoryItem } from "../state/session.svelte.ts";
import { idbKv } from "../state/storage.ts";
import { deviceName } from "./device.ts";
import { filesFor, syncFilesState, type SyncFilesState } from "./files.ts";
import { SyncQueue, type SyncQueuePort, type SyncStatus } from "./queue.ts";
import { reportStatus } from "./status.ts";

/** The queue's port, and what the files' names need: the folder's file names (a new device name is none of them),
 *  the device's model, the app's version and when this process started. */
export interface FeedPort extends SyncQueuePort {
  names(): Promise<readonly string[]>;
  model(): Promise<string | undefined>;
  readonly app: string;
  readonly start: Date;
}

export class SyncFeed {
  readonly queue: SyncQueue;
  private state: SyncFilesState;
  private taken: Promise<readonly string[]> | undefined;
  private chain: Promise<void> = Promise.resolve();

  constructor(
    private readonly port: FeedPort,
    onStatus?: (s: SyncStatus) => void,
  ) {
    this.queue = new SyncQueue(port, onStatus);
    this.state = syncFilesState(port.app, port.start);
    void this.queue.start(); // what a hide or a kill left in the stored queue
  }

  /** Queues the row's texts, handed over `now` (the line's `t`, the files' date); rows go in in the order given. */
  add(row: HistoryItem, now: Date): Promise<void> {
    this.chain = this.chain
      .then(async () => {
        const r = filesFor(row, this.state, await this.name(), now);
        this.state = r.state;
        if (r.files.length) await this.queue.add(r.files);
      })
      .catch(() => {});
    return this.chain;
  }

  /** A hide: the rows handed so far are written at once. */
  flush(): Promise<void> {
    return this.chain.then(() => this.queue.flush());
  }

  private name(): Promise<string> {
    const taken = (this.taken ??= this.port.names());
    taken.catch(() => (this.taken = undefined)); // (tried again by the next row)
    return taken.then((names) => deviceName(this.port.kv, () => this.port.model(), Math.random, names)); // the kept name, read each time: an edit counts from the next row
  }
}

let page: Promise<SyncFeed> | undefined;
/** The page's one feed, on the chosen folder and the store. */
export function pageFeed(): Promise<SyncFeed> {
  page ??= import("virtual:about").then(
    (about) =>
      new SyncFeed({
        appendChecked: (file, text) => appendChecked(file, text),
        tail: (file, n) => folderTail(file, n),
        kv: idbKv,
        names: async () => {
          const l = await folderList();
          return l === "unavailable" ? [] : l.map((f) => f.name);
        },
        model: async () => {
          const m = await folderModel();
          return m === "unavailable" ? undefined : m;
        },
        app: about.default.version,
        start: new Date(Date.now() - performance.now()),
      }, reportStatus),
  );
  page.catch(() => (page = undefined));
  return page;
}
