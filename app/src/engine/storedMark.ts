// SPDX-License-Identifier: GPL-3.0-or-later
// S53f1: the mark a stored variable carries into Vars. Worker side only (host.ts): defs.ts is read at start and must not
// pull the formatter in.
import type { DefChange } from "./defs.ts";
import { markOf } from "./format.ts";
import { precisionFacts, type ResultLike } from "./precisionFacts.ts";

/** The mark of `r`, the result just stored (the weakest of a list's elements), noted on the variables set from it as the
 *  history draws it: Vars shows it for a name that has no facts (an exact value stores none). A result with no mark, or a
 *  mark that is not = or ≈ (⚠ is the facts' to say), notes nothing. */
export function noteMark(defs: DefChange[], r: ResultLike, digits: number): DefChange[] {
  const mark = markOf(precisionFacts(r), { format: "STD", digits })?.mark;
  if (mark !== "=" && mark !== "≈") return defs;
  return defs.map((c) => ("set" in c && c.set.kind === "var" ? { set: { ...c.set, mark } } : c));
}
