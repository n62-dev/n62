// SPDX-License-Identifier: GPL-3.0-or-later
// R250 (mh-D1, must-have.md D): the RPN stack, UI-free. A level is a result chip (docs/04 2.8) with the identity of the
// row it came from, so nothing here evaluates: an operation is a row R251 composes from its operands, through the same
// path as a typed line (exact first, the marks, the chips); Giac's own RPN stays unreachable (engine/flags.ts). Units
// and ± stay on a level (mh-D3). Plain TypeScript, no runes, no engine and no session: R254 wires it to the keys, as
// a lazy part (never in the start chunk). Only erasable TypeScript syntax.
import type { Chip, ChipTable } from "../input/chips.ts";
import type { Layer } from "../keyboard/keyboard.ts";

/** Levels the stack holds: as many as a view's history holds rows (state/results.ts HISTORY_LIMIT); the deepest goes first. */
export const RPN_DEPTH = 200;
/** Changes Undo can take back. */
export const RPN_UNDOS = 32;

/** One level of the stack. */
export interface RpnLevel {
  /** The uid of the row the value came from (G211, results.ts rowUid): it survives a relaunch, and `dup` copies it. */
  uid: string;
  /** The value, as a tapped result gives it (results.ts chipOf; a unit row's R61 chip with its unit and σ). */
  chip: Chip;
  /** The LaTeX the level is drawn as (the row's result as drawn). */
  shown: string;
  /** The σ inputs the value rests on (inputsOf), sorted with no repeats: `row:<uid>`, `const:<ID>`, `pasl_<leaf>`. */
  inputs: string[];
}

/** Why a result cannot go on the stack: it gives no chip (a non-number over 2 kB, docs/04 2.8). */
export type PushRefusal = "noChip";

/** The stack and its undo. A change takes a snapshot first; a refused move changes nothing and takes none. */
export class RpnStack {
  /** Top first: `levels[0]` is level 1. Levels are never changed in place, so a snapshot is the array itself. */
  private now: readonly RpnLevel[];
  private undos: (readonly RpnLevel[])[] = [];

  constructor(levels: readonly RpnLevel[] = []) {
    this.now = levels.slice(0, RPN_DEPTH);
  }

  /** The levels, level 1 first. */
  get levels(): readonly RpnLevel[] {
    return this.now;
  }

  private change(next: readonly RpnLevel[]): true {
    this.undos.push(this.now);
    if (this.undos.length > RPN_UNDOS) this.undos.shift();
    this.now = next.slice(0, RPN_DEPTH);
    return true;
  }

  /** Put a level on top (the deepest goes when the stack is full). */
  push(level: RpnLevel): true {
    return this.change([level, ...this.now]);
  }

  /** Level 1 again, the same identity (uid and inputs): `x dup ×` is x², one input counted once. */
  dup(): boolean {
    const top = this.now[0];
    return top !== undefined && this.change([{ ...top, inputs: [...top.inputs] }, ...this.now]);
  }

  /** Remove level 1. */
  drop(): boolean {
    return this.now.length > 0 && this.change(this.now.slice(1));
  }

  /** Exchange levels 1 and 2. */
  swap(): boolean {
    const [a, b, ...rest] = this.now;
    return a !== undefined && b !== undefined && this.change([b, a, ...rest]);
  }

  /** The `n` levels an operation takes, level n first (`level 2 op level 1`); null when the stack holds fewer. Removes nothing. */
  operands(n: number): RpnLevel[] | null {
    return n >= 1 && this.now.length >= n ? this.now.slice(0, n).reverse() : null;
  }

  /** An operation's result replaces its `n` operands (one change, one undo); false when the stack holds fewer. */
  applied(n: number, result: RpnLevel): boolean {
    return n >= 1 && this.now.length >= n && this.change([result, ...this.now.slice(n)]);
  }

  /** The levels before the last change; false when there is none to take back. */
  undo(): boolean {
    const before = this.undos.pop();
    if (before === undefined) return false;
    this.now = before;
    return true;
  }
}

/** Whether a result can go on the stack: any chip can, with a unit or σ too (mh-D3); a result with no chip cannot. */
export function canPush(chip: Chip | undefined): PushRefusal | null {
  return chip === undefined ? "noChip" : null;
}

/** How a constant chip of a line enters σ: null, it has none; "own", by its own id (`const:<ID>`); else the
 *  `pasl_<leaf>` names it rests on through its basis (G81, as G271 keys them). The caller passes engine/constBasis.ts
 *  sigmaLeaves, the one reader of a basis's names (P20, G105): this file reads no names itself. */
export type ConstSigma = (c: Chip) => string[] | "own" | null;

/**
 * The σ inputs of a level pushed from row `uid` whose line held `chips` (HistoryItem.chips); `rowHasSigma`: the row's
 * result has a σ. Such a level rests on the row itself (`row:<uid>`) and on each σ constant of its line, by its basis
 * leaves when it has a basis (`pasl_<leaf>`, as G271 keys them), else by its id (`const:<ID>`). A σ result chip on the
 * line names no source row (its `res:<k>` is the entry's own counter): it counts as a new input, as on the algebraic
 * line (decisions.md R61). A level with no σ rests on none. `constSigma` reads each constant (ConstSigma).
 */
export function inputsOf(chips: ChipTable, uid: string, rowHasSigma: boolean, constSigma: ConstSigma): string[] {
  if (!rowHasSigma) return [];
  const out = new Set([`row:${uid}`]);
  for (const [k, c] of Object.entries(chips)) {
    if (!k.startsWith("const:")) continue;
    const via = constSigma(c);
    for (const i of via === "own" ? [k] : (via ?? [])) out.add(i);
  }
  return [...out].sort();
}

/** The union of the operands' inputs: an operation's level rests on all of them. */
export function inputsOfAll(levels: readonly RpnLevel[]): string[] {
  return [...new Set(levels.flatMap((l) => l.inputs))].sort();
}

/** One identity: the same row and the same value (a unit-view row replaced within one visit keeps its uid, resultItem.ts placed). */
export function sameIdentity(a: RpnLevel, b: RpnLevel): boolean {
  const x = a.chip, y = b.chip;
  return a.uid === b.uid && x.value === y.value && x.unc === y.unc && x.unit?.text === y.unit?.text;
}

/** Two levels that are not one identity but rest on a common σ input: combining them would count that input twice
 *  (R251 refuses the operation). One level and its `dup` are one input, never shared. */
export function sharesInput(a: RpnLevel, b: RpnLevel): boolean {
  if (sameIdentity(a, b)) return false;
  const seen = new Set(a.inputs);
  return b.inputs.some((i) => seen.has(i));
}

/** The keys that act on the stack, by key id and layer (spec/keyboard.yaml): 2 take levels 2 and 1, 1 takes level 1.
 *  Not ans.ts's ANS_FIRST, which mixes binary keys with x², x⁻¹ and Store ▶. */
const ARITY: Readonly<Record<string, Readonly<Partial<Record<Layer, 1 | 2>>>>> = {
  add: { primary: 2 },
  sub: { primary: 2 },
  mul: { primary: 2 },
  div: { primary: 2, shift: 1 }, // ÷, x⁻¹
  pow: { primary: 2 }, // xʸ (shift ⁿ√ is a template: 0)
  sq: { primary: 1, shift: 1 }, // x², √
  sin: { primary: 1, shift: 1 },
  cos: { primary: 1, shift: 1 },
  tan: { primary: 1, shift: 1 },
  ln: { primary: 1, shift: 1 }, // ln, eˣ
  log: { primary: 1, shift: 1 }, // log, 10ˣ
  neg: { shift: 1 }, // |x| ((−) types a minus)
  enter: { shift: 1 }, // ≈
};

/** How many levels the key takes in this layer; 0: no stack effect (it types or opens something, as in algebraic entry). */
export function arityOf(keyId: string, layer: Layer): 0 | 1 | 2 {
  return ARITY[keyId]?.[layer] ?? 0;
}
