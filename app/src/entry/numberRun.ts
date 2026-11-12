// SPDX-License-Identifier: GPL-3.0-or-later
// R57: where a number's digits start. The entry line holds a number as digit atoms, a point `.` and, with the decimal
// comma, MathLive's `{,}`, a group atom whose own parts (an empty sentinel and the comma) are listed one level deeper
// before it. The ᴇ-number readers (the controller's selectENumber, the hardware `e`), a power's or a mixed number's base
// (selectCompound, L8 and L9), a digit's ⌫ and Del in a power's base (delete.ts) and the term a hold selects (term.ts,
// R277) walk back over such a run (R256). The one place for what a number is: its parts, its ᴇ mark and the sign after it.
import type { MathfieldElement } from "mathlive";
import { EMARK } from "./macros.ts";

type Field = Pick<MathfieldElement, "getElementInfo">;
type LevelField = Field & Pick<MathfieldElement, "lastOffset">;

/** A number's parts: a digit, a point, the decimal comma `{,}` (R57). */
const PART = /^(?:[\d.]|\{,\})$/;
export const isNumberLatex = (latex: string): boolean => PART.test(latex);
const SIGN = /^[+-]$/;

/** The atom at offset `o` is, at depth `d`, one of `re`. */
const isAt = (mf: Field, o: number, d: number, re: RegExp): boolean =>
  o > 0 && (mf.getElementInfo(o)?.depth ?? 0) === d && re.test(mf.getElementInfo(o)?.latex ?? "");
const isMark = (mf: Field, o: number, d: number): boolean => o > 0 && (mf.getElementInfo(o)?.depth ?? 0) === d && mf.getElementInfo(o)?.latex === EMARK;

/** The offset before the atom at `o` on its depth `d` (its parts skipped). */
function before(mf: Field, o: number, d: number): number {
  let k = o - 1;
  while (k > 0 && (mf.getElementInfo(k)?.depth ?? 0) > d) k--;
  return k;
}

/**
 * The offset where the run of digits, points and decimal commas that ends at `from` (depth `d`) begins: `from` itself
 * when no digit, point or comma stands right before it.
 */
export function numberRunStart(mf: Field, from: number, d: number): number {
  let k = from;
  while (isAt(mf, k, d, PART)) k = before(mf, k, d); // a comma group's parts are skipped
  return k;
}

/** The ᴇ part that ends at `end`: digits, a sign right after the mark, the mark. The offset before the mark, and whether digits follow it. */
function markPart(mf: Field, end: number, d: number): { at: number; digits: boolean } | undefined {
  let k = end;
  while (isAt(mf, k, d, /^\d$/)) k--;
  const digits = k < end;
  if (isAt(mf, k, d, SIGN)) k--;
  if (!isMark(mf, k, d)) return undefined;
  return { at: before(mf, k, d), digits };
}

/**
 * R14: where the number with an ᴇ part whose last atom is `end` begins (`1.5ᴇ-3`: digits on both sides of the mark), or
 * undefined where no such number ends there (selectENumber).
 */
export function eNumberStart(mf: Field, end: number, d: number): number | undefined {
  const m = markPart(mf, end, d);
  if (!m?.digits) return undefined;
  const s = numberRunStart(mf, m.at, d);
  return s === m.at ? undefined : s;
}

/** The atom at `o` (depth `d`) is part of a number: a digit, a point, a decimal comma, the ᴇ mark or a sign right after it. */
export function inNumber(mf: Field, o: number, d: number): boolean {
  return isAt(mf, o, d, PART) || isMark(mf, o, d) || (isAt(mf, o, d, SIGN) && isMark(mf, o - 1, d));
}

/**
 * R277: the number that holds the atom at `o` (inNumber), with its ᴇ part, as a selection range: the position before
 * its first atom and its last atom's offset. Its start is read back from its end as selectENumber and selectCompound read
 * it (numberRunStart, eNumberStart), so a hold selects the number x² raises from the cursor after it.
 */
export function numberAround(mf: LevelField, o: number, d: number): [number, number] {
  const digit = (k: number): boolean => isAt(mf, k, d, /^\d$/);
  const signAfterMark = (k: number): boolean => isAt(mf, k, d, SIGN) && isMark(mf, k - 1, d);
  // in the ᴇ part (on the mark, its sign or a digit after them) only digits follow; before it the run and one mark
  let exp = isMark(mf, o, d) || signAfterMark(o) || (digit(o) && markPart(mf, o, d) !== undefined);
  let end = o;
  for (;;) {
    let p = end + 1;
    while (p <= mf.lastOffset && (mf.getElementInfo(p)?.depth ?? 0) > d) p++;
    if (p > mf.lastOffset || !(exp ? digit(p) || signAfterMark(p) : isAt(mf, p, d, PART) || isMark(mf, p, d))) break;
    exp ||= isMark(mf, p, d);
    end = p;
  }
  const m = markPart(mf, end, d);
  return [m ? numberRunStart(mf, m.at, d) : numberRunStart(mf, end, d), end];
}
