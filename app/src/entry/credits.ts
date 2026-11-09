// SPDX-License-Identifier: GPL-3.0-or-later
// R149: Enter on the line N62 opens the credits sheet (views/creditsSheet.ts) and submits nothing. This is only the
// check, a string compare, so the start chunk carries a few bytes; the sheet and its data are lazy chunks.
import type { UserName } from "../calc/port.ts";
import type { View } from "../state/session.svelte.ts";

const NAME = /^n62$/i;

/** The line is exactly N62 (Alpha types capitals in Home and lower case in CAS; either case asks, in either view), with no
 *  chip on it and no stored name N62 or n62 (then the line is a calculation: it gives the stored value). `view` is
 *  accepted for the call's sake: the case does not matter. */
export function creditsAsked(value: string, _view: View, names: readonly UserName[], chips: object = {}): boolean {
  return NAME.test(value) && Object.keys(chips).length === 0 && !names.some((u) => NAME.test(u.name));
}
