// SPDX-License-Identifier: GPL-3.0-or-later
// R930 (a start-chunk cut): the entry line's field made and set up, out of EntryController (entry/controller.ts), whose load
// fetches this beside MathLive; it brings field.ts's parts the controller keeps (the key's work on the field, Select's chain,
// the grown matrices, the insert), as field.ts's own import did.
import type { MathfieldElement } from "mathlive";
import type { EntryController } from "./controller.ts";
import { makeField, putText } from "./field.ts";
import { dropLeft } from "../units/kept.ts";
export { Grown, putText, runOnField, SelectChain } from "./field.ts";

/** R930 (a start-chunk cut, out of EntryController): the entry line's field, made once MathLive and this chunk are in
 *  (EntryController.load): the line set or kept meanwhile goes on it, then the keys and inserts that waited, in their order
 *  (decisions.md R8). */
export async function fieldFor(c: EntryController, Field: typeof MathfieldElement, host: HTMLElement | undefined): Promise<void> {
  const mf = await makeField(Field, host, {
    key: (ev) => c.hwKey?.(ev, c) ?? false,
    enter: (repeat) => c.onKey("enter", "primary", repeat),
    escape: (repeat) => c.onKey("esc", "primary", repeat),
    paste: (text) => c.onPaste(text),
    sheet: () => !!c.shell?.sheet, // R922
    dead: () => c.onDead(false),
    hold: (latex) => c.onHold(latex), // R903
  });
  c.mf = mf;
  void import("./namemarks.ts").then((n) => (c.marks = new n.NameMarks(mf)).setNames(c.stored));
  if (c.pendingValue !== undefined) mf.value = c.pendingValue;
  c.pendingValue = undefined;
  mf.focus();
  mf.executeCommand("moveToMathfieldEnd");
  for (let a = c.queue.shift(); a; a = c.queue.shift()) {
    if (a.kind === "put") putText(c, a.latex, a.term, a.consts);
    else c.run(a);
  }
  c.freshUndo = () => freshUndo(mf);
  mf.addEventListener("input", () => {
    c.touched = true;
    c.recalledIn = null;
    dropLeft(); // R902: an edit: the unit view's left line is not on it any more
    c.onEdit();
  });
}

/** R898: the field's undo starts afresh with the line as its one entry. resetUndo leaves no entry at all (the next edit
 *  would be the first, the line before it lost), and a set to the same value is skipped: another value first, then the
 *  line. A set by value fires no input event; the selection is kept. */
function freshUndo(mf: MathfieldElement): void {
  const at = mf.selection;
  const line = mf.value;
  mf.resetUndo();
  mf.value = line === "" ? "0" : "";
  mf.resetUndo();
  mf.value = line;
  mf.selection = at;
}
