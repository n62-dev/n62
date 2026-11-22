// SPDX-License-Identifier: GPL-3.0-or-later
// R128: the sync folder in the app, the port of sync/backupSync.ts: the folder (clipboard/folder.ts), the store, the
// counts and the library's export. main.ts calls `leave` on a hide and `onStart` once the history is in (Android only);
// Settings › Data › Sync folder's rows call `syncJob` (ClipActions.syncJob; R855: Choose folder looks at once). The
// start's offer is a sheet with Restore (the restore sheet's ticks and check, S6) and Not now; the silent restore
// replaces every part of the file, keeps the old records in `backup.undo`, reloads, and says so in one history line.
// Lazy: never in the start chunk.
import type { AppShell } from "../apps/shell.svelte.ts";
import { folderList, folderModel, folderName, folderRead, folderWrite, forgetFolder, pickFolder } from "../clipboard/folder.ts";
import { dataText, shownTime } from "../i18n/enData.ts";
import type { Session } from "../state/session.svelte.ts";
import { holdWrites, restoreParts } from "../state/restore.ts";
import { idbKv } from "../state/storage.ts";
import { kvGetRaw } from "../state/storageRaw.ts";
import { restoreItems } from "../views/restoreSheet.svelte.ts";
import { SyncFolder, type LeaveResult, type StartUi } from "./backupSync.ts";

/** The history line of a silent restore, kept over its reload (the page's sessionStorage). */
const NOTE = "n62.syncRestored";

type Shell = Pick<AppShell, "calc" | "showMenu" | "clip">;
let page: SyncFolder | undefined;

/** The page's one SyncFolder (it remembers what it wrote). */
function folder(session: Session, shell: Shell): SyncFolder {
  page ??= new SyncFolder({
    folder: { name: folderName, list: folderList, read: folderRead, write: folderWrite, model: folderModel },
    kv: idbKv,
    raw: kvGetRaw,
    counts: () => session.taps.counts,
    library: async () => {
      if (!shell.calc.engine) return undefined;
      try {
        const out = await (await import("../calc/library.ts")).jobs(shell.calc.engine).exportLibrary();
        return out.text.trim().split("\n").length > 1 ? out.text : undefined; // the stamp line alone: no library
      } catch {
        return undefined;
      }
    },
    now: () => new Date(),
  });
  return page;
}

/** Leaving the app: this device's files, each when it changed. Never throws. */
export function leave(session: Session, shell: Shell): Promise<LeaveResult> {
  return folder(session, shell).leave().catch(() => "failed" as const);
}

const sayer = (session: Session, shell: Shell) => (m: string): void => (shell.clip ? shell.clip.say(m) : session.note(m, [session.view]));

type Kept = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** The start: the line of a silent restore that just reloaded, then the look at the other devices' backups. `kept`:
 *  where that line waits over the reload (the page's sessionStorage; tests give a map). */
export async function onStart(session: Session, shell: Shell, kept: Kept = sessionStorage): Promise<void> {
  const said = kept.getItem(NOTE);
  if (said !== null) {
    kept.removeItem(NOTE);
    session.note(said);
  }
  await folder(session, shell).onStart(startUi(session, shell, kept));
}

/** How the look's outcome shows, for the start and for Choose folder (R855): the offer sheet (Restore, Not now), the
 *  silent restore (its line kept in `kept` over the reload), a refusal's notice. */
function startUi(session: Session, shell: Shell, kept: Kept): StartUi {
  const say = sayer(session, shell);
  return {
    offer: (from, checked) =>
      shell.showMenu(
        dataText("sync"),
        [
          { id: "from", label: dataText("sync.offer", { device: from.device, made: shownTime(from.made) }), keep: true },
          { id: "restore", label: dataText("sync.restore"), run: () => shell.showMenu(dataText("restore.title"), restoreItems(checked, say), { remember: false }) },
          { id: "later", label: dataText("sync.notNow"), run: () => {} },
        ],
        { remember: false },
      ),
    apply: async (from, checked) => {
      const release = holdWrites();
      try {
        kept.setItem(NOTE, dataText("sync.restored", { device: from.device, made: shownTime(from.made) }));
        await restoreParts(checked.parts, Date.now());
      } catch {
        release();
        kept.removeItem(NOTE);
        return say(dataText("restore.failed"));
      }
      location.reload();
    },
    refused: (from, why) => say(dataText("sync.refused", { device: from.device, why })),
  };
}

/** A row of Settings › Data › Sync folder: says its notice (and returns it). R855: a picked folder then gets the
 *  start's look at the other devices' backups at once, with the start's outcomes (the same one offer: a file the
 *  start or an earlier pick offered is marked read); the start's waiting line in `kept` is left for the start. */
export async function syncJob(job: "pick" | "now" | "stop", session: Session, shell: Shell, kept?: Kept): Promise<string> {
  const say = sayer(session, shell);
  if (job === "pick") {
    const r = await pickFolder();
    const notice = r === "cancelled" ? dataText("sync.cancelled") : r === "unavailable" ? dataText("sync.unavailable") : dataText("sync.chosen", { name: r.name });
    say(notice);
    if (typeof r === "object") await folder(session, shell).onStart(startUi(session, shell, kept ?? sessionStorage));
    return notice;
  }
  if (job === "stop") await forgetFolder();
  const notice = job === "stop" ? dataText("sync.stopped") : leaveNotice(await leave(session, shell));
  say(notice);
  return notice;
}

/** Write now's notice for what the leave did (one file in the singular, R128f1). */
export function leaveNotice(r: LeaveResult): string {
  if (typeof r === "object") return r.written === 1 ? dataText("sync.writtenOne") : dataText("sync.written", { n: r.written });
  return dataText(r === "unchanged" ? "sync.unchanged" : r === "unavailable" ? "sync.unavailable" : "sync.failed");
}
