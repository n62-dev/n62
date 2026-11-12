// SPDX-License-Identifier: GPL-3.0-or-later
// R277: the term of an atom and the term under a point, on lines as MathLive 0.111.1 numbers them (each fixture is what
// getElementInfo gave for offsets 0…lastOffset, read in the browser: latex and depth; bounds where the test needs them).
import { describe, expect, test } from "vitest";
import { termAt, termRange } from "./term.ts";

type Atom = [latex: string, depth: number, bounds?: [left: number, right: number]];

function field(atoms: Atom[], hit: (x: number) => number = () => 0) {
  return {
    lastOffset: atoms.length - 1,
    getElementInfo: (o: number) => {
      const a = atoms[o];
      if (!a) return undefined;
      const [latex, depth, b] = a;
      return { latex, depth, bounds: b ? new DOMRectish(b[0], b[1]) : undefined };
    },
    getOffsetFromPoint: (x: number) => hit(x),
  } as unknown as Parameters<typeof termAt>[0];
}

/** DOMRect is a browser class; termAt reads left, right, top and bottom only. */
class DOMRectish {
  readonly top = 0;
  readonly bottom = 40;
  constructor(
    readonly left: number,
    readonly right: number,
  ) {}
}

const ENUM: Atom[] = [["", 0], ["2", 0], ["+", 0], ["1", 0], [".", 0], ["5", 0], ["", 1], ["", 2], ["ᴇ", 2], ["\\mathopen{ᴇ}", 1], ["\\emark", 0], ["-", 0], ["3", 0], ["\\times", 0], ["4", 0]];
const POWER_CHIP: Atom[] = [["", 0], ["1", 0], ["2", 0], ["", 1], ["3", 1], ["^3", 0], ["+", 0], ["", 1], ["", 2], ["\\htmlStyle{}{}", 1], ["\\res{1}", 0]];
const SIN: Atom[] = [["", 0], ["5", 0], ["\\sin", 0], ["", 1], ["2", 1], ["3", 1], ["\\left(23\\right)", 0], ["+", 0], ["1", 0]];
const FRAC: Atom[] = [["", 0], ["", 1], ["1", 1], ["2", 1], ["", 1], ["3", 1], ["4", 1], ["\\frac{12}{34}", 0]];
const PAIR_POWER: Atom[] = [["", 0], ["", 1], ["1", 1], ["+", 1], ["2", 1], ["\\left(1+2\\right)", 0], ["", 1], ["2", 1], ["^2", 0]];
const COMMA: Atom[] = [["", 0], ["1", 0], ["", 1], [",", 1], ["{,}", 0], ["5", 0]];

describe("termRange", () => {
  test("a number with its ᴇ part, from any of its atoms; the operators around it are no term", () => {
    const f = field(ENUM);
    for (const o of [3, 5, 10, 11, 12]) expect(termRange(f, o), `offset ${o}`).toEqual([2, 12]);
    expect(termRange(f, 1)).toEqual([0, 1]);
    expect(termRange(f, 14)).toEqual([13, 14]);
    expect(termRange(f, 2)).toBeUndefined();
    expect(termRange(f, 13)).toBeUndefined();
    expect(termRange(f, 0)).toBeUndefined();
  });
  test("a number takes its power; the exponent alone is its own term; a chip is one term", () => {
    const f = field(POWER_CHIP);
    expect(termRange(f, 1)).toEqual([0, 5]);
    expect(termRange(f, 5)).toEqual([0, 5]);
    expect(termRange(f, 4)).toEqual([3, 4]);
    expect(termRange(f, 10)).toEqual([6, 10]);
  });
  test("a function's name and its bracket are one term; inside the bracket, the number there", () => {
    const f = field(SIN);
    expect(termRange(f, 2)).toEqual([1, 6]);
    expect(termRange(f, 6)).toEqual([1, 6]);
    expect(termRange(f, 4)).toEqual([3, 5]);
    expect(termRange(f, 1)).toEqual([0, 1]);
    expect(termRange(f, 8)).toEqual([7, 8]);
  });
  test("a fraction whole, or the number of one of its parts", () => {
    const f = field(FRAC);
    expect(termRange(f, 7)).toEqual([0, 7]);
    expect(termRange(f, 2)).toEqual([1, 3]);
    expect(termRange(f, 6)).toEqual([4, 6]);
  });
  test("a bracket group with its power; an operator in it is no term", () => {
    const f = field(PAIR_POWER);
    expect(termRange(f, 5)).toEqual([0, 8]);
    expect(termRange(f, 8)).toEqual([0, 8]);
    expect(termRange(f, 3)).toBeUndefined();
  });
  test("a number with the decimal comma (R57) is one term", () => {
    const f = field(COMMA);
    for (const o of [1, 4, 5]) expect(termRange(f, o), `offset ${o}`).toEqual([0, 5]);
  });
});

describe("termAt", () => {
  // \sqrt{2}x as drawn: MathLive's nearest atom on the root's sign is the line's start (offset 0)
  const ROOT: Atom[] = [["", 0, [27, 28]], ["", 1, [55, 56]], ["2", 1, [56, 69]], ["\\sqrt{2}", 0, [28, 69]], ["x", 0, [75, 90]]];
  const hit = (x: number): number => (x < 55 ? 0 : x < 72 ? 2 : 4);
  test("on a root's sign the root, on the radicand its number, on a letter the letter", () => {
    const f = field(ROOT, hit);
    expect(termAt(f, 31, 20)).toEqual([0, 3]);
    expect(termAt(f, 60, 20)).toEqual([1, 2]);
    expect(termAt(f, 80, 20)).toEqual([3, 4]);
  });
  test("on empty space past the line, nothing", () => {
    expect(termAt(field(ROOT, () => 4), 120, 20)).toBeUndefined();
  });
  test("beside a nested atom's box (above or below it), the atom around it", () => {
    const f = field(ROOT, hit);
    expect(termAt(f, 60, 60)).toEqual([0, 3]);
  });
});
