// SPDX-License-Identifier: GPL-3.0-or-later
// Settings › Data › Sync folder (R128; the owner's "own Settings page", brief 2026-11-02 section 2.6): one row in Data
// (which keeps at most seven) whose level holds Choose folder (its name as the value), On start (Offer, the default, or
// Restore silently: two buttons), Write now and Stop syncing, and under them one line on which files are kept. On the
// web it says "Android only" and holds nothing else. The folder's work (sync/live.ts) loads on a press, through the
// clipboard code (ClipActions.syncJob), whose notice says what happened; the writes on leave and the start's offer are
// main.ts's. Comes with the Mode sheet's chunk; the folder code stays out of it (read on the level's first draw).
import type { MenuItem } from "../apps/types.ts";
import { dataText } from "../i18n/enData.ts";
import { idbKv, type Kv } from "../state/storage.ts";
import { patchSync, readMode, type SyncMode } from "../sync/record.ts";
import type { SettingsEnv } from "./yourKeys.ts";

const MODES: readonly SyncMode[] = ["offer", "silent"];
const MODE_TEXT = { offer: "sync.mode.offer", silent: "sync.mode.silent" } as const;

/** What the level reads: the platform, the store, and the kept folder's name (null: none). Tests give their own. */
export interface SyncDeps {
  readonly native: boolean;
  readonly kv: Kv;
  folderName(): Promise<string | null>;
}

const isNative = (): boolean => (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() === true;
const live = (): SyncDeps => ({
  native: isNative(),
  kv: idbKv,
  folderName: async () => {
    const r = await (await import("../clipboard/folder.ts")).folderName();
    return r === "unavailable" ? null : r.name;
  },
});

/** The level's rows on Android: the folder's name and the mode are read on its first draw (undefined until then). */
function rows(env: SettingsEnv, deps: SyncDeps): { items: () => MenuItem[] } {
  let folder = $state<string | null | undefined>(undefined);
  let mode = $state<SyncMode>("offer");
  let read = false;
  const setMode = (m: SyncMode): void => {
    mode = m;
    void patchSync(deps.kv, { mode: m });
  };
  const job = (j: "pick" | "now" | "stop"): void => env.data?.((c) => c.syncJob(j));
  const items = (): MenuItem[] => {
    if (!read) {
      read = true;
      void deps.folderName().then((n) => (folder = n), () => (folder = null));
      void readMode(deps.kv).then((m) => (mode = m));
    }
    return [
      {
        id: "choose",
        label: dataText("sync.choose"),
        get value() {
          return folder === undefined ? "" : (folder ?? dataText("sync.noFolder"));
        },
        run: () => job("pick"),
      },
      {
        id: "mode",
        label: dataText("sync.mode"),
        keep: true,
        options: MODES.map((m) => ({
          id: m,
          label: dataText(MODE_TEXT[m]),
          get selected() {
            return mode === m;
          },
          run: () => setMode(m),
        })),
        adjust: () => setMode(mode === "offer" ? "silent" : "offer"),
      },
      { id: "now", label: dataText("sync.now"), run: () => job("now") },
      {
        id: "stop",
        label: dataText("sync.stop"),
        run: () => {
          folder = null;
          job("stop");
        },
      },
    ];
  };
  return { items };
}

/** Data's "Sync folder ›" row. Each open of the level reads the folder's name and the mode again. */
export function syncSection(env: SettingsEnv, deps: () => SyncDeps = live): MenuItem {
  const title = dataText("sync");
  return {
    id: "sync",
    label: title,
    get submenu() {
      const d = deps();
      if (!d.native) return { title, remember: false, items: [{ id: "web", label: dataText("sync.web"), keep: true }] };
      const r = rows(env, d);
      return {
        title,
        remember: false,
        longPreview: true,
        note: () => dataText("sync.line"),
        get items() {
          return r.items();
        },
      };
    },
  };
}
