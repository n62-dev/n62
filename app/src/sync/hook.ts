// SPDX-License-Identifier: GPL-3.0-or-later
// R128: the seam main.ts reaches for the sync folder, once the history is in: a chunk with no imports of its own, so the
// start chunk names this one file, not the list of sync/live.ts's chunks (the backup, the restore, the folder port). On
// the web (no folder can be chosen there) it does nothing and live.ts never loads. R182's hook may join here.
import type { AppShell } from "../apps/shell.svelte.ts";
import type { Session } from "../state/session.svelte.ts";

type Shell = Pick<AppShell, "calc" | "showMenu" | "clip">;

const native = (): boolean => (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() === true;
const live = (run: (m: typeof import("./live.ts")) => Promise<unknown>): void => void import("./live.ts").then(run).catch(() => {});

/** Called once the history is in: the other devices' backups are looked at (sync/live.ts onStart), and from now on each
 *  hide writes this device's files (sync/live.ts leave), after main.ts's own hide handler has flushed the store. */
export function start(session: Session, shell: Shell, doc: Document = document, android: boolean = native()): void {
  if (!android) return;
  live((m) => m.onStart(session, shell));
  doc.addEventListener("visibilitychange", () => doc.hidden && live((m) => m.leave(session, shell)));
}
