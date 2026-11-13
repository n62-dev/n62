// SPDX-License-Identifier: GPL-3.0-or-later
// R197: the entry line's LaTeX with the cursor as a character offset into it, for R196's functionAt. MathLive's own
// offsets count atoms, and the LaTeX of a range (getValue(0, position)) drops a bracket the range cuts (`\sin1+` for the
// cursor in `\sin\left(1+|\right)`), so the cursor is found with a mark instead: a hidden copy of the field takes the
// line, the cursor and the field's macros, a mark macro goes in at the cursor, and the copy's LaTeX is read and the
// mark taken out. The line itself is never touched (its undo stack stays). Public MathLive API only; lazy with the
// Help key's sheet (views/helpSheet.ts), outside the start chunk.
import type { MathfieldElement } from "mathlive";

/** The mark: a macro of the copy alone, one atom the cursor stands before (as a chip, entry/macros.ts). */
const MARK = "nsixtwomark";

/** The line and the cursor's offset in it (0 to its length). Without a field (still loading): the pending line with the
 *  cursor at its end. A copy that will not mount (it never should) gives the end of the line too. */
export async function cursorLatex(mf: MathfieldElement | undefined, pending: string): Promise<{ latex: string; offset: number }> {
  if (!mf) return { latex: pending, offset: pending.length };
  const Field = mf.constructor as typeof MathfieldElement;
  const copy = new Field();
  copy.style.cssText = "position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none";
  copy.setAttribute("aria-hidden", "true");
  const mounted = new Promise<boolean>((done) => {
    copy.addEventListener("mount", () => done(true), { once: true });
    setTimeout(() => done(false), 1000); // the safety net of entry/field.ts makeField
  });
  document.body.append(copy);
  try {
    const value = mf.value;
    if (!(await mounted)) return { latex: value, offset: value.length };
    copy.macros = { ...mf.macros, [MARK]: { def: "?", args: 0, captureSelection: true, expand: false } };
    copy.value = value;
    copy.position = mf.position;
    copy.insert(`\\${MARK}`, { format: "latex", selectionMode: "after" });
    const marked = copy.value;
    const at = marked.indexOf(`\\${MARK}`);
    if (at < 0) return { latex: value, offset: value.length };
    return { latex: marked.slice(0, at) + marked.slice(at + MARK.length + 1), offset: at };
  } finally {
    copy.remove();
  }
}
