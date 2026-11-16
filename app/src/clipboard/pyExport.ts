// SPDX-License-Identifier: GPL-3.0-or-later
// R181: Copy as › Python and ☰ › Export › Python: the row, or the open session's finished rows, as the sympy script of
// python.ts (translateRows). The rows are read back from their session lines (sessionLine, G210), the format the sync
// folder writes, so a row says the same in both. The file is `n62-<date>.py` through the save port (files.ts); the result
// is the notice. Loaded on the press only (ClipActions.copyPython, savePython), never at start.
import { sessionLine } from "../state/sessionLine.ts";
import type { HistoryItem } from "../state/session.svelte.ts";
import type { SaveResult } from "./files.ts";
import { translateRows, type PyRow } from "./python.ts";
import { tc } from "./strings.ts";
import { day } from "./workReport.ts";

const NOTICE = { saved: "export.fileSaved", offered: "export.fileOffered", cancelled: "export.fileCancelled", failed: "export.fileFailed" } as const;

/** The script of these rows (a pending row or a note has no line and adds nothing); "" when none is left. */
export function pythonText(items: readonly HistoryItem[], app: string, now: Date): string {
  const rows = items.flatMap((i) => {
    const line = sessionLine(i, { t: now, app });
    return line === undefined ? [] : [JSON.parse(line) as PyRow];
  });
  return rows.length === 0 ? "" : translateRows(rows, { app });
}

/** Saves the session as `n62-<date>.py` through the save port and returns the notice. Never throws. */
export async function savePython(
  items: readonly HistoryItem[],
  head: { version: string; now: Date },
  save: (name: string, mime: string, text: string) => Promise<SaveResult> = async (n, m, x) => (await import("./files.ts")).saveFile(n, m, x),
): Promise<string> {
  const what = tc("export.python");
  try {
    const text = pythonText(items, head.version, head.now);
    if (text === "") return tc("export.nothing");
    return tc(NOTICE[await save(`n62-${day(head.now)}.py`, "text/x-python", text)]).replace("{what}", what);
  } catch {
    return tc(NOTICE.failed).replace("{what}", what);
  }
}
