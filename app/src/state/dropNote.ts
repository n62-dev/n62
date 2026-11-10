// SPDX-License-Identifier: GPL-3.0-or-later
// R272 (night review 2026-11-09, fh-13): the first time a view's history drops its oldest row (past HISTORY_LIMIT) the app
// says so once, in one note row, and points to Settings › Backup. The flag is per install: it is in the store, and
// stays out of the backup (state/backup.ts LEFT_OUT), so a restore on a new install says it once more. A lazy chunk
// (the session imports it at the first drop of a session), so the start chunk carries neither the words nor this code.
import { dataText } from "../i18n/enData.ts";
import type { Kv } from "./storage.ts";

export const HISTORY_DROP_NOTED = "historyDropNoted";

const asked = new WeakSet<Kv>();

/** Called at every trim with the items it took off the list (notes are no rows). The first call per store (a session's)
 *  that dropped a row reads the flag; with none stored it is set and `say` gets the note's text. A read that fails says
 *  nothing (the flag may be set). */
export async function noteFirstDrop(kv: Kv, gone: readonly { status: string }[], say: (text: string) => void): Promise<void> {
  if (asked.has(kv) || gone.every((i) => i.status === "note")) return;
  asked.add(kv);
  let seen: boolean | undefined;
  try {
    seen = await kv.get<boolean>(HISTORY_DROP_NOTED);
  } catch {
    return;
  }
  if (seen === true) return;
  void kv.set(HISTORY_DROP_NOTED, true);
  say(dataText("history.dropped"));
}
