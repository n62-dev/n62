// SPDX-License-Identifier: GPL-3.0-or-later
// bu hunt (night review 2026-11-16), finding bu-1: Settings › Data › Sync folder › On start: Restore silently
// (sync/backupSync.ts:131-170) ranks the other devices' backups by `made` alone, so a device set up fresh on the same
// folder, whose first leave writes a backup with an empty history, is "newer" than the used device's, and the used
// device applies it whole on its next start. Then its own leave overwrites its own file in the folder with that state,
// so the header's "what it replaces is in the folder" (backupSync.ts:7-8) holds only until that leave.
// The folder is a map as in backupSync.test.ts; `apply` does what live.ts does with the parts (restoreParts: each part
// replaces the stored key). Run:
//   env -C <review worktree>/app npx vitest run --config <probes>/bu/vitest.config.mts --silent=false silent-fresh
import type { FolderFile, ReadResult, WriteResult } from "../../../../app/src/clipboard/folder.ts";
import { DATA_VERSION } from "../../../../app/src/state/storage.ts";
import type { RawRecord } from "../../../../app/src/state/storageRaw.ts";
import { SyncFolder, type FolderPort, type StartUi } from "../../../../app/src/sync/backupSync.ts";
import { memKv } from "../../../../app/src/sync/fakeFolder.ts";
import { SYNC_KEY } from "../../../../app/src/sync/record.ts";

const files = new Map<string, string>();
const dir: FolderPort = {
  name: async () => ({ name: "Sync" }),
  list: async (): Promise<FolderFile[]> => [...files].map(([name, text]) => ({ name, size: text.length, modified: 0 })),
  read: async (name): Promise<ReadResult> => (files.has(name) ? { text: files.get(name)! } : "missing"),
  write: async (name, text): Promise<WriteResult> => void files.set(name, text) || "written",
  model: async () => "Phone",
};
const rec = (value: unknown): RawRecord => ({ "@n62": DATA_VERSION, value });
const row = (id: number, latex: string, text: string) => ({ id, uid: `r${id}`, view: "home", latex, status: "done", text, approximate: false });

function device(store: Map<string, RawRecord>, model: string, at: string) {
  return { store, host: { folder: { ...dir, model: async () => model }, kv: memKv(), raw: async (k: string) => store.get(k), counts: () => undefined, library: async () => undefined, now: () => new Date(at) } };
}

test("a fresh device's first backup is applied silently over a used device's history", async () => {
  // A: used for weeks, Restore silently chosen
  const a = device(new Map([["settings", rec({ digits: 12 })], ["history", rec({ home: [row(1, "2+2", "4"), row(2, "17\\cdot3", "51")], cas: [] })]]), "Phone", "2026-11-16T08:00:00Z");
  await a.host.kv.set(SYNC_KEY, { mode: "silent" });
  console.log("A leave:", JSON.stringify(await new SyncFolder(a.host).leave()));
  // B: just installed, folder chosen, nothing typed yet; its first hide writes its backup (an empty history)
  const b = device(new Map([["settings", rec({ digits: 12 })], ["history", rec({ home: [], cas: [] })]]), "Tablet", "2026-11-16T09:00:00Z");
  console.log("B leave:", JSON.stringify(await new SyncFolder(b.host).leave()));
  // A starts again: live.ts apply = restoreParts(checked.parts): each part replaces A's key
  const shown: string[] = [];
  const ui: StartUi = {
    offer: (f) => void shown.push(`offer ${f.device}`),
    apply: async (f, checked) => {
      shown.push(`apply ${f.device}`);
      for (const [k, v] of Object.entries(checked.parts)) a.store.set(k, rec(v));
    },
    refused: (f, why) => void shown.push(`refused ${f.device}: ${why}`),
  };
  console.log("A start:", await new SyncFolder(a.host).onStart(ui), shown);
  console.log("A's history now:", JSON.stringify(a.store.get("history")?.value));
  // A's next hide: its own file in the folder
  console.log("A leave:", JSON.stringify(await new SyncFolder(a.host).leave()));
  const own = [...files.keys()].find((n) => n.startsWith("n62-Phone-") && n.endsWith("-backup.json"))!;
  console.log(`folder ${own} history:`, JSON.stringify((JSON.parse(files.get(own)!) as { parts: { history: RawRecord } }).parts.history.value));
});
