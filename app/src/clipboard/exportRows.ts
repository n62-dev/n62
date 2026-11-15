// SPDX-License-Identifier: GPL-3.0-or-later
// R200: ☰ › Export › CSV and LaTeX: the open session's finished rows as a file (text.ts sessionCsv, sessionLatex) through
// the save port (files.ts), named `n62-<date>.csv` or `.tex`. The result is the notice; nothing to export says so.
// Loaded on the press only (ClipActions.exportCsv, exportLatex), never at start.
import type { DisplayContext } from "../state/displayMode.ts";
import type { SaveResult } from "./files.ts";
import { tc } from "./strings.ts";
import { sessionCsv, sessionLatex, type CopySource, type TextOptions } from "./text.ts";
import { day } from "./workReport.ts";

export type RowsKind = "csv" | "latex";

const FILE = { csv: { ext: "csv", mime: "text/csv", what: "export.csv" }, latex: { ext: "tex", mime: "application/x-tex", what: "export.latex" } } as const;
const NOTICE = { saved: "export.fileSaved", offered: "export.fileOffered", cancelled: "export.fileCancelled", failed: "export.fileFailed" } as const;

/** Saves the session as `kind` through the save port and returns the notice. Never throws. */
export async function saveRows(
  kind: RowsKind,
  items: readonly CopySource[],
  o: TextOptions,
  ctx: DisplayContext,
  head: { version: string; now: Date },
  save: (name: string, mime: string, text: string) => Promise<SaveResult> = async (n, m, x) => (await import("./files.ts")).saveFile(n, m, x),
): Promise<string> {
  const f = FILE[kind];
  const what = tc(f.what);
  try {
    const text = kind === "csv" ? sessionCsv(items, o, ctx) : sessionLatex(items, o, ctx, head.version);
    if (text === "") return tc("export.nothing");
    return tc(NOTICE[await save(`n62-${day(head.now)}.${f.ext}`, f.mime, text)]).replace("{what}", what);
  } catch {
    return tc(NOTICE.failed).replace("{what}", what);
  }
}
