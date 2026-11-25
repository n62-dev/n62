// SPDX-License-Identifier: GPL-3.0-or-later
// R904: the Copied notice names the copied text. Expected values derived: 1/3 to 40 digits, 6.02214076E23 written out.
import { describe, expect, it } from "vitest";
import { groupText } from "../render/groupText.ts";
import { copiedNotice, drawnDigits } from "./noticeText.ts";

const words = { what: "Copied: {what}", digits: "Copied {n} digits: {what}" };
const thin = (s: string): string => s.replaceAll(" ", " ");
const named = (copied: string, shown?: string, comma = false): string =>
  thin(copiedNotice(copied, words, { group: (t) => groupText(t), drawnDigits: shown === undefined ? undefined : drawnDigits(shown), decimalComma: comma }));

describe("copiedNotice (R904)", () => {
  it("a 40-digit copy: its digit count and its start, cut where the row's drawing ends", () => {
    expect(named("0." + "3".repeat(40), "0.333333333333")).toBe("Copied 40 digits: 0.333 333 333 333…");
  });
  it("the start is the copied text's, not the drawing's rounding", () => {
    expect(named("0." + "6".repeat(39) + "7", "0.666666666667")).toBe("Copied 40 digits: 0.666 666 666 666…");
  });
  it("a long integer is counted, its first drawn digits named", () => {
    expect(named("602214076000000000000000", "6.02214076E23")).toBe("Copied 24 digits: 602 214 076…");
  });
  it("the exponent and the unit stay after the cut", () => {
    expect(named("3." + "3".repeat(39) + "E-31", "3.33333333333E-31")).toBe("Copied 40 digits: 3.333 333 333 33…E-31");
    expect(named("1." + "4".repeat(39) + " m", "1.44444444444 m")).toBe("Copied 40 digits: 1.444 444 444 44… m");
  });
  it("a short copy is named whole, even when the row draws it otherwise", () => {
    expect(named("72 km", "72 km")).toBe("Copied: 72 km");
    expect(named("0.125", "0.13")).toBe("Copied: 0.125");
    expect(named("6.02214076E23", "6.02214076E23")).toBe("Copied: 6.022 140 76E23");
  });
  it("no drawing: as many digits as fit", () => {
    expect(named("1234567890123456789012345678901234567890")).toMatch(/^Copied 40 digits: 123 456 789 012 345 678…$/);
  });
  it("the decimal comma", () => {
    expect(copiedNotice("0," + "3".repeat(40), words, { drawnDigits: drawnDigits("0,333333333333"), decimalComma: true })).toBe("Copied 40 digits: 0,333333333333…");
  });
  it("a long text that is not a number is cut with …, no count", () => {
    expect(named("x^2+2*x*y+y^2+3*x*y^2-sin(x)")).toBe("Copied: x^2+2*x*y+y^2+3*x*y^2-si…");
  });
  it("a fraction, a complex or a ± σ is not one number: cut with …, no count (the count would leave digits out)", () => {
    // 2^100/3: 31 digits over 3, 32 on the clipboard; the complex holds 80.
    expect(named("1267650600228229401496703205376/3")).toBe("Copied: 1 267 650 600 228 229 40…");
    const third = "0." + "3".repeat(40);
    expect(named(`${third}+0.${"6".repeat(40)}*i`, "0.333333333333")).toBe("Copied: 0.333 333 333 333 333 33…");
    expect(named(`${third} ± 1.2 m²`, "0.333333333333")).toBe("Copied: 0.333 333 333 333 333 33…");
  });
  it("a 10⁵-digit Exact copy (no drawing) is named at once", () => {
    const big = "7" + "1".repeat(99_999);
    const t0 = performance.now();
    expect(named(big)).toBe("Copied 100000 digits: 711 111 111 111 111 111…");
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});
