// SPDX-License-Identifier: GPL-3.0-or-later
// bu hunt (night review 2026-11-16), finding bu-6: the page keeps one SyncFolder (sync/live.ts:22-41), whose `written`
// map remembers, per file name, the text it last wrote (sync/backupSync.ts:60-61, :113-120). Choose folder (or Stop syncing
// and Choose folder) in the same session points the port at another folder (sync/live.ts:91-99), but the map is kept:
// the next leave, and Write now, find every file "unchanged" and write nothing into the new folder.
// The folder port is a map swapped under the same SyncFolder, as pickFolder swaps the folder under folderList/folderWrite.
// Run: env -C <review worktree>/app npx vitest run --config <probes>/bu/vitest.config.mts --silent=false new-folder
import type { FolderFile, ReadResult, WriteResult } from "../../../../app/src/clipboard/folder.ts";
import { DATA_VERSION } from "../../../../app/src/state/storage.ts";
import type { RawRecord } from "../../../../app/src/state/storageRaw.ts";
import { SyncFolder, type FolderPort } from "../../../../app/src/sync/backupSync.ts";
import { memKv } from "../../../../app/src/sync/fakeFolder.ts";

const folders: Record<string, Map<string, string>> = { X: new Map(), Y: new Map() };
let chosen = "X";
const dir: FolderPort = {
  name: async () => ({ name: chosen }),
  list: async (): Promise<FolderFile[]> => [...folders[chosen]!].map(([name, text]) => ({ name, size: text.length, modified: 0 })),
  read: async (name): Promise<ReadResult> => (folders[chosen]!.has(name) ? { text: folders[chosen]!.get(name)! } : "missing"),
  write: async (name, text): Promise<WriteResult> => void folders[chosen]!.set(name, text) || "written",
  model: async () => "Phone",
};
const store = new Map<string, RawRecord>([["settings", { "@n62": DATA_VERSION, value: { digits: 12 } }]]);

test("a second folder chosen in the same session", async () => {
  const page = new SyncFolder({ folder: dir, kv: memKv(), raw: async (k) => store.get(k), counts: () => undefined, library: async () => "// n62 library 1\nf(x):=x^2\n", now: () => new Date("2026-11-16T09:00:00Z") });
  console.log("leave into X:", JSON.stringify(await page.leave()), [...folders.X!.keys()]);
  chosen = "Y"; // Choose folder: another folder
  console.log("leave into Y:", JSON.stringify(await page.leave()), [...folders.Y!.keys()]);
  console.log("Write now into Y:", JSON.stringify(await page.leave()), [...folders.Y!.keys()]);
});
