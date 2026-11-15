// SPDX-License-Identifier: GPL-3.0-or-later
// R324: the atom range of the call Help named (views/helpSheet.ts), so that its Insert row replaces it. R196's functionAt
// names the call in the line's LaTeX (entry/cursorFn.ts callAt: its id, its start and end); MathLive selects by atom
// offsets, which LaTeX offsets do not give (entry/cursorAt.ts). So the range is found from the cursor as Select reaches
// it (term.ts: an atom's term, a function's name with its bracket, and the atoms that hold it, up to the line) and taken
// only when its LaTeX is the call's text: the innermost such range, as functionAt takes the innermost call. A cursor in a
// chip or between calls, or a call no term covers, gives none, and the caller inserts at the cursor: never a guess.
// Public MathLive API only (offsets, getElementInfo, getValue). Loaded with MathLive (field.ts), outside the start chunk.
import type { MathfieldElement } from "mathlive";
import { atomAfter, atomStart, latexAt } from "./boxes.ts";
import { parentOf, termRange } from "./term.ts";

type Field = Pick<MathfieldElement, "getElementInfo" | "lastOffset" | "getValue">;
/** A selection range as MathLive keeps it: the position before its first atom, the offset of its last atom. */
export type Range = [number, number];

/** The ranges that may be a call, from the atom at `o`: its term, the term without its power, the atom alone, and each
 *  with the script after it (a subscript or power that MathLive keeps as an atom of its own). */
function candidates(mf: Field, o: number): Range[] {
  const out: Range[] = [];
  const t = termRange(mf, o);
  if (t) {
    out.push(t);
    if (latexAt(mf, t[1]).startsWith("^")) out.push([t[0], atomStart(mf, t[1])]);
  }
  out.push([atomStart(mf, o), o]);
  for (const [s, e] of [...out]) {
    const p = atomAfter(mf, e);
    if (p > 0 && /^[_^]/.test(latexAt(mf, p))) out.push([s, p]);
  }
  return out;
}

/** LaTeX without its empty slots: the mark of cursorAt.ts takes the place of the slot the cursor is in, so the line it
 *  reads has no `\placeholder{}` there and the field has. */
export const bare = (latex: string): string => latex.replaceAll("\\placeholder{}", "");

/**
 * The range of the call whose LaTeX is `text` (empty slots aside, `bare`) that holds the cursor at position `at`, the
 * innermost first; undefined when no range from the cursor up has that LaTeX.
 */
export function callRange(mf: Field, at: number, text: string): Range | undefined {
  const want = bare(text);
  if (!want || at < 0 || at > mf.lastOffset) return undefined;
  for (let o = at; o > 0; o = parentOf(mf, o))
    for (const [s, e] of candidates(mf, o)) if (s < e && s <= at && at <= e && bare(mf.getValue(s, e, "latex")) === want) return [s, e];
  return undefined;
}
