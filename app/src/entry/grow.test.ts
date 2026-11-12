// SPDX-License-Identifier: GPL-3.0-or-later
// R279: Select's chain on lines as MathLive 0.111.1 numbers them (offsets, latex, depth; the fixtures follow term.test.ts,
// and selectgrow.spec.ts checks the same steps on the real field). A range is [position before, last atom].
import { describe, expect, test } from "vitest";
import { SelectChain, growRange, type Range } from "./grow.ts";

type Atom = [latex: string, depth: number];
type Field = Parameters<typeof growRange>[0];

function field(atoms: Atom[]): Field {
  return {
    lastOffset: atoms.length - 1,
    getElementInfo: (o: number) => {
      const a = atoms[o];
      return a ? { latex: a[0], depth: a[1] } : undefined;
    },
  } as unknown as Field;
}

/** Every step of Select from the cursor at `at`, up to where it stays. */
function chain(atoms: Atom[], at: number): Range[] {
  const f = field(atoms);
  const out: Range[] = [];
  for (let r: Range | undefined = [at, at]; (r = growRange(f, r)); ) {
    out.push(r);
    if (out.length > 20) throw new Error("no end");
  }
  return out;
}

// 2+3·4: 1 `2`, 2 `+`, 3 `3`, 4 `·`, 5 `4`
const SUM: Atom[] = [["", 0], ["2", 0], ["+", 0], ["3", 0], ["\\cdot", 0], ["4", 0]];
// \frac{1+2}{3}: 1 (numerator), 2 `1`, 3 `+`, 4 `2`, 5 (denominator), 6 `3`, 7 the fraction
const FRAC: Atom[] = [["", 0], ["", 1], ["1", 1], ["+", 1], ["2", 1], ["", 1], ["3", 1], ["\\frac{1+2}{3}", 0]];
// \sqrt{x^2+1}: 1 (radicand), 2 `x`, 3 (exponent), 4 `2`, 5 the power, 6 `+`, 7 `1`, 8 the root
const ROOT: Atom[] = [["", 0], ["", 1], ["x", 1], ["", 2], ["2", 2], ["^2", 1], ["+", 1], ["1", 1], ["\\sqrt{x^2+1}", 0]];
// sin(2x)+1: 1 `\sin`, 2 (body), 3 `2`, 4 `x`, 5 the pair, 6 `+`, 7 `1`
const SIN: Atom[] = [["", 0], ["\\sin", 0], ["", 1], ["2", 1], ["x", 1], ["\\left(2x\\right)", 0], ["+", 0], ["1", 0]];
// 2+Ans-chip×3: 1 `2`, 2 `+`, 3-5 the chip's parts, 6 the chip, 7 `×`, 8 `3`
const CHIP: Atom[] = [["", 0], ["2", 0], ["+", 0], ["", 1], ["", 2], ["\\htmlStyle{}{}", 1], ["\\res{1}", 0], ["\\times", 0], ["3", 0]];
// 2×1.5ᴇ-3: 1 `2`, 2 `×`, 3 `1`, 4 `.`, 5 `5`, 6-9 the mark's parts and the mark, 10 `-`, 11 `3`
const ENUM: Atom[] = [["", 0], ["2", 0], ["\\times", 0], ["1", 0], [".", 0], ["5", 0], ["", 1], ["", 2], ["ᴇ", 2], ["\\mathopen{ᴇ}", 1], ["\\emark", 0], ["-", 0], ["3", 0]];

describe("growRange: each step from the cursor", () => {
  test("2+3·4, cursor at the end: 4, then 3·4 (the operand of +), then the line, where it stays", () => {
    expect(chain(SUM, 5)).toEqual([[4, 5], [2, 5], [0, 5]]);
  });
  test("2+3·4, cursor after the 2: 2, then the line", () => {
    expect(chain(SUM, 1)).toEqual([[0, 1], [0, 5]]);
  });
  test("2+3·4, cursor at the start: the term after it", () => {
    expect(growRange(field(SUM), [0, 0])).toEqual([0, 1]);
  });
  test("\\frac{1+2}{3}, cursor after the 2: 2, 1+2 (the numerator), the fraction (the line)", () => {
    expect(chain(FRAC, 4)).toEqual([[3, 4], [1, 4], [0, 7]]);
  });
  test("\\frac{1+2}{3}, cursor in the denominator: 3, the fraction", () => {
    expect(chain(FRAC, 6)).toEqual([[5, 6], [0, 7]]);
  });
  test("\\frac{1+2}{3}, cursor after it: the fraction, the term x² takes", () => {
    expect(chain(FRAC, 7)).toEqual([[0, 7]]);
  });
  test("\\sqrt{x^2+1}, cursor after x²: x², x²+1 (the radicand), the root", () => {
    expect(chain(ROOT, 5)).toEqual([[1, 5], [1, 7], [0, 8]]);
  });
  test("\\sqrt{x^2+1}, cursor in the exponent: 2, x², x²+1, the root", () => {
    expect(chain(ROOT, 4)).toEqual([[3, 4], [1, 5], [1, 7], [0, 8]]);
  });
  test("sin(2x)+1, cursor after the x: x, 2x (the argument), sin(2x) with its name, the line", () => {
    expect(chain(SIN, 4)).toEqual([[3, 4], [2, 4], [0, 5], [0, 7]]);
  });
  test("sin(2x)+1, cursor after the bracket: the call, the line", () => {
    expect(chain(SIN, 5)).toEqual([[0, 5], [0, 7]]);
  });
  test("a chip is one term: the chip, chip×3, the line", () => {
    expect(chain(CHIP, 6)).toEqual([[2, 6], [2, 8], [0, 8]]);
  });
  test("1.5ᴇ-3 is one term: its − is no operator; then 2×1.5ᴇ-3, the line", () => {
    expect(chain(ENUM, 12)).toEqual([[2, 12], [0, 12]]);
  });
  test("an empty line: nothing to select", () => {
    expect(growRange(field([["", 0]]), [0, 0])).toBeUndefined();
  });
  test("a sign binds first: 2+5·-3, from the 3: 3, -3, the product 5·-3, the line", () => {
    const f: Atom[] = [["", 0], ["2", 0], ["+", 0], ["5", 0], ["\\cdot", 0], ["-", 0], ["3", 0]];
    expect(chain(f, 6)).toEqual([[5, 6], [4, 6], [2, 6], [0, 6]]);
  });
  test("a relation is looser than +: x+1=2, from the 1: 1, x+1, the line", () => {
    const f: Atom[] = [["", 0], ["x", 0], ["+", 0], ["1", 0], ["=", 0], ["2", 0]];
    expect(chain(f, 3)).toEqual([[2, 3], [0, 3], [0, 5]]);
  });
  test("a selection made by hand grows from itself: the 3·4 of 2+3·4 becomes the line", () => {
    expect(growRange(field(SUM), [2, 5])).toEqual([0, 5]);
  });
});

describe("SelectChain: Deselect walks the chain back", () => {
  test("Grow, Grow, Shrink, Shrink: 4, 3·4, back to 4, then the cursor where it was", () => {
    const f = field(SUM);
    const c = new SelectChain();
    expect(c.grow(f, [5, 5])).toEqual([4, 5]);
    expect(c.grow(f, [4, 5])).toEqual([2, 5]);
    expect(c.shrink([2, 5])).toEqual([4, 5]);
    expect(c.shrink([4, 5])).toEqual([5, 5]);
    expect(c.shrink([5, 5])).toBeUndefined(); // no chain: Deselect does nothing
  });
  test("at the whole line Select stays, and Shrink still goes back one step", () => {
    const f = field(SUM);
    const c = new SelectChain();
    c.grow(f, [1, 1]);
    c.grow(f, [0, 1]);
    expect(c.grow(f, [0, 5])).toBeUndefined();
    expect(c.shrink([0, 5])).toEqual([0, 1]);
  });
  test("a selection that is no longer the last step (a tap, a key) drops the chain", () => {
    const f = field(SUM);
    const c = new SelectChain();
    c.grow(f, [5, 5]);
    expect(c.shrink([2, 3])).toBeUndefined();
    c.grow(f, [5, 5]);
    c.end(); // any other key
    expect(c.shrink([4, 5])).toBeUndefined();
  });
  test("a Select after a tap starts a new chain from there", () => {
    const f = field(SUM);
    const c = new SelectChain();
    c.grow(f, [5, 5]);
    expect(c.grow(f, [1, 1])).toEqual([0, 1]);
    expect(c.shrink([0, 1])).toEqual([1, 1]);
  });
});
