// SPDX-License-Identifier: GPL-3.0-or-later
// R902: the line the unit view last left with kept slots (units/view.ts keep), while it stands unchanged: entered so in Home,
// which has no units, its row says the unit was dropped (G392's note). Any edit, clear or submit of the line drops the
// record (entry/controller.ts, entry/fieldUp.ts; Session.submit takes it; the view opens only on a field that is up), so
// only that line's Enter gets the note; the slots stay in the view's map for the units key's way back. Its own module, with
// no imports, in the start chunk.
let left: string | undefined;

/** The unit view left `latex` with slots (undefined: with none, or the line changed). */
export const leaveLine = (latex?: string): void => void (left = latex);
/** The line changed: no note for what comes next. */
export const dropLeft = (): void => leaveLine();
/** Enter on `latex`: true when it is the line the view left, unchanged; the record goes either way. */
export const takeLeft = (latex: string): boolean => {
  const was = left === latex;
  left = undefined;
  return was;
};
