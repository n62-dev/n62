// SPDX-License-Identifier: GPL-3.0-or-later
// R128: the backup through the sync folder (owner brief 2026-11-02 sections 2.6 and 3, decisions.md S6). Leaving the app
// writes this device's backup (as Save makes it), its library file and its counts export, each only when it changed
// since the last write, each under this device's name (`n62-<device>-…`, sync/device.ts): two devices in one folder
// never write one name, and a device never writes a name it did not make. On start the other devices' backups are
// looked at, the newest by the envelope's `made`; one newer than the last one read, newer than this device's own file
// there and not holding this device's own parts (R128f1: else it is marked read and nothing shows), is offered (the
// default), or with "Restore silently" applied whole, but only while this device's own backup in the folder holds its state as it is (the
// last leave wrote it), so what it replaces is in the folder and in `backup.undo`; else it is offered. A file the check
// refuses is never applied and the notice says why. Nothing writes while no folder is chosen; there is no reminder.
// Pure but for its port (live.ts gives the real one). Lazy: never in the start chunk.
import type { FolderFile, ReadResult, Unavailable, WriteResult } from "../clipboard/folder.ts";
import { checkBackup, makeBackup, MAX_BACKUP_BYTES, type CheckedBackup, type RawReader } from "../state/backup.ts";
import { countsText } from "../state/countsFile.ts";
import type { Kv } from "../state/storage.ts";
import type { TapCounts } from "../state/taps.svelte.ts";
import { deviceName } from "./device.ts";
import { patchSync, readMode, readSync } from "./record.ts";

/** The folder calls the sync code makes (clipboard/folder.ts in the app; a map in the tests). */
export interface FolderPort {
  name(): Promise<{ name: string } | Unavailable>;
  list(): Promise<FolderFile[] | Unavailable>;
  read(name: string): Promise<ReadResult>;
  write(name: string, text: string): Promise<WriteResult>;
  model(): Promise<string | Unavailable>;
}

/** What the writes read: the folder, the store, the counts and the library's export text (undefined: none). */
export interface SyncHost {
  readonly folder: FolderPort;
  readonly kv: Kv;
  readonly raw: RawReader;
  counts(): TapCounts | undefined;
  library(): Promise<string | undefined>;
  now(): Date;
  random?(): number;
}

/** The three files a device writes, by part. */
export const PARTS = ["backup.json", "counts.json", "library.txt"] as const;
export type Part = (typeof PARTS)[number];
export const fileOf = (device: string, part: Part): string => `n62-${device}-${part}`;
const BACKUP_FILE = /^n62-(.+)-backup\.json$/;

/** What a leave did: wrote `n` files, found nothing changed, had no folder, or a write failed. */
export type LeaveResult = { written: number } | "unchanged" | "unavailable" | "failed";

/** A backup file's parts as one text, the compare key: two backups of the same data differ only in `made`. */
function partsKey(text: string): string | undefined {
  try {
    const parts = (JSON.parse(text) as { parts?: unknown }).parts;
    return typeof parts === "object" && parts !== null ? JSON.stringify(parts) : undefined;
  } catch {
    return undefined;
  }
}

/** One device's writes and start look; live.ts keeps one per page. */
export class SyncFolder {
  /** Per file name: the compare key of the text this page last wrote there, or found there. */
  private readonly written = new Map<string, string>();
  private running: Promise<LeaveResult> | undefined;
  private readonly host: SyncHost;

  constructor(host: SyncHost) {
    this.host = host;
  }

  /** The kept device name, made and kept at the first need (with a folder: never a name a file there starts with). */
  private device(list: readonly FolderFile[]): Promise<string> {
    const model = async (): Promise<string | undefined> => {
      const m = await this.host.folder.model();
      return m === "unavailable" ? undefined : m;
    };
    return deviceName(this.host.kv, model, this.host.random ?? Math.random, list.map((f) => f.name));
  }

  /** Leaving the app (and Write now): at most one run at a time; a call while one runs gets that run. */
  leave(): Promise<LeaveResult> {
    this.running ??= this.write().finally(() => (this.running = undefined));
    return this.running;
  }

  private async write(): Promise<LeaveResult> {
    const { folder } = this.host;
    if ((await folder.name()) === "unavailable") return "unavailable";
    const list = await folder.list();
    if (list === "unavailable") return "unavailable";
    const device = await this.device(list);
    const there = new Set(list.map((f) => f.name));
    let written = 0;
    // one file at a time, the backup first: the library's export waits for the engine
    const texts: Record<Part, () => Promise<{ text: string; key: string } | undefined>> = {
      "backup.json": async () => {
        const b = await makeBackup(this.host.raw, this.host.now());
        return { text: JSON.stringify(b), key: JSON.stringify(b.parts) };
      },
      "counts.json": async () => {
        const c = this.host.counts();
        if (!c || c.presses === 0) return undefined;
        const text = countsText(c);
        return { text, key: text };
      },
      "library.txt": async () => {
        const text = await this.host.library();
        return text === undefined ? undefined : { text, key: text };
      },
    };
    for (const part of PARTS) {
      const t = await texts[part]();
      if (!t) continue;
      const name = fileOf(device, part);
      if (!this.written.has(name) && there.has(name)) {
        const r = await folder.read(name);
        if (typeof r === "object") {
          const key = part === "backup.json" ? partsKey(r.text) : r.text;
          if (key !== undefined) this.written.set(name, key);
        }
      }
      if (this.written.get(name) === t.key) continue;
      const w = await folder.write(name, t.text);
      if (w === "unavailable") return "unavailable";
      if (w === "failed") return "failed";
      this.written.set(name, t.key);
      written++;
    }
    return written === 0 ? "unchanged" : { written };
  }

  /** The start's look at the other devices' backups (see the header); `ui` shows the outcome. */
  async onStart(ui: StartUi): Promise<StartResult> {
    const { folder, kv } = this.host;
    if ((await folder.name()) === "unavailable") return "none";
    const list = await folder.list();
    if (list === "unavailable") return "none";
    const device = await this.device(list);
    const own = fileOf(device, "backup.json");
    let newest: { name: string; device: string; made: string; text: string } | undefined;
    for (const f of list) {
      const m = BACKUP_FILE.exec(f.name);
      if (!m || f.name === own || f.size > MAX_BACKUP_BYTES) continue; // a file too big for the check is never read
      const r = await folder.read(f.name);
      if (typeof r !== "object") continue;
      let made: unknown;
      try {
        made = (JSON.parse(r.text) as { made?: unknown }).made;
      } catch {
        continue; // no envelope: nothing to rank it by
      }
      if (typeof made !== "string" || Number.isNaN(Date.parse(made))) continue;
      if (!newest || Date.parse(made) > Date.parse(newest.made)) newest = { name: f.name, device: m[1] as string, made, text: r.text };
    }
    if (!newest) return "none";
    const last = (await readSync(kv)).read;
    if (last !== undefined && Date.parse(newest.made) <= Date.parse(last.made)) return "none";
    // read now, whatever comes of it: Not now (or a refusal) asks again only for a newer file, never a reminder
    await patchSync(kv, { read: { name: newest.name, made: newest.made } });
    const mine = await this.ownBackup(own, list);
    // R128f1: made no later than this device's own file: older than the work it left there; never over it
    if (mine?.made !== undefined && Date.parse(newest.made) <= Date.parse(mine.made)) return "none";
    const now = JSON.stringify((await makeBackup(this.host.raw, this.host.now())).parts);
    if (partsKey(newest.text) === now) return "none"; // R128f1: this device's own parts (another device restored them)
    const checked = checkBackup(new TextEncoder().encode(newest.text));
    const from: OtherBackup = { name: newest.name, device: newest.device, made: newest.made };
    if (!checked.ok) {
      ui.refused(from, checked.message);
      return "refused";
    }
    if ((await readMode(kv)) === "silent" && mine?.key === now) {
      await ui.apply(from, checked);
      return "applied";
    }
    ui.offer(from, checked);
    return "offered";
  }

  /** This device's own backup in the folder: its envelope's `made` (when a time) and its compare key. The silent restore
   *  runs only while that key is the store's records as they are now (the last leave wrote them). */
  private async ownBackup(own: string, list: readonly FolderFile[]): Promise<{ made?: string; key?: string } | undefined> {
    if (!list.some((f) => f.name === own)) return undefined;
    const r = await this.host.folder.read(own);
    if (typeof r !== "object") return undefined;
    let made: unknown;
    try {
      made = (JSON.parse(r.text) as { made?: unknown }).made;
    } catch {
      return undefined;
    }
    const key = partsKey(r.text);
    return { ...(typeof made === "string" && !Number.isNaN(Date.parse(made)) ? { made } : {}), ...(key !== undefined ? { key } : {}) };
  }
}

/** Another device's backup file: its name, the device part of it and the envelope's `made`. */
export interface OtherBackup {
  readonly name: string;
  readonly device: string;
  readonly made: string;
}
export type StartResult = "none" | "offered" | "applied" | "refused";
/** How the start's outcome shows: the notice with Restore and Not now, the silent restore, a refusal's notice. */
export interface StartUi {
  offer(from: OtherBackup, checked: CheckedBackup): void;
  apply(from: OtherBackup, checked: CheckedBackup): Promise<void>;
  refused(from: OtherBackup, message: string): void;
}
