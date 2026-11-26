// SPDX-License-Identifier: GPL-3.0-or-later
// R871 (owner, 2026-11-22): Settings › Numbers › Fmt key cycle › "Say the format on each Fmt press", off by default. Kept as
// R194's word is (wordStore.svelte.ts): one stamped record of its own under `fmtSay` (a boolean), never a field of the settings
// (their schema and the start chunk stay as they are), read lazily (cycleForms.ts and the Mode sheet's chunk load this module),
// and a part of the backup (backup.ts BACKUP_KEYS).
import { idbKv, type Kv } from "./storage.ts";

/** The key of the stamped store (state/storage.ts) that holds the switch. */
export const FMT_SAY_KEY = "fmtSay";

export class FmtSayStore {
  /** The switch: off until a read finds it on or the row sets it. */
  private current = $state(false);
  private readonly kv: Kv;
  private restoring: Promise<void> | undefined;
  /** A set ran: a read that finishes after it assigns nothing. */
  private wasSet = false;

  constructor(kv: Kv) {
    this.kv = kv;
  }

  get on(): boolean {
    return this.current;
  }

  /** Read the stored record (once); anything but `true` is off. */
  restore(): Promise<void> {
    this.restoring ??= this.kv.get<unknown>(FMT_SAY_KEY).then((v) => {
      if (!this.wasSet) this.current = v === true;
    });
    return this.restoring;
  }

  /** Set the switch (its row); a read still running does not undo it. */
  set(on: boolean): void {
    this.restoring ??= Promise.resolve();
    this.wasSet = true;
    this.current = on;
    void this.kv.set(FMT_SAY_KEY, on);
  }
}

/** The session's switch, on the app's store. */
export const fmtSay = new FmtSayStore(idbKv);
