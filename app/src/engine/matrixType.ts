// SPDX-License-Identifier: GPL-3.0-or-later
// G130 (backlog F125): Giac's matrix subtype (11: matrix(2,3), zeros, idn, tran, a matrix times one) prints `matrix[…]`,
// engine text Home and CAS do not show (docs/04: never raw engine text). A `[[…]]` vector is the same matrix to Giac (its
// arithmetic gives the subtype back), so the answer's slot is rewritten as plain rows, each row plain too
// (matrix({{1,2},{3,4}}) keeps rows of the list type, `matrix[list[1,2],list[3,4]]`); the elements stay as they are.
// Whether a print is of the matrix type is read in giacPrint.ts (P20: the one reader of Giac text; bridge-3 has no subtype).
// Runs synchronously next to the engine; only erasable TypeScript syntax.
import type { GiacValue } from "./bridge.ts";
import type { Giac } from "./numeric.ts";
import { holdsMatrixType, LIST_TYPE, matrixTyped, MATRIX_TYPE, splitList } from "./giacPrint.ts";

/** Giac text of the matrix `slot` holds as plain rows. */
function rowsOf(slot: string): string {
  return `apply(pasrow->[op(pasrow)],[op(${slot})])`;
}

/** G173 (F127): our Giac helper: the value with every element of the matrix type (subtype 11), at any depth of lists and
 *  matrices, as plain rows; a vector stays a vector and a list stays Giac's list type (23), the other subtypes (a set,
 *  a coefficient vector) and every element that is no list stay as they are. One of ENGINE_DEFINITIONS (homeEval.ts), so
 *  the state read takes the name for ours; the call that uses it defines it again, so a user's `pasplain:=5` changes nothing. */
export const PLAIN_AT = "pasplain";
export const PLAIN_AT_ANY_DEPTH =
  `${PLAIN_AT}(v):={ local w,t; t:=subtype(v); if (type(v)!=DOM_LIST or (t!=0 and t!=11 and t!=23)) return v; ` +
  `w:=[op(v)]; if (t==11) w:=apply(pasrow->[op(pasrow)],w); w:=apply(${PLAIN_AT},w); if (t==23) return list[op(w)]; return w; }`;

/** The Giac text that stores `slot`, printed `text`, as plain rows: Giac's own apply for one matrix (no call per element of
 *  a large one), the helper when a matrix type stands inside it. One call; the value of the store is the call's value. */
function plainStore(slot: string, text: string): string {
  if (matrixTyped(text) && text.lastIndexOf(MATRIX_TYPE) === 0) return `${slot}:=${rowsOf(slot)}`;
  return `${slot}:=[${PLAIN_AT_ANY_DEPTH},${PLAIN_AT}(${slot})][1]`;
}

const failed = (text: string): boolean => text.startsWith("GIAC_ERROR");

/** Home: `v`, the value `slot` holds, stored back with plain rows (one bridge-3 call, `at` as the caller asks, in the
 *  caller's Digits); `v` itself when it holds no matrix type or Giac fails. */
export function plainRows(giac: Giac, slot: string, v: GiacValue, at: readonly number[]): GiacValue {
  if ((v.kind !== "matrix" && v.kind !== "list") || !holdsMatrixType(v.text)) return v;
  const rows = giac.value(plainStore(slot, v.text), at);
  return failed(rows.text) ? v : rows;
}

/** CAS: Giac's print of `slot` stored back with plain rows (one call); `text` itself when it holds no matrix type or Giac fails. */
export function plainRowsText(giac: { eval(text: string): string }, slot: string, text: string): string {
  if (!holdsMatrixType(text)) return text;
  const rows = giac.eval(plainStore(slot, text));
  return failed(rows) ? text : rows;
}

/** The one element of the list or vector `text` (Giac's print) when that element is a matrix, its rows lists; else null. */
function soleMatrix(text: string): string | null {
  const parts = text.includes("[[") ? splitList(text) : null;
  const rows = parts?.length === 1 ? splitList(parts[0]!) : null;
  return rows?.length && rows.every((r) => r.startsWith("[")) ? parts![0]! : null;
}

/**
 * G173: Giac's latex() takes a list of one matrix for a matrix whose rows are lists (`list[[[1,0],[0,1]]]` is drawn as a
 * 1×2 matrix of the rows [1,0] and [0,1]). For such a value: the brackets, around latex() of the matrix inside (one call;
 * quoted as latex() is, an error as Giac gave it). Null for any other value.
 */
export function soleMatrixLatex(giac: { eval(text: string): string }, slot: string, text: string): string | null {
  let [open, close, at, t] = ["", "", slot, text];
  for (let e = soleMatrix(t); e !== null; t = e, e = soleMatrix(t)) {
    const list = t.startsWith(LIST_TYPE);
    [open, close, at] = [open + (list ? "\\{" : "["), (list ? "\\}" : "]") + close, `${at}[0]`];
  }
  if (at === slot) return null;
  const tex = giac.eval(`latex(${at})`);
  return tex.startsWith('"') ? `"${open}${tex.slice(1, -1)}${close}"` : tex;
}
