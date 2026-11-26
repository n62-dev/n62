// SPDX-License-Identifier: GPL-3.0-or-later
// R149, R881: the check before Enter that takes an easter egg's word off the line: N62 (n62 in CAS, where Alpha types lower
// case) opens the credits sheet, rainbow (any case) the rainbow mode. A chip or a stored name that makes the line a calculation
// keeps it one.
import { describe, expect, it } from "vitest";
import type { UserName } from "../calc/port.ts";
import { eggOf } from "./credits.ts";

const name = (n: string): UserName => ({ name: n, kind: "var", preview: "5", view: "home", time: 0 });

describe("eggOf: N62 (R149)", () => {
  it("is the credits for N62 and n62", () => {
    expect(eggOf("N62", [])).toBe("credits");
    expect(eggOf("n62", [])).toBe("credits");
  });
  it("is nothing for anything else on the line", () => {
    for (const v of ["N62+1", "2N62", " N62", "N62 ", "N 62", "N6", "", "N62\\times 2"]) expect(eggOf(v, [])).toBeUndefined();
  });
  it("is nothing with a chip on the line", () => {
    expect(eggOf("N62", [], { x: 1 })).toBeUndefined();
    expect(eggOf("N62", [], {})).toBe("credits");
  });
  it("is nothing when the user stored the name N62 or n62", () => {
    expect(eggOf("N62", [name("N62")])).toBeUndefined();
    expect(eggOf("n62", [name("n62")])).toBeUndefined();
    expect(eggOf("N62", [name("A")])).toBe("credits");
  });
  it("is nothing when the letter as typed on the line is a stored name (N62 reads as N times 62)", () => {
    expect(eggOf("N62", [name("N")])).toBeUndefined();
    expect(eggOf("n62", [name("n")])).toBeUndefined();
    expect(eggOf("N62", [name("n")])).toBe("credits");
  });
});

describe("eggOf: rainbow (R881)", () => {
  it("is the rainbow for rainbow in any case (a hardware keyboard, the Alpha lock in Home)", () => {
    for (const v of ["rainbow", "RAINBOW", "Rainbow"]) expect(eggOf(v, [])).toBe("rainbow");
  });
  it("is nothing for another word, a space, or a chip on the line", () => {
    for (const v of ["rainbows", "rain bow", "rainbo", "arainbow", "rainbow+1", "rainbow\\times 2"]) expect(eggOf(v, [])).toBeUndefined();
    expect(eggOf("rainbow", [], { x: 1 })).toBeUndefined();
  });
  it("is nothing when one of the line's letters, as typed, is a stored name (Giac names are case-sensitive)", () => {
    expect(eggOf("rainbow", [name("a")])).toBeUndefined();
    expect(eggOf("rainbow", [name("w")])).toBeUndefined();
    expect(eggOf("RAINBOW", [name("R")])).toBeUndefined();
    expect(eggOf("rainbow", [name("R")])).toBe("rainbow");
    expect(eggOf("RAINBOW", [name("a")])).toBe("rainbow");
    expect(eggOf("rainbow", [name("x"), name("ab")])).toBe("rainbow");
  });
  it("is nothing when the user stored the name rainbow in any case", () => {
    expect(eggOf("rainbow", [name("rainbow")])).toBeUndefined();
    expect(eggOf("RAINBOW", [name("rainbow")])).toBeUndefined();
    expect(eggOf("rainbow", [name("Rainbow")])).toBeUndefined();
  });
});
