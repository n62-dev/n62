// SPDX-License-Identifier: GPL-3.0-or-later
// G218: what the sync folder receives (docs/04 2.6), the pure part of the hand-off: from one finished row to the text
// each file gets appended. A device writes `n62-<device>-<date>.jsonl` (one session line per row, G210) and a `.py`
// beside it (each row as a `# %%` cell of G213's translation), by the local date of the row, so a row one minute past
// midnight opens the next day's pair. The files are appended, never rewritten, and a day's file can hold several runs
// (processes) of the app, so the `.py` is written to run from the top whatever came before:
// - each process starts its part of a file with G213's first line; a name is imported in the first cell of the
//   process that uses it, once per file and process, by Copy's own rule (python.ts pyImports: sympy's names, Python's
//   Fraction, pint's registry and Q_, G216f1);
// - a stored name a row reads that the process has not bound in this file (or that holds another value now) is bound
//   right before the row, to the value the row read (`a = 5  # N62: stored, = 5`);
// - a row's own name carries the process id (`_3_<id>`), so two processes' row 3 are two names and each later row reads
//   its own; a stored name (`a`) keeps the user's name and is bound again by each process that reads it.
// Translating a row re-reads the process's earlier rows of the file (a row's cell depends on them only): a pure
// function, no file read. Lazy: reached only through R182's hook, never from the start chunk.
import { pyHead, pyImports, translateCells, type PyRow } from "../clipboard/python.ts";
import { validName } from "../clipboard/folder.ts";
import { sessionLine } from "../state/sessionLine.ts";
import type { HistoryItem } from "../state/session.svelte.ts";

/** One file's text to append. */
export interface SyncFile {
  file: string;
  text: string;
}

/** What the files of one process need to remember; filesFor returns a new one, never changes the one given. */
export interface SyncFilesState {
  /** The app's version, for each line and the `.py`'s first line. */
  readonly app: string;
  /** The process id: base 36 of the process's start in whole seconds; each row name of its `.py` cells carries it. */
  readonly process: string;
  /** Per `.py` file: the rows (as their session lines) this process put in it, in order. The imports and stored
   *  values it emitted follow from them. */
  readonly rows: Readonly<Record<string, readonly PyRow[]>>;
}

/** The process id of a run that started at `start`: base 36 of the whole seconds since the epoch (`t5k2x9a`). */
export const processId = (start: Date): string => Math.max(0, Math.floor(start.getTime() / 1000)).toString(36);

/** A new process's state: nothing written yet. */
export const syncFilesState = (app: string, start: Date): SyncFilesState => ({ app, process: processId(start), rows: {} });

/** The longest device part of a name, in UTF-8 bytes: the name stays far under folderWrite's 246. */
const DEVICE_BYTES = 64;

/** The device name as it goes into a file name: a character a file name or Windows refuses (`/ \ : * ? " < > |`, a
 *  control character, a space) becomes `-`, runs of `-` become one, none at either end; cut to 64 UTF-8 bytes on a
 *  whole character; `device` when nothing is left. */
export function deviceSlug(device: string): string {
  const s = device.replace(/[\s/\\:*?"<>|\p{Cc}]+/gu, "-").replace(/-+/g, "-").replace(/^[-.]+|[-.]+$/g, "");
  let out = "";
  for (const ch of s) {
    if (new TextEncoder().encode(out + ch).length > DEVICE_BYTES) break;
    out += ch;
  }
  out = out.replace(/[-.]+$/, "");
  return out === "" ? "device" : out;
}

const two = (n: number): string => String(n).padStart(2, "0");

/** The pair's name without its extension: `n62-<device>-YYYY-MM-DD`, by the local date of `now`. */
export function syncBase(device: string, now: Date): string {
  return `n62-${deviceSlug(device)}-${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}

/** The text a finished row adds to each file, and the state after it; a row that is no result (pending, a note) adds
 *  nothing. `now` is when the row is handed over: the line's `t` and the files' date. */
export function filesFor(row: HistoryItem, state: SyncFilesState, device: string, now: Date): { files: SyncFile[]; state: SyncFilesState } {
  const line = sessionLine(row, { t: now, app: state.app });
  if (line === undefined) return { files: [], state };
  const base = syncBase(device, now);
  const jsonl = `${base}.jsonl`;
  const py = `${base}.py`;
  if (!validName(jsonl) || !validName(py)) return { files: [], state };
  const rows = [...(state.rows[py] ?? []), JSON.parse(line) as PyRow];
  const cells = translateCells(rows, { tag: `_${state.process}`, defs: true });
  const cell = cells[cells.length - 1] as (typeof cells)[number];
  const had = new Set(cells.slice(0, -1).flatMap((c) => c.uses));
  const text = [...(rows.length === 1 ? [pyHead(state.app)] : []), "# %%", ...pyImports(cell.uses, had), cell.code];
  return {
    files: [
      { file: jsonl, text: `${line}\n` },
      { file: py, text: `${text.join("\n")}\n` },
    ],
    state: { ...state, rows: { ...state.rows, [py]: rows } },
  };
}
