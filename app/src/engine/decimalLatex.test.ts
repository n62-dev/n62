// SPDX-License-Identifier: GPL-3.0-or-later
// R189f1: the entry line's decimal rule lives in engine/ (the worker's matrixRead.ts imports it; the engine imports
// nothing from entry/), so its mark is a copy of entry/macros.ts EMARK: this keeps the two the same. Expected texts by hand.
import { describe, expect, it } from "vitest";
import { EMARK } from "../entry/macros.ts";
import { DECIMAL_EMARK, decimalLatex } from "./decimalLatex.ts";

describe("decimalLatex (R189f1)", () => {
  it("writes its exponent after the entry line's mark", () => {
    expect(DECIMAL_EMARK).toBe(EMARK);
    expect([decimalLatex("1.5e-3"), decimalLatex("1.5E+20"), decimalLatex("-2.5"), decimalLatex("0.15e-19")]).toEqual([
      "1.5\\emark-3",
      "1.5\\emark20",
      "-2.5",
      "0.15\\emark-19",
    ]);
  });
});
