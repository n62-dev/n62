// SPDX-License-Identifier: GPL-3.0-or-later
// Settings › Data › Sync folder (R128; the owner's "own Settings page", brief 2026-11-02 section 2.6): one row in Data
// (which keeps at most seven) whose level holds Choose folder (its name as the value), Status (the queue's last answer,
// R183), Device name (the name every file starts with; a tap edits it on the entry line, R183), On start (Offer, the
// default, or Restore silently: two buttons), Write now and Stop syncing, and under them the help lines. On the
// web it says "Android only" and holds nothing else. The folder's work (sync/live.ts) loads on a press, through the
// clipboard code (ClipActions.syncJob), whose notice says what happened; the writes on leave and the start's offer are
// main.ts's. Comes with the Mode sheet's chunk; the folder code and the page's record (sync/record.ts, shared with the
// sync chunk, so a chunk of its own the start would name) stay out of it, read on the level's first draw.
import type { MenuItem } from "../apps/types.ts";
import { dataText } from "../i18n/enData.ts";
import { idbKv, type Kv } from "../state/storage.ts";
import type { SyncStatus } from "../sync/queue.ts";
import type { SyncMode } from "../sync/record.ts";
import { askName } from "./presetsView.svelte.ts";
import type { SettingsEnv } from "./yourKeys.ts";

const MODES: readonly SyncMode[] = ["offer", "silent"];
const MODE_TEXT = { offer: "sync.mode.offer", silent: "sync.mode.silent" } as const;

/** What the level reads: the platform, the store, and the kept folder's name (null: none). Tests give their own. */
export interface SyncDeps {
  readonly native: boolean;
  readonly kv: Kv;
  folderName(): Promise<string | null>;
  /** The file names in the kept folder, listed as the sync code lists them (none when no folder is chosen). */
  fileNames(): Promise<string[]>;
}

const isNative = (): boolean => (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() === true;
const live = (): SyncDeps => ({
  native: isNative(),
  kv: idbKv,
  folderName: async () => {
    const r = await (await import("../clipboard/folder.ts")).folderName();
    return r === "unavailable" ? null : r.name;
  },
  fileNames: async () => {
    const r = await (await import("../clipboard/folder.ts")).folderList();
    return r === "unavailable" ? [] : r.map((f) => f.name);
  },
});

/** The queue's answer as the Status row says it. */
function statusText(s: SyncStatus | undefined): string {
  if (s === undefined || s.state === "ok") return dataText("sync.status.ok");
  return s.state === "queued" ? dataText("sync.status.queued", { n: s.queued }) : dataText(s.state === "cantAppend" ? "sync.status.cantAppend" : "sync.status.unavailable");
}

/** The level's rows on Android: the folder's name and the mode are read on its first draw (undefined until then). */
function rows(env: SettingsEnv, deps: SyncDeps): { items: () => MenuItem[] } {
  let folder = $state<string | null | undefined>(undefined);
  let mode = $state<SyncMode>("offer");
  let device = $state<string | undefined>(undefined); // the kept name (undefined: none made yet)
  let status = $state<SyncStatus | undefined>(undefined);
  let read = false;
  const setMode = (m: SyncMode): void => {
    mode = m;
    void import("../sync/record.ts").then((r) => r.patchSync(deps.kv, { mode: m }));
  };
  // A tap on Device name: the name is typed on the entry line (as a preset's is) and kept sanitised, as a made one is.
  // R183f1: when the edit is saved the folder's file names are read and a name another device's files carry is refused
  // (sync/device.ts renameDevice): the row shows the name kept, the notice says which.
  const rename1 = async (typed: string): Promise<void> => {
    const d = await import("../sync/device.ts");
    const kept = await d.renameDevice(deps.kv, typed, await deps.fileNames().catch(() => []));
    device = kept === "" ? undefined : kept;
    const refused = kept !== d.deviceSlug(typed);
    env.data?.((c) => c.say(refused ? dataText("sync.device.taken", { name: d.deviceSlug(typed) }) : dataText("sync.device.said", { name: kept })));
  };
  const rename = (): void => {
    const kept = (): string => device ?? dataText("sync.device.none");
    askName(
      env,
      device ?? "",
      (typed) => {
        if (typed.trim() === "") return; // a blank edit keeps the name
        void rename1(typed);
      },
      () => dataText("sync.device.said", { name: kept() }),
      dataText("sync.device"),
    );
  };
  const job = (j: "pick" | "now" | "stop"): void => env.data?.((c) => c.syncJob(j));
  const items = (): MenuItem[] => {
    if (!read) {
      read = true;
      void deps.folderName().then((n) => (folder = n), () => (folder = null));
      void import("../sync/record.ts").then((r) => r.readSync(deps.kv)).then((r) => {
        mode = r.mode ?? "offer";
        device = r.device;
      });
      void import("../sync/status.ts").then((m) => {
        status = m.lastStatus();
        m.watchStatus((s) => (status = s));
      });
    }
    return [
      {
        id: "choose",
        label: dataText("sync.choose"),
        hint: dataText("sync.choose.hint"),
        get value() {
          return folder === undefined ? "" : (folder ?? dataText("sync.noFolder"));
        },
        run: () => job("pick"),
      },
      {
        id: "status",
        label: dataText("sync.status"),
        get value() {
          return statusText(status);
        },
      },
      {
        id: "device",
        label: dataText("sync.device"),
        get value() {
          return device ?? dataText("sync.device.none");
        },
        run: rename,
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
        note: () => `${dataText("sync.line")} ${dataText("sync.jupyter")}`,
        get items() {
          return r.items();
        },
      };
    },
  };
}
