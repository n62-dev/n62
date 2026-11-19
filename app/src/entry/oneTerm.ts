// SPDX-License-Identifier: GPL-3.0-or-later
// R746: an exact result put on the line as its maths (App.svelte insertResult) stays one term, as the chip it replaces
// did (a chip beside a number is refused: "put × between a result and a number"). A × goes between it and a number, a
// closing bracket, a postfix mark or a chip before the cursor, and a number, an opening bracket or a chip after it, so
// 2 then 5/6 is 2×5/6, never the mixed number 2⅚ it would look like. Its own leading minus or top-level sum is
// bracketed by resultToEntry (render/insertable.ts). Loaded with the field (entry/field.ts).
import type { MathfieldElement } from "mathlive";

type Field = Pick<MathfieldElement, "getElementInfo" | "selection" | "position" | "lastOffset">;

/** The × the keypad's × key types. */
const TIMES = "\\times";
/** An atom that ends a term: a digit, a point, the decimal comma `{,}` (a number's last part, also with its power),
 *  a bracket group (`\left(…\right)`, its power too), a closing bracket, `!` or `%` after a term, a chip. */
const ENDS_TERM = /^(?:[\d.]|\{,\}|[)\]!]|\\%|\\(?:res|ans|const)(?![A-Za-z]))|\\right(?:[)\]|]|\\rbrack|\\rbrace)/;
/** An atom that starts a term the result would run into: a number's first part, an opening bracket, a chip. */
const STARTS_TERM = /^(?:[\d.]|\{,\}|[([]|\\left(?![A-Za-z])|\\(?:res|ans|const)(?![A-Za-z]))/;

/** `latex` with a × before and after where the line beside the cursor (or the selection it replaces) would run into it. */
export function asOneTerm(mf: Field, latex: string): string {
  const [a, b] = mf.selection.ranges[0] ?? [mf.position, mf.position];
  const start = Math.min(a, b);
  const end = Math.max(a, b);
  const info = (o: number): { latex: string; depth: number } => {
    const i = mf.getElementInfo(o);
    return { latex: i?.latex ?? "", depth: i?.depth ?? 0 };
  };
  // the atom before the cursor (a box's first, empty one at a box's start)
  const prev = start > 0 ? info(start) : undefined;
  // the atom after it, at its depth: an atom's parts are listed before the atom itself, one level deeper
  const d = info(end).depth;
  let o = end + 1;
  while (o <= mf.lastOffset && info(o).depth > d) o++;
  const next = o <= mf.lastOffset && info(o).depth === d ? info(o).latex : "";
  const before = prev !== undefined && ENDS_TERM.test(prev.latex) ? TIMES : "";
  const after = STARTS_TERM.test(next) ? TIMES : "";
  return `${before}${latex}${after}`;
}
