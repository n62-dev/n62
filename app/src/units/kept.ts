// SPDX-License-Identifier: GPL-3.0-or-later
// The slots a line keeps (docs/04 4.3 "The way back": the units key shows them again), by the line's LaTeX. Its own module,
// with no code imports, so Home's Enter can ask it (R902) without loading the unit view (units/view.ts writes it).
import type { UnitSlot } from "./types.ts";

export const kept = new Map<string, Readonly<Record<string, UnitSlot>>>();

/** R902: the line holds kept slots: entered in Home, which has no units, its row says the unit was dropped (G392's note). */
export function keptSlots(line: string): boolean {
  return kept.has(line);
}
