// SPDX-License-Identifier: GPL-3.0-or-later
// R149, R881: the easter eggs Enter takes off the line and submits nothing for: N62 opens the credits sheet
// (views/creditsSheet.ts), rainbow turns the rainbow mode on or off (views/rainbow.ts). This is only the check, so the start
// chunk carries a few bytes; the sheet, the colours and their data are lazy chunks.
import type { UserName } from "../calc/port.ts";

/** The egg the line asks for: exactly N62 or n62 (Alpha types capitals in Home and lower case in CAS), or rainbow in any case,
 *  with no chip on it and no stored name that makes it a calculation: one of the line's letters as typed (Giac names are
 *  case-sensitive; N62 reads as N times 62, rainbow as r·a·i·n·b·o·w), or the line itself in any case. */
export const eggOf = (v: string, names: readonly UserName[], chips: object = {}): "credits" | "rainbow" | undefined =>
  /^(n62|rainbow)$/i.test(v) && !Object.keys(chips).length && !names.some(({ name }) => (!name[1] && v.includes(name)) || name.toLowerCase() == v.toLowerCase()) ? (v[1] == "6" ? "credits" : "rainbow") : undefined;
