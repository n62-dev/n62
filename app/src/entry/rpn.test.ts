// SPDX-License-Identifier: GPL-3.0-or-later
// R250: the RPN stack model (entry/rpn.ts): levels of result chips, the stack moves and their undo, what may be pushed,
// the σ inputs a level rests on, and the keys' arity.
import { describe, expect, it } from "vitest";
import { sigmaLeaves } from "../engine/constBasis.ts";
import type { Chip } from "../input/chips.ts";
import { HISTORY_LIMIT } from "../state/results.ts";
import { arityOf, canPush, inputsOf, inputsOfAll, RPN_DEPTH, RPN_UNDOS, RpnStack, sharesInput, type RpnLevel } from "./rpn.ts";

/** A level of row `uid` worth `value`: an exact chip, drawn as its value, no σ inputs. */
const L = (uid: string, value = "1", inputs: string[] = []): RpnLevel => ({ uid, chip: { value, exact: true }, shown: value, inputs });
const sigma = (value: string, unc: string): Chip => ({ value, exact: false, unc });
const stackOf = (...top: RpnLevel[]): RpnStack => {
  const s = new RpnStack();
  for (const l of [...top].reverse()) s.push(l);
  return s;
};

describe("RpnStack moves", () => {
  it("push puts the new level on top", () => {
    const s = new RpnStack();
    s.push(L("u1"));
    s.push(L("u2"));
    expect(s.levels).toEqual([L("u2"), L("u1")]);
  });

  it("dup copies level 1 with its uid", () => {
    const s = stackOf(L("u7"));
    expect(s.dup()).toBe(true);
    expect(s.levels).toHaveLength(2);
    expect(s.levels.map((l) => l.uid)).toEqual(["u7", "u7"]);
  });

  it("drop removes level 1", () => {
    const s = stackOf(L("u2"), L("u1"));
    expect(s.drop()).toBe(true);
    expect(s.levels).toEqual([L("u1")]);
  });

  it("drop, dup and swap on an empty stack are refused; swap on one level too", () => {
    const s = new RpnStack();
    expect(s.drop()).toBe(false);
    expect(s.dup()).toBe(false);
    expect(s.swap()).toBe(false);
    expect(s.levels).toEqual([]);
    expect(s.undo()).toBe(false); // a refused move takes no snapshot
    s.push(L("u1"));
    expect(s.swap()).toBe(false);
    expect(s.levels).toEqual([L("u1")]);
  });

  it("swap exchanges levels 1 and 2, each with its uid and inputs", () => {
    const a = L("u2", "2", ["row:u2"]);
    const b = L("u1", "1", ["const:G", "row:u1"]);
    const s = stackOf(a, b);
    expect(s.swap()).toBe(true);
    expect(s.levels).toEqual([b, a]);
  });

  it("operands reads level 2 first and removes nothing; applied replaces them by the result", () => {
    const s = stackOf(L("u2"), L("u1"));
    expect(s.operands(2)).toEqual([L("u1"), L("u2")]);
    expect(s.levels).toEqual([L("u2"), L("u1")]);
    expect(stackOf(L("u1")).operands(2)).toBeNull();
    expect(s.applied(2, L("u3"))).toBe(true);
    expect(s.levels).toEqual([L("u3")]);
    expect(s.applied(2, L("u4"))).toBe(false);
    expect(s.levels).toEqual([L("u3")]);
  });

  it("holds as many levels as the history holds rows; the deepest goes first", () => {
    expect(RPN_DEPTH).toBe(HISTORY_LIMIT);
    const s = new RpnStack();
    for (let i = 1; i <= RPN_DEPTH + 1; i++) s.push(L(`u${i}`));
    expect(s.levels).toHaveLength(RPN_DEPTH);
    expect(s.levels[0]?.uid).toBe(`u${RPN_DEPTH + 1}`);
    expect(s.levels.at(-1)?.uid).toBe("u2");
  });
});

describe("RpnStack undo", () => {
  it("undo puts back the levels before each change", () => {
    const s = new RpnStack();
    s.push(L("u1"));
    s.push(L("u2"));
    s.swap();
    s.applied(2, L("u3"));
    expect(s.undo()).toBe(true);
    expect(s.levels).toEqual([L("u1"), L("u2")]);
    expect(s.undo()).toBe(true);
    expect(s.levels).toEqual([L("u2"), L("u1")]);
    expect(s.undo()).toBe(true);
    expect(s.levels).toEqual([L("u1")]);
    expect(s.undo()).toBe(true);
    expect(s.levels).toEqual([]);
    expect(s.undo()).toBe(false);
  });

  it("keeps the last 32 snapshots", () => {
    expect(RPN_UNDOS).toBe(32);
    const s = new RpnStack();
    for (let i = 1; i <= 33; i++) s.push(L(`u${i}`));
    for (let i = 0; i < 32; i++) expect(s.undo()).toBe(true);
    expect(s.levels).toEqual([L("u1")]);
    expect(s.undo()).toBe(false);
    expect(s.levels).toEqual([L("u1")]);
  });
});

describe("canPush", () => {
  it("takes every chip, with a unit or σ too; refuses a result with none", () => {
    const unit = { text: "m", dim: "m1", slot: { tokens: [{ unit: "m" }] } };
    expect(canPush({ value: "3", exact: true })).toBeNull();
    expect(canPush({ value: "3", exact: true, unit })).toBeNull();
    expect(canPush(sigma("3", "0.1"))).toBeNull();
    expect(canPush({ ...sigma("3", "0.1"), unit })).toBeNull();
    expect(canPush(undefined)).toBe("noChip");
  });
});

describe("inputsOf", () => {
  it("names the row and the σ constants, never a line's result chips", () => {
    const chips = { "res:3": sigma("2.5", "0.1"), "const:G": sigma("6.6743E-11", "1.5E-15"), "res:4": { value: "2", exact: true } };
    expect(inputsOf(chips, "u9", true, sigmaLeaves)).toEqual(["const:G", "row:u9"]);
  });

  it("a constant with a basis rests on its uncertain leaves", () => {
    const c: Chip = {
      ...sigma("1.2566E-6", "1.9E-16"),
      basis: "2*pasl_alpha*pasl_h/(pasl_e^2*pasl_c)",
      basisLeaves: { alpha: { value: "0.0072973525643", unc: "1.1E-12" }, h: { value: "6.62607015E-34", unc: "0" }, e: { value: "1.602176634E-19", unc: "0" }, c: { value: "299792458", unc: "0" } },
    };
    expect(inputsOf({ "const:mu0": c }, "u9", true, sigmaLeaves)).toEqual(["pasl_alpha", "row:u9"]);
    // a basis naming a leaf it does not carry is malformed: the constant enters by its own id (constBasis.ts basisOf)
    const bad: Chip = { ...c, basis: "pasl_alpha*pasl_x" };
    expect(inputsOf({ "const:mu0": bad }, "u9", true, sigmaLeaves)).toEqual(["const:mu0", "row:u9"]);
  });

  it("reads a basis's leaves by the one rule of names (constBasis.ts, P20), as Home and the unit view do", () => {
    const leaves = { a: { value: "2", unc: "0.1" }, b: { value: "3", unc: "0.2" } };
    // `xpasl_a` is one name, not the leaf a: the basis names no leaf, so the constant rests on none of them
    const glued: Chip = { ...sigma("4", "0.2"), basis: "2*xpasl_a", basisLeaves: leaves };
    expect(inputsOf({ "const:K": glued }, "u9", true, sigmaLeaves)).toEqual(["row:u9"]);
    // a σ of zero is no σ (a constant of zero uncertainty, and a leaf of one, adds no input)
    expect(inputsOf({ "const:K": sigma("4", "0E-11") }, "u9", true, sigmaLeaves)).toEqual(["row:u9"]);
    const zeroLeaf: Chip = { ...sigma("6", "0.3"), basis: "pasl_a*pasl_b", basisLeaves: { ...leaves, b: { value: "3", unc: "0.0" } } };
    expect(inputsOf({ "const:K": zeroLeaf }, "u9", true, sigmaLeaves)).toEqual(["pasl_a", "row:u9"]);
  });

  it("a row with no σ rests on none", () => {
    expect(inputsOf({ "res:1": { value: "2", exact: true }, "const:pi": { value: "pi", exact: true } }, "u9", false, sigmaLeaves)).toEqual([]);
    expect(inputsOf({}, "u9", false, sigmaLeaves)).toEqual([]);
  });
});

describe("inputsOfAll", () => {
  it("an operation's level rests on its operands' inputs, sorted with no repeats", () => {
    expect(inputsOfAll([L("u2", "1", ["row:u2", "const:G"]), L("u1", "1", ["const:G", "pasl_a"])])).toEqual(["const:G", "pasl_a", "row:u2"]);
    expect(inputsOfAll([L("u2"), L("u1")])).toEqual([]);
  });
});

describe("sharesInput", () => {
  it("two identities that rest on one input share it", () => {
    expect(sharesInput(L("u8", "1", ["row:u7"]), L("u7", "1", ["row:u7"]))).toBe(true);
  });
  it("one level and its dup are one input", () => {
    const s = stackOf(L("u7", "5", ["row:u7"]));
    s.dup();
    const [a, b] = s.levels as [RpnLevel, RpnLevel];
    expect(sharesInput(a, b)).toBe(false);
  });
  it("a uid whose value changed is another identity", () => {
    expect(sharesInput(L("u7", "5", ["row:u7"]), L("u7", "6", ["row:u7"]))).toBe(true);
    const unit = (text: string) => ({ value: "5", exact: false, unc: "0.1", unit: { text, dim: "m1", slot: { tokens: [{ unit: text }] } } });
    expect(sharesInput({ uid: "u7", chip: unit("m"), shown: "5", inputs: ["row:u7"] }, { uid: "u7", chip: unit("km"), shown: "5", inputs: ["row:u7"] })).toBe(true);
  });
  it("disjoint or empty inputs share nothing", () => {
    expect(sharesInput(L("u8", "1", ["row:u8"]), L("u7", "1", ["row:u7"]))).toBe(false);
    expect(sharesInput(L("u8"), L("u7"))).toBe(false);
  });
});

describe("arityOf", () => {
  it("reads the key table", () => {
    expect(arityOf("add", "primary")).toBe(2);
    expect(arityOf("div", "primary")).toBe(2);
    expect(arityOf("div", "shift")).toBe(1);
    expect(arityOf("sq", "primary")).toBe(1);
    expect(arityOf("sq", "shift")).toBe(1);
    expect(arityOf("log", "shift")).toBe(1);
    expect(arityOf("neg", "shift")).toBe(1);
    expect(arityOf("enter", "shift")).toBe(1);
    expect(arityOf("neg", "primary")).toBe(0);
    expect(arityOf("pow", "shift")).toBe(0);
    expect(arityOf("emark", "shift")).toBe(0);
    expect(arityOf("frac", "primary")).toBe(0);
    expect(arityOf("paren", "primary")).toBe(0);
    expect(arityOf("add", "alpha")).toBe(0);
  });
});
