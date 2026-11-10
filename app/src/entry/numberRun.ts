// SPDX-License-Identifier: GPL-3.0-or-later
// R57: where a number's digits start. The entry line holds a number as digit atoms, a point `.` and, with the decimal
// comma, MathLive's `{,}`, a group atom whose own parts (an empty sentinel and the comma) are listed one level deeper
// before it. The ᴇ-number readers (the controller's selectENumber, the hardware `e`), a power's or a mixed number's base
// (selectCompound, L8 and L9) and a digit's ⌫ and Del in a power's base (delete.ts) walk back over such a run (R256).
import type { MathfieldElement } from "mathlive";

type Field = Pick<MathfieldElement, "getElementInfo">;

/** The atom at offset `o` is, at depth `d`, one of `re`. */
const isAt = (mf: Field, o: number, d: number, re: RegExp): boolean =>
  o > 0 && (mf.getElementInfo(o)?.depth ?? 0) === d && re.test(mf.getElementInfo(o)?.latex ?? "");

/**
 * The offset where the run of digits, points and decimal commas that ends at `from` (depth `d`) begins: `from` itself
 * when no digit, point or comma stands right before it.
 */
export function numberRunStart(mf: Field, from: number, d: number): number {
  let k = from;
  for (;;) {
    const group = isAt(mf, k, d, /^\{,\}$/);
    if (!group && !isAt(mf, k, d, /^[\d.]$/)) return k;
    k--;
    if (group) while (k > 0 && (mf.getElementInfo(k)?.depth ?? 0) > d) k--; // the group's parts
  }
}
