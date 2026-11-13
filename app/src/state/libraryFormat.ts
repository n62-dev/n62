// SPDX-License-Identifier: GPL-3.0-or-later
// What the library file's reader needs of the stored data (G147): the version it accepts (DATA_VERSION, the store's
// number) and the migration steps for a file's text. engine/library.ts takes it as an argument, so the engine imports
// nothing from state/ (the direction is state/ -> engine/ only). Loaded with the library import, never at start
// (migrations.ts is a lazy chunk, R103). G342: the number a file is stamped with is another one, the last version whose
// step rewrote library text (`written`), so a store step that leaves library text alone never makes a file unreadable
// by an older app.
import type { LibraryFormat } from "../engine/library.ts";
import { migratedText } from "./migrations.ts";
import { DATA_VERSION, STEP_KEYS } from "./storage.ts";
import { HEADER, LIB_MAX_BYTES } from "../engine/libraryHeader.ts";

/** G342: the version a library file's text is written in: one more than the last n whose step n → n+1 (`steps`, STEP_KEYS)
 *  rewrites `library` text; 0 when none does. */
export function libraryTextVersion(steps: Readonly<Record<number, readonly string[]>> = STEP_KEYS): number {
  const last = Object.keys(steps).map(Number).filter((n) => steps[n]?.includes("library")).reduce((a, b) => Math.max(a, b), -1);
  return last + 1;
}

/** The format for a store at `dataVersion` with the steps `steps` (the app's own below; a test passes a table of its own). */
export function libraryFormatOf(dataVersion: number, steps: Readonly<Record<number, readonly string[]>> = STEP_KEYS): LibraryFormat {
  return {
    version: dataVersion,
    written: libraryTextVersion(steps),
    migrate: (text, from) => migratedText("library", text, from),
  };
}

export const LIBRARY_FORMAT: LibraryFormat = libraryFormatOf(DATA_VERSION);

/** R59: a library file with an older stamp brought up to DATA_VERSION, for the worker, which runs no migration: the
 *  stamp rewritten and the text below it migrated line for line, so every line number stays the file's. Anything else
 *  goes on as it came (over LIB_MAX_BYTES, not UTF-8, a missing or newer stamp, already up to date), for the worker's
 *  reader to take or refuse with its own words (engine/library.ts parseLibrary). A file over the limit is never
 *  migrated: a picked one is read only to the limit plus a byte (views/libraryJobs.ts READ_CAP), and a migration that
 *  shrank the cut text under the limit would import it without the definitions past the cut. */
export function upToDate(input: Uint8Array | string): Uint8Array | string {
  if ((typeof input === "string" ? new TextEncoder().encode(input).length : input.length) > LIB_MAX_BYTES) return input;
  let text: string;
  try {
    text = typeof input === "string" ? input : new TextDecoder("utf-8", { fatal: true }).decode(input);
  } catch {
    return input;
  }
  text = text.replace(/^\ufeff/, "").replace(/\r\n?/g, "\n");
  const nl = text.indexOf("\n");
  const m = HEADER.exec((nl < 0 ? text : text.slice(0, nl)).trim());
  const from = m ? Number(m[1]) : DATA_VERSION;
  if (from >= DATA_VERSION) return input;
  return `// n62 library ${DATA_VERSION}\n${migratedText("library", nl < 0 ? "" : text.slice(nl + 1), from)}`;
}
