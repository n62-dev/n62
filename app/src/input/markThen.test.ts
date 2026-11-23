// SPDX-License-Identifier: GPL-3.0-or-later
// R376 (be-7, principle 3): a number right after °, ′, ″, %, ‰ or ! is refused with a message that names the missing
// mark, never read as a product with no × on the line (30°15 was 450 in DEG; the G2 reads it as 30°15′, G2 checklist
// row 76). Products with their × and the DMS forms with all their marks stay as they were. Giac text only, no engine;
// the values of the kept forms are in tests/golden/parser.yaml (groups "tmpl" and "palettes").
import { describe, expect, it } from "vitest";
import { SerializeError } from "./emit.ts";
import { latexToGiac } from "./latex-to-giac.ts";

const message = (latex: string): string => {
  try {
    return `accepted: ${latexToGiac(latex, {})}`;
  } catch (e) {
    if (e instanceof SerializeError) return e.message;
    throw e;
  }
};

const PRODUCT = "× for a product";

describe("a number right after a mark is refused, naming the mark (R376)", () => {
  it.each([
    ["30\\degree15", `a number after ° needs its mark: ′ for minutes, or ${PRODUCT}`],
    ["30^{\\circ}15", `a number after ° needs its mark: ′ for minutes, or ${PRODUCT}`],
    ["30^\\circ15", `a number after ° needs its mark: ′ for minutes, or ${PRODUCT}`],
    ["1\\degree2\\prime3", `a number after ′ needs its mark: ″ for seconds, or ${PRODUCT}`],
    ["30\\degree15\\prime36\\doubleprime2", `a number after ″ needs its mark: ${PRODUCT}`],
    ["30\\degree15\\doubleprime4", `a number after ″ needs its mark: ${PRODUCT}`],
    ["2\\%3", `a number after % needs its mark: ${PRODUCT}`],
    ["2\\permille3", `a number after ‰ needs its mark: ${PRODUCT}`],
    ["5!3", `a number after ! needs its mark: ${PRODUCT}`],
    ["5!0.5", `a number after ! needs its mark: ${PRODUCT}`],
    ["1+\\sin\\left(30\\degree15\\right)", `a number after ° needs its mark: ′ for minutes, or ${PRODUCT}`],
  ])("%s is refused", (latex, msg) => {
    expect(message(latex)).toBe(msg);
  });
});

describe("the forms with their marks, or with ×, stay as they were (controls)", () => {
  it.each([
    ["30\\degree15\\prime", "(30+15/60)*pi/180/pasdeg"],
    ["30\\degree15\\prime36\\doubleprime", "(30+15/60+36/3600)*pi/180/pasdeg"],
    ["30\\degree", "30*pi/180/pasdeg"],
    ["x\\degree", "x*pi/180/pasdeg"],
    ["30\\degree+15", "30*pi/180/pasdeg+15"],
    ["30\\degree\\cdot15", "(30*pi/180/pasdeg)*15"],
    ["30\\degree\\times15", "(30*pi/180/pasdeg)*15"],
    ["2\\%\\cdot3", "(2/100)*3"],
    ["2\\permille\\times3", "(2/1000)*3"],
    ["5!\\cdot3", "factorial(5)*3"],
    ["5!", "factorial(5)"],
    ["2\\%", "2/100"],
  ])("%s → %s", (latex, giac) => {
    expect(message(latex)).toBe(`accepted: ${giac}`);
  });
});
