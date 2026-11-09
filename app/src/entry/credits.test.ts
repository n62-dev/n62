// SPDX-License-Identifier: GPL-3.0-or-later
// R149: the check before Enter that opens the credits sheet: the line is exactly N62 (n62 in CAS, where Alpha types lower case).
import { describe, expect, it } from "vitest";
import type { UserName } from "../calc/port.ts";
import { creditsAsked } from "./credits.ts";

const name = (n: string): UserName => ({ name: n, kind: "var", preview: "5", view: "home", time: 0 });

describe("creditsAsked", () => {
  it("is true for N62 and n62", () => {
    expect(creditsAsked("N62", [])).toBe(true);
    expect(creditsAsked("n62", [])).toBe(true);
  });
  it("is false for anything else on the line", () => {
    for (const v of ["N62+1", "2N62", " N62", "N62 ", "N 62", "N6", "", "N62\\times 2"]) expect(creditsAsked(v, [])).toBe(false);
  });
  it("is false with a chip on the line", () => {
    expect(creditsAsked("N62", [], { x: 1 })).toBe(false);
    expect(creditsAsked("N62", [], {})).toBe(true);
  });
  it("is false when the user stored the name N62 or n62", () => {
    expect(creditsAsked("N62", [name("N62")])).toBe(false);
    expect(creditsAsked("n62", [name("n62")])).toBe(false);
    expect(creditsAsked("N62", [name("A")])).toBe(true);
  });
  it("is false when the letter as typed on the line is a stored name (N62 reads as N times 62)", () => {
    expect(creditsAsked("N62", [name("N")])).toBe(false);
    expect(creditsAsked("n62", [name("n")])).toBe(false);
    expect(creditsAsked("N62", [name("n")])).toBe(true);
  });
});
