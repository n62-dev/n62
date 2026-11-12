// SPDX-License-Identifier: GPL-3.0-or-later
// R262: an app's answer as Home's chip keeps its facts (the mark travels) and never claims an exact value it is not.
import { describe, expect, it } from "vitest";
import { answerChip, answerShown } from "./toHome.ts";

describe("answerChip", () => {
  it("an inexact answer keeps its confirmed digits and its ⚠", () => {
    expect(answerChip("1.41421356237309504880168872420969807857", { exact: false, reliableDigits: 30 })).toEqual({ value: "1.41421356237309504880168872420969807857", exact: false, reliableDigits: 30 });
    expect(answerChip("1.4142E0", { exact: false, reliableDigits: 5, warn: "unchecked" })).toEqual({ value: "1.4142e0", exact: false, reliableDigits: 5, warn: "unchecked" });
  });
  it("an exact integer is exact; a fraction's cut decimal or an inexact flag is not", () => {
    expect(answerChip("2", undefined)).toEqual({ value: "2", exact: true });
    expect(answerChip("2", { exact: true, reliableDigits: null })).toEqual({ value: "2", exact: true });
    expect(answerChip("0.3333333333333333333333333333333333333333", undefined)).toEqual({ value: "0.3333333333333333333333333333333333333333", exact: false, reliableDigits: null });
    expect(answerChip("2", { exact: true, reliableDigits: null, inexact: true })).toEqual({ value: "2", exact: false, reliableDigits: null });
  });
});

describe("answerShown", () => {
  it("draws the shown text as LaTeX, the exponent and a prefix too, with the decimal comma when set", () => {
    expect(answerShown("1.41421356237", { exact: false, reliableDigits: 30 }, false)).toBe("1.41421356237");
    expect(answerShown("1.5E-7", undefined, false)).toBe("1.5\\times10^{-7}");
    expect(answerShown("1.5 m", undefined, false)).toBe("1.5\\,\\mathrm{m}");
    expect(answerShown("1.41421356237", undefined, true)).toBe("1{,}41421356237");
  });
  it("no confirmed digit: the bare ⚠, never the unconfirmed number", () => {
    expect(answerShown("1.41421356237", { exact: false, reliableDigits: 0 }, false)).toBe("⚠");
  });
});
