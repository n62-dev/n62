// SPDX-License-Identifier: GPL-3.0-or-later
// The stored definitions log's load check (docs/04 section 6.2), out of defs.ts (R782, a start-chunk cut): WorkerEngine
// reads the stored log once at start, in parallel with the store, and the backup's check runs it too; the start chunk
// keeps only the log's own functions (defs.ts). Only erasable TypeScript syntax.
import { DESC_MAX, MAX_DEFS, PREVIEW_MAX, type DefEntry, type DefKind, type NameFacts, type NameUnit } from "./defs.ts";
import { isName } from "./giacPrintStart.ts";
import { readValueFacts } from "./types.ts";

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
    // G371: a variable's unit as stored, an object only: input/chipUnit.ts chipUnit checks its shape where it is read
    const unit = kind === "var" && e["unit"] && typeof e["unit"] === "object" ? (e["unit"] as NameUnit) : undefined;
    if (typeof e["name"] !== "string" || !KINDS.includes(kind as DefKind) || facts === null) continue;
    if (!Array.isArray(cmds) || cmds.length === 0 || !cmds.every((c) => typeof c === "string")) continue;
    if (kind !== "other" && !isName(e["name"], true)) continue;
    out.push({
      name: e["name"],
      kind: kind as DefKind,
      cmds: cmds as string[],
      ...(facts ? { facts } : {}),
      ...(unit ? { unit } : {}),
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
