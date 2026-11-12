// SPDX-License-Identifier: GPL-3.0-or-later
// R277: the term a hold on the entry line selects, and the term of an atom (R279's Select starts from it). A term is what
// R17, L8 and L9 take as one: a number with its ᴇ part (and its power), a chip, a fraction, a root, a bracket group (a
// function's name goes with its bracket), a letter, each with a power after it. An operator, a relation, a separator or
// a box's start is no term. Offsets as in boxes.ts (an atom's parts come before it, one level deeper; a power `^…` is an
// atom of its own after its base). Public MathLive API only: offsets, `getElementInfo` (its latex, depth and bounds) and
// `getOffsetFromPoint`. Loaded with MathLive, outside the start chunk.
import type { MathfieldElement } from "mathlive";
import { DIFF, THIN, atomAfter, atomStart, depthAt, isInfixWord, isName, isOperator, isPair, latexAt } from "./boxes.ts";
import { inNumber, numberAround } from "./numberRun.ts";

type Field = Pick<MathfieldElement, "getElementInfo" | "lastOffset">;
type PointField = Field & Pick<MathfieldElement, "getOffsetFromPoint">;

/** No term: a box's start, an operator, a relation, a separator, a mark between boxes (boxes.ts: the same lists ⌫, x² and the grids read), AND, OR, XOR (R117). */
const noTerm = (l: string): boolean => isOperator(l) || isInfixWord(l) || l === THIN || l === DIFF;
/** How far (CSS px) beside an atom's box a finger still counts as on it. */
const SLACK_PX = 3;

interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** The atoms on the level of the atom at `o`, in its box, in order (their offsets). */
function level(mf: Field, o: number): number[] {
  const d = depthAt(mf, o);
  const row = [o];
  for (let s = atomStart(mf, o); s > 0 && depthAt(mf, s) === d && latexAt(mf, s) !== ""; s = atomStart(mf, s)) row.unshift(s);
  for (let p = atomAfter(mf, o); p > 0 && latexAt(mf, p) !== ""; p = atomAfter(mf, p)) row.push(p);
  return row;
}

/**
 * The term of the atom at offset `o`, as a selection range (the position before it, the offset of its last atom), or
 * undefined where the atom is no term.
 */
export function termRange(mf: Field, o: number): [number, number] | undefined {
  if (o < 1 || o > mf.lastOffset) return undefined;
  const row = level(mf, o);
  const at = (k: number): string => (k >= 0 && k < row.length ? latexAt(mf, row[k] as number) : "");
  const i = row.indexOf(o);
  const range = (a: number, b: number): [number, number] => {
    if (at(b + 1).startsWith("^")) b++; // its power
    return [atomStart(mf, row[a] as number), row[b] as number];
  };
  // a number with its ᴇ part, read as selectENumber and selectCompound read it (numberRun.ts, the one rule)
  const d = depthAt(mf, o);
  if (inNumber(mf, o, d)) {
    const [s, e] = numberAround(mf, o, d);
    const p = atomAfter(mf, e);
    return [s, p > 0 && latexAt(mf, p).startsWith("^") ? p : e]; // its power
  }
  const l = at(i);
  if (noTerm(l)) return undefined;
  if (l.startsWith("^")) {
    // a power: with its base
    const base = i > 0 ? termRange(mf, row[i - 1] as number) : undefined;
    return [base ? base[0] : atomStart(mf, o), o];
  }
  // a function's name and its bracket pair are one term
  if (isName(l) && isPair(mf, row[i + 1] ?? 0)) return range(i, i + 1);
  if (isPair(mf, o) && isName(at(i - 1))) return range(i - 1, i);
  return range(i, i);
}

/** The box of the atom at `o`: its own, else the union of its parts' (a power `^…` has none of its own). */
function boundsOf(mf: Field, o: number): Bounds | undefined {
  const own = mf.getElementInfo(o)?.bounds;
  if (own) return own;
  let box: Bounds | undefined;
  for (let p = atomStart(mf, o) + 1; p < o; p++) {
    const b = mf.getElementInfo(p)?.bounds;
    if (!b) continue;
    box = box
      ? { left: Math.min(box.left, b.left), right: Math.max(box.right, b.right), top: Math.min(box.top, b.top), bottom: Math.max(box.bottom, b.bottom) }
      : { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
  }
  return box;
}

/** The atom whose part holds the atom at `o` (the first later offset one level up), or 0 on the line. */
function parentOf(mf: Field, o: number): number {
  const d = depthAt(mf, o);
  if (d === 0) return 0;
  for (let p = o + 1; p <= mf.lastOffset; p++) if (depthAt(mf, p) < d) return p;
  return 0;
}

/**
 * The term under the point (`x`, `y`, client px), or undefined on empty space or on an operator. MathLive gives the
 * nearest atom (a chip or the ᴇ mark whole); where the point is beside it (on a fraction's bar, a bracket) the term is
 * the first atom up whose box holds the point. On the line itself only the point's x counts; where MathLive's nearest
 * atom is no help (on a root's sign it is the line's start) the line's atom whose box holds x is the one.
 */
export function termAt(mf: PointField, x: number, y: number): [number, number] | undefined {
  const near = (b: Bounds | undefined, slack: number): boolean => b !== undefined && x >= b.left - slack && x <= b.right + slack;
  for (let o = mf.getOffsetFromPoint(x, y, { bias: 1 }); o > 0; o = parentOf(mf, o)) {
    const b = boundsOf(mf, o);
    if (near(b, SLACK_PX) && (depthAt(mf, o) === 0 || (b && y >= b.top && y <= b.bottom))) return termRange(mf, o);
  }
  for (const slack of [0, SLACK_PX])
    for (let o = 1; o <= mf.lastOffset; o++) if (depthAt(mf, o) === 0 && near(boundsOf(mf, o), slack)) return termRange(mf, o);
  return undefined;
}
