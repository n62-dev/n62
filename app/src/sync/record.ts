// SPDX-License-Identifier: GPL-3.0-or-later
// R128: the sync folder page's own record, per install (state/backup.ts LEFT_OUT: never in a backup, so a restore on
// another device takes neither this one's name nor its choices): "On start" (offer, the default, or silent), the last
// other device's backup read on start, and the device name every file this install writes carries (sync/device.ts).
// One record, three fields (docs/04 6.2). Small: the Settings page's mode buttons write it from the Mode sheet's chunk.
import type { Kv } from "../state/storage.ts";

/** The store key (docs/04 6.2; not backed up). */
export const SYNC_KEY = "sync";
export type SyncMode = "offer" | "silent";

export interface SyncRecord {
  readonly mode?: SyncMode;
  /** The last other device's backup read on start: its file name and its envelope's `made`. */
  readonly read?: { readonly name: string; readonly made: string };
  readonly device?: string;
}

/** The record's fields that hold what they should; a missing or broken record reads as empty (a read that fails too). */
export async function readSync(kv: Kv): Promise<SyncRecord> {
  let v: unknown;
  try {
    v = await kv.get<unknown>(SYNC_KEY);
  } catch {
    return {};
  }
  if (typeof v !== "object" || v === null) return {};
  const o = v as Record<string, unknown>;
  const r = o["read"] as Record<string, unknown> | null | undefined;
  return {
    ...(o["mode"] === "offer" || o["mode"] === "silent" ? { mode: o["mode"] } : {}),
    ...(typeof r === "object" && r !== null && typeof r["name"] === "string" && typeof r["made"] === "string" ? { read: { name: r["name"], made: r["made"] } } : {}),
    ...(typeof o["device"] === "string" && o["device"] !== "" ? { device: o["device"] } : {}),
  };
}

/** One write after another, so two fields set at once both land (a read, the patch, the write). */
const chains = new WeakMap<Kv, Promise<unknown>>();

/** Sets the fields of `patch`, keeping the others. */
export function patchSync(kv: Kv, patch: SyncRecord): Promise<void> {
  const run = async (): Promise<void> => kv.set(SYNC_KEY, { ...(await readSync(kv)), ...patch });
  const next = (chains.get(kv) ?? Promise.resolve()).then(run, run);
  chains.set(kv, next.catch(() => {}));
  return next;
}

/** "On start" as stored; "offer" for anything else (the default). */
export const readMode = async (kv: Kv): Promise<SyncMode> => (await readSync(kv)).mode ?? "offer";
