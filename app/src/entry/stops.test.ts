// SPDX-License-Identifier: GPL-3.0-or-later
// R867: runEnd, where a drag step's token ends, on lines as MathLive 0.111.1 numbers them (offsets, latex, depth; the
// fixtures follow grow.test.ts, and trackpadtoken.spec.ts checks the same steps on the real field).
import { describe, expect, test } from "vitest";
import { runEnd } from "./stops.ts";

type Atom = [latex: string, depth: number];
type Field = Parameters<typeof runEnd>[0];

function field(atoms: Atom[]): Field {
  return {
    lastOffset: atoms.length - 1,
    getElementInfo: (o: number) => {
      const a = atoms[o];
      return a ? { latex: a[0], depth: a[1] } : undefined;
    },
  } as unknown as Field;
}

// 12+345: 1 `1`, 2 `2`, 3 `+`, 4 `3`, 5 `4`, 6 `5`
const DIGITS: Atom[] = [["", 0], ["1", 0], ["2", 0], ["+", 0], ["3", 0], ["4", 0], ["5", 0]];
// 0.5+1: 1 `0`, 2 `.`, 3 `5`, 4 `+`, 5 `1`
const POINT: Atom[] = [["", 0], ["0", 0], [".", 0], ["5", 0], ["+", 0], ["1", 0]];
// 3{,}14 (the decimal comma, R57): 1 `3`, 2-3 the comma's parts, 4 the comma, 5 `1`, 6 `4`
const COMMA: Atom[] = [["", 0], ["3", 0], ["", 1], [",", 1], ["{,}", 0], ["1", 0], ["4", 0]];
// 2×1.5ᴇ-3: 1 `2`, 2 `×`, 3 `1`, 4 `.`, 5 `5`, 6-9 the mark's parts, 10 the mark, 11 `-`, 12 `3`
const ENUM: Atom[] = [["", 0], ["2", 0], ["\\times", 0], ["1", 0], [".", 0], ["5", 0], ["", 1], ["", 2], ["ᴇ", 2], ["\\mathopen{ᴇ}", 1], ["\\emark", 0], ["-", 0], ["3", 0]];
// 1ᴇ23 (no sign): 1 `1`, 2-5 the mark's parts, 6 the mark, 7 `2`, 8 `3`
const EBARE: Atom[] = [["", 0], ["1", 0], ["", 1], ["", 2], ["ᴇ", 2], ["\\mathopen{ᴇ}", 1], ["\\emark", 0], ["2", 0], ["3", 0]];
// abc+x2: 1 `a`, 2 `b`, 3 `c`, 4 `+`, 5 `x`, 6 `2`
const LETTERS: Atom[] = [["", 0], ["a", 0], ["b", 0], ["c", 0], ["+", 0], ["x", 0], ["2", 0]];
// \frac{12}{34}56: 1 (numerator), 2 `1`, 3 `2`, 4 (denominator), 5 `3`, 6 `4`, 7 the fraction, 8 `5`, 9 `6`
const FRAC: Atom[] = [["", 0], ["", 1], ["1", 1], ["2", 1], ["", 1], ["3", 1], ["4", 1], ["\\frac{12}{34}", 0], ["5", 0], ["6", 0]];

describe("runEnd: a token's end from a position inside it", () => {
  test("digits: inside a run it goes to the run's end, each way; at an edge it stays", () => {
    const f = field(DIGITS);
    expect(runEnd(f, 1, 1)).toBe(2);
    expect(runEnd(f, 1, -1)).toBe(0);
    expect(runEnd(f, 4, 1)).toBe(6);
    expect(runEnd(f, 5, -1)).toBe(3);
    expect(runEnd(f, 2, 1)).toBe(2); // 12|+: the operator is no part
    expect(runEnd(f, 3, -1)).toBe(3);
    expect(runEnd(f, 0, 1)).toBe(0);
    expect(runEnd(f, 6, 1)).toBe(6);
  });
  test("a point is part of the number", () => {
    const f = field(POINT);
    expect(runEnd(f, 1, 1)).toBe(3);
    expect(runEnd(f, 2, -1)).toBe(0);
  });
  test("the decimal comma {,} is part of the number; its own parts are skipped", () => {
    const f = field(COMMA);
    expect(runEnd(f, 1, 1)).toBe(6);
    expect(runEnd(f, 5, -1)).toBe(0);
    expect(runEnd(f, 4, -1)).toBe(0);
  });
  test("ᴇ with a sign: the mantissa, ᴇ-, the exponent's digits are three tokens", () => {
    const f = field(ENUM);
    expect(runEnd(f, 3, 1)).toBe(5); // stops before the mark
    expect(runEnd(f, 10, 1)).toBe(11); // the mark goes with its sign
    expect(runEnd(f, 11, 1)).toBe(11); // the sign and the digits are two tokens
    expect(runEnd(f, 10, -1)).toBe(5); // back over ᴇ- to the mantissa's end
    expect(runEnd(f, 4, -1)).toBe(2);
  });
  test("ᴇ with no sign: the mark is a token of its own", () => {
    const f = field(EBARE);
    expect(runEnd(f, 1, 1)).toBe(1);
    expect(runEnd(f, 6, 1)).toBe(6);
    expect(runEnd(f, 7, 1)).toBe(8);
    expect(runEnd(f, 7, -1)).toBe(6);
  });
  test("a run of single letters; a letter and a digit are two tokens", () => {
    const f = field(LETTERS);
    expect(runEnd(f, 1, 1)).toBe(3);
    expect(runEnd(f, 2, -1)).toBe(0);
    expect(runEnd(f, 5, 1)).toBe(5); // x|2
  });
  test("a box's edge ends a token: the walk stays in the box", () => {
    const f = field(FRAC);
    expect(runEnd(f, 2, 1)).toBe(3); // to the numerator's end, not into the denominator
    expect(runEnd(f, 2, -1)).toBe(1); // to the numerator's start
    expect(runEnd(f, 5, 1)).toBe(6);
    expect(runEnd(f, 6, 1)).toBe(6); // the denominator's end
    expect(runEnd(f, 7, 1)).toBe(7); // after the fraction: the 5 is no part of it
    expect(runEnd(f, 8, 1)).toBe(9);
  });
});
