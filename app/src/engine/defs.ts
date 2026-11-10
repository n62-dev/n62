// SPDX-License-Identifier: GPL-3.0-or-later
// The definitions log (docs/04 section 6.2): what the user defined, kept outside the engine so that a fresh one (after
// Cancel, a crash or a relaunch) gets the same state. Plain data and pure functions, used on both sides: the engine
// host (host.ts) builds the entries, WorkerEngine keeps the log and stores it. Only erasable TypeScript syntax.
//
// One entry per name, the last definition kept (at most MAX_DEFS). A variable is kept as its VALUE, not as the command
// that defined it: `B:=A*2` replayed after `A:=5` would give B a different value than it had (the log keeps one entry
// per name, so the order of the commands is gone). Functions are kept as their definition (the body is not evaluated
// when it is defined, so order does not matter). Inputs whose effect has no single name are kept as typed, in order.
import { markOf } from "./format.ts";
import { precisionFacts, type ResultLike } from "./precisionFacts.ts";
import { readValueFacts, type ValueFacts } from "./types.ts";
import type { ProgramStores } from "./stores.ts";
import { isName } from "./giacPrint.ts";

/** How far a variable that holds a float can be trusted (decisions M4-7): the facts of the result it was stored from
 *  (never `exact`: an exact value stores none). */
export type NameFacts = ValueFacts;

/** The mark Vars draws for a name that holds no facts (an exact value). */
export type StoredMark = "=" | "≈";

/** var: a value (`A:=…`, `…▶A`, `L[2]:=…`, and since G65 every name any input set: `a,b:=1,2`, `(A:=5)+1`, a called
 *  program's global); fn: `f(x):=…`; assume: `assume`/`additionally` on a name; other: a stateful input with no single
 *  name, replayed as typed: only in a log stored before G65 (F58: `x:=y:=3` outlived purge(x), purge(y)). */
export type DefKind = "var" | "fn" | "assume" | "other";

export interface DefEntry {
  /** The defined name; "" for kind "other". */
  name: string;
  kind: DefKind;
  /** Giac commands that recreate it in a fresh engine. */
  cmds: string[];
  /** A variable holding a float, or an inexact value that prints exactly (G49): its mark facts (M4-7). Absent for
   *  exact values. */
  facts?: NameFacts;
  /** The value as shown when it was defined (Vars and Find previews, docs/04 3.4). */
  preview: string;
  /** A variable: the mark of the result it was stored from, as the history drew it (S53f1: `=` for 5, `≈` for 1/3 shown
   *  as 0.333333333333). Absent in a log stored before S53f1 and when the result had no mark: Vars then shows none. */
  mark?: StoredMark;
  view: "home" | "cas";
  /** When it was defined (ms since 1970). */
  time: number;
  /** Replay before every other entry: a symbolic value (names in it must still be unassigned when it is set again). */
  early?: boolean;
  /** A variable: the angle mode it was stored in (G34), so a later migration knows what an old text meant. Absent for
   *  entries stored before G34 and for values set outside Home and CAS (the raw eval path). */
  angle?: "rad" | "deg";
  /** One line saying what it is (a library's comment above the definition, G33), at most DESC_MAX characters. */
  desc?: string;
  /** G46: a variable stored before its angle mode was recorded, whose text holds an angle function; the engine reads
   *  it both ways on its next replay and keeps the reading that matches the preview (engine/angleMigration.ts). */
  migrate?: "angle";
  /** G100: a program's stores, read from its tree when it was defined (stores.ts). Not kept in storage (validDefs):
   *  a restored program's are read again from its commands, so a stored log cannot claim a body stores nothing. */
  stores?: ProgramStores;
}

export type DefChange = { set: DefEntry } | { purge: string[] };

/** The log's size limit (docs/04 section 6.2): the oldest entries go first. */
export const MAX_DEFS = 500;
/** Longest preview kept. */
export const PREVIEW_MAX = 200;
/** Longest description kept. */
export const DESC_MAX = 120;

/** Entries with the same key replace each other: the name, or the command itself for kind "other". */
export function keyOf(e: DefEntry): string {
  return e.kind === "other" ? `#${e.cmds.join("\n")}` : e.name;
}

/** The log after `changes`: a new definition of a name replaces the old one and moves to the end; purge drops it. */
export function applyDefChanges(log: readonly DefEntry[], changes: readonly DefChange[]): DefEntry[] {
  let out = [...log];
  for (const c of changes) {
    if ("purge" in c) {
      const names = new Set(c.purge);
      // an "other" entry goes only by its key (`#<cmds>`, which no name can spell: otherToNames in host.ts)
      out = out.filter((e) => (e.kind === "other" ? !names.has(keyOf(e)) : !names.has(e.name)));
    } else {
      const k = keyOf(c.set);
      out = out.filter((e) => keyOf(e) !== k);
      out.push(c.set);
    }
  }
  return out.length > MAX_DEFS ? out.slice(out.length - MAX_DEFS) : out;
}

/** S53f1: the mark of `r`, the result just stored (the weakest of a list's elements), noted on the variables set from it
 *  as the history draws it: Vars shows it for a name that has no facts (an exact value stores none). A result with no
 *  mark, or a mark that is not = or ≈ (⚠ is the facts' to say), notes nothing. */
export function noteMark(defs: DefChange[], r: ResultLike, digits: number): DefChange[] {
  const mark = markOf(precisionFacts(r), { format: "STD", digits })?.mark;
  if (mark !== "=" && mark !== "≈") return defs;
  return defs.map((c) => ("set" in c && c.set.kind === "var" ? { set: { ...c.set, mark } } : c));
}

/** The commands to replay, in order: symbolic values first (while every name in them is still free), then the rest. */
export function replayOrder(log: readonly DefEntry[]): DefEntry[] {
  return [...log.filter((e) => e.early), ...log.filter((e) => !e.early)];
}

const KINDS: readonly DefKind[] = ["var", "fn", "assume", "other"];

/** A stored entry's facts through the one mapping for stored facts (readValueFacts): an entry stored before G76 has no
 *  `exact` (a name's facts never claim it). Undefined: none stored; null: wrong shape. */
function validFacts(x: unknown): NameFacts | undefined | null {
  return x === undefined ? undefined : readValueFacts(x);
}

/** Stored entries read back (IndexedDB): the ones with the right shape, at most MAX_DEFS. */
export function validDefs(x: unknown): DefEntry[] {
  if (!Array.isArray(x)) return [];
  const out: DefEntry[] = [];
  for (const it of x) {
    if (!it || typeof it !== "object") continue;
    const e = it as Record<string, unknown>;
    const cmds = e["cmds"];
    const kind = e["kind"];
    const facts = validFacts(e["facts"]);
    if (typeof e["name"] !== "string" || !KINDS.includes(kind as DefKind) || facts === null) continue;
    if (!Array.isArray(cmds) || cmds.length === 0 || !cmds.every((c) => typeof c === "string")) continue;
    if (kind !== "other" && !isName(e["name"], true)) continue;
    out.push({
      name: e["name"],
      kind: kind as DefKind,
      cmds: cmds as string[],
      ...(facts ? { facts } : {}),
      preview: typeof e["preview"] === "string" ? e["preview"].slice(0, PREVIEW_MAX) : "",
      view: e["view"] === "cas" ? "cas" : "home",
      time: typeof e["time"] === "number" && Number.isFinite(e["time"]) ? e["time"] : 0,
      ...(e["early"] === true ? { early: true } : {}),
      ...(kind === "var" && (e["angle"] === "rad" || e["angle"] === "deg") ? { angle: e["angle"] } : {}),
      ...(typeof e["desc"] === "string" && e["desc"] ? { desc: e["desc"].slice(0, DESC_MAX) } : {}),
      ...(kind === "var" && e["migrate"] === "angle" ? { migrate: "angle" as const } : {}),
      ...(kind === "var" && (e["mark"] === "=" || e["mark"] === "≈") ? { mark: e["mark"] } : {}),
    });
  }
  return out.slice(-MAX_DEFS);
}

/** A user's name as Vars and Find list it (docs/04 section 3.4). */
export interface UserName {
  name: string;
  kind: "var" | "fn";
  preview: string;
  view: "home" | "cas";
  time: number;
  facts?: NameFacts;
  /** The mark of the result it was stored from (DefEntry.mark); none for a name stored before S53f1. */
  mark?: StoredMark;
  desc?: string;
}

export function userNamesOf(log: readonly DefEntry[]): UserName[] {
  const out: UserName[] = [];
  for (const e of log) {
    if (e.kind !== "var" && e.kind !== "fn") continue;
    out.push({ name: e.name, kind: e.kind, preview: e.preview, view: e.view, time: e.time, ...(e.facts ? { facts: e.facts } : {}), ...(e.mark ? { mark: e.mark } : {}), ...(e.desc ? { desc: e.desc } : {}) });
  }
  return out;
}
