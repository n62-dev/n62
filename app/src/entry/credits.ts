// SPDX-License-Identifier: GPL-3.0-or-later
// R149: Enter on the line N62 opens the credits sheet (views/creditsSheet.ts) and submits nothing. This is only the
// check, so the start chunk carries a few bytes; the sheet and its data are lazy chunks.
import type { UserName } from "../calc/port.ts";

/** The line is exactly N62 or n62 (Alpha types capitals in Home and lower case in CAS), with no chip on it and no stored
 *  name that makes it a calculation: N62 or n62 itself, or the line's own first letter (N62 reads as N times 62). */
export function creditsAsked(value: string, names: readonly UserName[], chips: object = {}): boolean {
  return /^n62$/i.test(value) && !Object.keys(chips).length && !names.some((u) => u.name === value[0] || /^n62$/i.test(u.name));
}
