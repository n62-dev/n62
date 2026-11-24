// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { en } from "./en.ts";
import { enMode, modeText } from "./enMode.ts";

describe("the Mode sheet's own words (G622f1: the angle names off the start table)", () => {
  it("names the two angle modes", () => {
    expect([modeText("angle.rad"), modeText("angle.deg")]).toEqual(["Radians", "Degrees"]);
  });

  it("keeps no key in both tables", () => {
    expect(Object.keys(enMode).filter((k) => k in en)).toEqual([]);
  });
});
