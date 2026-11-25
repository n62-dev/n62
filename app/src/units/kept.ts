// SPDX-License-Identifier: GPL-3.0-or-later
// The slots a line keeps (docs/04 4.3 "The way back": the units key shows them again), by the line's LaTeX, and the line the
// unit view last left with slots (R902: entered unchanged in Home, which has no units, its row says the unit was dropped,
// G392's note). Its own module, with no code imports, so the entry and Home's Enter reach it without loading the unit view.
import type { UnitSlot } from "./types.ts";

export const kept = new Map<string, Readonly<Record<string, UnitSlot>>>();

/** R902: the line the unit view last left holding kept slots, while it stands unchanged: any edit, clear or submit of the
 *  line drops it (entry/controller.ts, fieldUp.ts; Session.submit takes it). Only that line's Enter gets the note: the map
 *  above outlives it, for the units key's way back. */
let left: string | undefined;
/** The unit view left `latex` with slots (undefined: with none). */
export const leaveLine = (latex: string | undefined): void => void (left = latex);
/** The line changed: no note for what comes next. */
export const dropLeft = (): void => void (left = undefined);
/** Enter on `latex`: true when it is the line the view left, unchanged; the record goes either way. */
export const takeLeft = (latex: string): boolean => {
  const was = left === latex;
  left = undefined;
  return was;
};
