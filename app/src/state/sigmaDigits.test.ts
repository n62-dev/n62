// SPDX-License-Identifier: GPL-3.0-or-later
// R327f1: shownDigits reads the digits of "value ± σ" from the text, as units/uncertainty.ts digitsToSigma does from the
// unrounded value.
import { describe, expect, it } from "vitest";
import { digitsToSigma, shownWithUncertainty, uncertaintyText } from "../units/uncertainty.ts";
import { shownDigits } from "./sigmaDigits.ts";

const row = (value: string, sigma: string) => ({ shown: shownWithUncertainty(value, sigma, value)!, text: uncertaintyText(sigma)! });

describe("shownDigits (R327f1)", () => {
  it.each([
    ["10.123456", "0.0707106781187", 5],
    ["12345", "1234", 3],
    ["1000.5", "0.123", 6],
    ["-2.5e-9", "1.234e-11", 4],
    ["39.488", "99.6", 1],
    ["6.6743e-11", "1.5e-15", 6],
  ])("%s ± %s shows %i digits, as digitsToSigma", (v, s, n) => {
    expect(shownDigits(row(v, s))).toBe(n);
    expect(digitsToSigma(v, s)).toBe(n);
  });
  it("is null for σ 0, a value that rounds to 0 and a text that is not value ± σ", () => {
    expect(shownDigits(row("10.1", "0"))).toBeNull();
    expect(shownDigits(row("0.0004", "0.071"))).toBeNull();
    expect(shownDigits({ shown: "10.1(12)", text: "1.2" })).toBeNull();
    expect(shownDigits(undefined)).toBeNull();
  });
});
