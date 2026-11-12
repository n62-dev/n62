// SPDX-License-Identifier: GPL-3.0-or-later
// R279 (owner, 2026-11-10): Select grows the selection, Deselect shrinks it, as an editor's "expand selection". With
// nothing selected Select takes the term before the cursor (term.ts, R277: the term x² and ÷ take, R17, L8, L9); each
// further press the next enclosing step: the operand of the operator around it, from the tightest operator to the
// loosest (an implicit product, × ÷ ·, + −, a relation, AND OR XOR, a separator), then the whole box, then the term of
// the template or bracket that owns the box (a function's name with its bracket), and so on up to the whole line, where
// it stays. Deselect walks the same chain back (SelectChain). A pure function of the line (offsets, latex and depth, as
// boxes.ts reads them) and a range: unit-tested without MathLive. Loaded with MathLive (field.ts), outside the start chunk.
import type { MathfieldElement } from "mathlive";
import { DIFF, THIN, atomAfter, atomStart, depthAt, isInfixWord, latexAt } from "./boxes.ts";
import { inNumber } from "./numberRun.ts";
import { level, parentOf, termRange } from "./term.ts";

type Field = Pick<MathfieldElement, "getElementInfo" | "lastOffset">;
/** A selection range as MathLive keeps it: the position before its first atom, the offset of its last atom. */
export type Range = [number, number];

/** How loosely an operator binds: an implicit product (two terms side by side) is 1. 0: no operator. */
function rank(l: string): number {
  if (/^(?:\\times|\\div|\\cdot)$/.test(l)) return 2;
  if (/^(?:[-+]|\\pm|\\mp)$/.test(l)) return 3;
  if (/^(?:[=<>]|\\(?:lt|gt|le|leq|ge|geq|ne|neq|to))$/.test(l)) return 4;
  if (isInfixWord(l)) return 5;
  if (/^[,;:]$/.test(l) || l === THIN || l === DIFF) return 6;
  return 0;
}
const LOOSEST = 6;

/** A term (rank 0) or an operator on a level, as the range it covers. */
interface Item {
  s: number;
  e: number;
  rank: number;
}

/** The level's atoms (term.ts level) read as terms and operators, in order. */
function items(mf: Field, row: number[]): Item[] {
  const out: Item[] = [];
  let done = -1;
  for (const o of row) {
    if (o <= done) continue; // inside the term before
    const l = latexAt(mf, o);
    const r = inNumber(mf, o, depthAt(mf, o)) ? 0 : rank(l);
    const [s, e] = r > 0 ? [atomStart(mf, o), o] : (termRange(mf, o) ?? [atomStart(mf, o), o]);
    out.push({ s, e, rank: r });
    done = e;
  }
  return out;
}

const term = (it: Item | undefined): boolean => it !== undefined && it.rank === 0;
const op = (it: Item | undefined, k: number): boolean => it !== undefined && it.rank > 0 && it.rank <= k;

/** The span of items [i, j] grown over every operator up to rank `k`, each with its operands (and a sign before one). */
function span(list: Item[], i: number, j: number, k: number): [number, number] {
  for (;;) {
    const [i0, j0] = [i, j];
    const left = list[i - 1];
    const before = list[i - 2];
    if (term(left) && term(list[i])) i--; // an implicit product
    else if (op(left, k) && term(before)) i -= 2; // the operator and its left operand
    else if (op(left, LOOSEST) && (before === undefined || before.rank > 0)) i--; // a sign (at the start, after an operator) binds first
    const right = list[j + 1];
    if (term(right) && term(list[j])) j++;
    else if (op(right, k)) {
      let n = j + 2;
      while (op(list[n], LOOSEST)) n++; // a sign before the operand
      if (term(list[n])) j = n;
    }
    if (i === i0 && j === j0) return [i, j];
  }
}

const holds = (outer: Range, inner: Range): boolean => outer[0] <= inner[0] && outer[1] >= inner[1];
const same = (a: Range, b: Range): boolean => a[0] === b[0] && a[1] === b[1];

/** The steps on the level of the atom at `o` that hold `r`, from the tightest to the whole box. */
function stepsOnLevel(mf: Field, o: number, r: Range): Range[] {
  const row = level(mf, o);
  const list = items(mf, row);
  const i = list.findIndex((it) => it.e > r[0]);
  let j = list.length - 1;
  while (j >= 0 && (list[j] as Item).s >= r[1]) j--;
  const out: Range[] = [];
  if (i >= 0 && j >= i)
    for (let k = 1; k <= LOOSEST; k++) {
      const [a, b] = span(list, i, j, k);
      out.push([(list[a] as Item).s, (list[b] as Item).e]);
    }
  out.push([atomStart(mf, row[0] as number), row[row.length - 1] as number]);
  return out;
}

/**
 * The next step of Select from the range `r` (collapsed: the cursor), or undefined where there is none: an empty line,
 * or the whole line already selected.
 */
export function growRange(mf: Field, r: Range): Range | undefined {
  const lo = Math.min(r[0], r[1]);
  const hi = Math.max(r[0], r[1]);
  if (mf.lastOffset < 1) return undefined;
  if (lo === hi) {
    // nothing selected: the term before the cursor, else the term after it, else the box the cursor is in
    const t = termRange(mf, lo) ?? termRange(mf, atomAfter(mf, lo));
    if (t) return t;
    const first = latexAt(mf, lo) === "" ? atomAfter(mf, lo) : lo;
    if (first > 0) return stepsOnLevel(mf, first, [lo, lo]).pop();
    const p = parentOf(mf, lo);
    return p > 0 ? (termRange(mf, p) ?? [atomStart(mf, p), p]) : undefined;
  }
  const now: Range = [lo, hi];
  for (let o = hi; o > 0; o = parentOf(mf, o)) {
    if (o !== hi) {
      const t = termRange(mf, o) ?? [atomStart(mf, o), o];
      if (holds(t, now) && !same(t, now)) return t;
    }
    for (const s of stepsOnLevel(mf, o, now)) if (holds(s, now) && !same(s, now)) return s;
  }
  return undefined;
}

/**
 * The chain of one run of Select presses, for Deselect: where it started (the cursor or the selection before the first
 * Select) and each step since. It holds while the selection is the chain's last step; any other key, ◀, ▶ or a tap
 * drops it (EntryController.endSelect, and a selection that is no longer the last step).
 */
export class SelectChain {
  private origin: Range | undefined;
  private steps: Range[] = [];

  /** Select: the range to select, or undefined where it stays (nothing to select, or the whole line). */
  grow(mf: Field, now: Range): Range | undefined {
    this.check(now);
    const next = growRange(mf, now);
    if (!next) return undefined;
    this.origin ??= now;
    this.steps.push(next);
    return next;
  }

  /** Deselect: the range to go back to (collapsed: the cursor where it was before the first Select), or undefined with no chain. */
  shrink(now: Range): Range | undefined {
    this.check(now);
    const origin = this.origin;
    if (!origin) return undefined;
    this.steps.pop();
    const back = this.steps[this.steps.length - 1] ?? origin;
    if (this.steps.length === 0) this.end();
    return back;
  }

  end(): void {
    this.origin = undefined;
    this.steps = [];
  }

  /** The selection is no longer the chain's last step (a tap, a key): the chain is gone. */
  private check(now: Range): void {
    const last = this.steps[this.steps.length - 1];
    if (!last || !same(last, [Math.min(...now), Math.max(...now)])) this.end();
  }
}
