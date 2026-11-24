// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { en } from "./en.ts";
import { enRowBar, rowBarText } from "./enRowBar.ts";

describe("the row bar's own words (G793f1: off the start table)", () => {
  it("names the bar", () => {
    expect(rowBarText("history.actions")).toBe("Row actions");
  });

  it("keeps no key in both tables", () => {
    expect(Object.keys(enRowBar).filter((k) => k in en)).toEqual([]);
  });
});
