// SPDX-License-Identifier: GPL-3.0-or-later
// R324: the atoms of the call Help's Insert replaces, from the cursor, on lines as MathLive 0.111.1 numbers them
// (offsets, latex, depth; the fixtures follow term.test.ts; helpkey.spec.ts checks the same on the real field). A range
// is [position before, last atom]; the fake's getValue joins the atoms of the range's level, as MathLive serialises them.
import { describe, expect, test } from "vitest";
import { callRange } from "./callRange.ts";

type Atom = [latex: string, depth: number];
type Field = Parameters<typeof callRange>[0];

function field(atoms: Atom[]): Field {
  const info = (o: number) => {
    const a = atoms[o];
    return a ? { latex: a[0], depth: a[1] } : undefined;
  };
  return {
    lastOffset: atoms.length - 1,
    getElementInfo: info,
    getValue: (s: number, e: number) =>
      atoms
        .slice(s + 1, e + 1)
        .filter((a) => a[1] === atoms[e]?.[1])
        .map((a) => a[0])
        .join(""),
  } as unknown as Field;
}

// 2+\sin(45): 1 `2`, 2 `+`, 3 `\sin`, 4 (body), 5 `4`, 6 `5`, 7 the pair
const SIN: Atom[] = [["", 0], ["2", 0], ["+", 0], ["\\sin", 0], ["", 1], ["4", 1], ["5", 1], ["\\left(45\\right)", 0]];
const SIN_TEXT = "\\sin\\left(45\\right)";
// \cos(\sin(□)): 1 `\cos`, 2 (cos body), 3 `\sin`, 4 (sin body), 5 □, 6 sin's pair, 7 cos's pair
const NEST: Atom[] = [
  ["", 0], ["\\cos", 0], ["", 1], ["\\sin", 1], ["", 2], ["\\placeholder{}", 2], ["\\left(\\placeholder{}\\right)", 1], ["\\left(\\sin\\left(\\placeholder{}\\right)\\right)", 0],
];
// \sin(1)^2: 1 `\sin`, 2 (body), 3 `1`, 4 the pair, 5 (exponent), 6 `2`, 7 the power
const POW: Atom[] = [["", 0], ["\\sin", 0], ["", 1], ["1", 1], ["\\left(1\\right)", 0], ["", 1], ["2", 1], ["^2", 0]];
// |-2|: 1 (body), 2 `-`, 3 `2`, 4 the bars
const ABS: Atom[] = [["", 0], ["", 1], ["-", 1], ["2", 1], ["\\left|-2\\right|", 0]];

describe("callRange (R324)", () => {
  test("the call that holds the cursor: in its bracket, at its start, on its name", () => {
    for (const at of [4, 5, 6, 3]) expect(callRange(field(SIN), at, SIN_TEXT), `at ${at}`).toEqual([2, 7]);
  });

  test("a call inside another: the inner one alone; the outer one when it is the call named", () => {
    const inner = "\\sin\\left(\\placeholder{}\\right)";
    expect(callRange(field(NEST), 5, inner)).toEqual([2, 6]);
    expect(callRange(field(NEST), 6, `\\cos\\left(${inner}\\right)`)).toEqual([0, 7]);
  });

  test("the line cursorAt.ts reads has no empty slot where its mark stood: the slots are left out of both texts", () => {
    expect(callRange(field(NEST), 5, "\\sin\\left(\\right)")).toEqual([2, 6]);
  });

  test("a power after the call stays; a shape with no name is taken whole", () => {
    expect(callRange(field(POW), 3, "\\sin\\left(1\\right)")).toEqual([0, 4]);
    expect(callRange(field(ABS), 3, "\\left|-2\\right|")).toEqual([0, 4]);
  });

  test("no range from the cursor with the call's text: none (the caller inserts at the cursor)", () => {
    expect(callRange(field(SIN), 1, SIN_TEXT)).toBeUndefined(); // the cursor before the call
    expect(callRange(field(SIN), 5, "\\cos\\left(45\\right)")).toBeUndefined(); // another call's text
    expect(callRange(field(SIN), 5, "")).toBeUndefined();
    expect(callRange(field(SIN), 99, SIN_TEXT)).toBeUndefined();
  });
});
