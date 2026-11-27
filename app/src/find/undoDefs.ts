// SPDX-License-Identifier: GPL-3.0-or-later
// R314: Memory's Undo copy and what puts it back (Find's lazy chunk, with names.svelte.ts; the start chunk holds none of it).
// The copy is the log entries of the names a delete purged, each with its
// place in the log then; Undo replays them in the engine (the `define` request the stored log goes through at a start) and
// puts them in the log at their old places, unless the name has been defined since.
import type { DefChange, DefEntry } from "../engine/defs.ts"; // (types only: a value from the start chunk would be one more export of it)
import type { Response } from "../engine/protocol.ts";
import type { MathEngine } from "../engine/types.ts";
import type { WorkerEngine } from "../engine/workerEngine.ts";

/** An entry with its place in the log when it was taken out. */
export interface LoggedDef {
  at: number;
  entry: DefEntry;
}

/** The app's WorkerEngine (`call` and `keep`, as the library jobs use them); an engine without a worker has no Undo. */
type Posting = MathEngine & Pick<WorkerEngine, "call" | "keep">;
const posting = (e: MathEngine | undefined): e is Posting => e !== undefined && "call" in e && "keep" in e;

/** The log entries of `names` with their places (a name has one entry; one kept as typed has none). */
export async function entriesOf(engine: MathEngine | undefined, names: readonly string[]): Promise<LoggedDef[]> {
  if (!engine) return [];
  const want = new Set(names);
  return (await engine.definitions()).flatMap((entry, at) => (entry.kind !== "other" && want.has(entry.name) ? [{ at, entry }] : []));
}

/** `log` with the entries of `rows` (which applyDefChanges put at its end) moved back to their old places, the log's own
 *  version of each kept (a replay may have migrated it). */
export function putBackDefs(log: DefEntry[], rows: readonly LoggedDef[]): DefEntry[] {
  const named = (e: DefEntry): boolean => e.kind !== "other" && rows.some((r) => r.entry.name === e.name);
  const mine = new Map(log.filter(named).map((e) => [e.name, e]));
  const out = log.filter((e) => !named(e));
  for (const r of [...rows].sort((a, b) => a.at - b.at)) {
    const e = mine.get(r.entry.name);
    if (e) out.splice(Math.min(r.at, out.length), 0, e);
  }
  return out;
}

/** Put `rows` back: the names the log holds again are left as they are. Returns the names restored. */
export async function restoreDefs(engine: MathEngine | undefined, rows: readonly LoggedDef[]): Promise<string[]> {
  if (!posting(engine)) return [];
  const taken = new Set((await engine.definitions()).map((e) => e.name));
  const free = rows.filter((r) => !taken.has(r.entry.name));
  if (!free.length) return [];
  const r: Response = await engine.call({ type: "define", defs: free.map((x) => x.entry) });
  if (r.type !== "defined") return [];
  engine.keep([...free.map((x): DefChange => ({ set: x.entry })), ...r.defs]); // (the log takes them at its end)
  // to their old places: set again, in order, every entry from the first one out of place (a set moves an entry to the end)
  const log = [...(await engine.definitions())];
  const placed = putBackDefs(log, free);
  const from = placed.findIndex((e, i) => e !== log[i]);
  if (from >= 0) engine.keep(placed.slice(from).map((e): DefChange => ({ set: e })));
  return free.map((x) => x.entry.name);
}
