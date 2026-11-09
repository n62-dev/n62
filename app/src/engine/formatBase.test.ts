// SPDX-License-Identifier: GPL-3.0-or-later
// formatBase (G228): an integer's text in hex, binary, octal. Every expected value is `derived` (by hand).
import { describe, expect, it } from "vitest";
import { formatBase } from "./formatBase.ts";

describe("formatBase", () => {
  it("shows an unsigned integer", () => {
    expect(formatBase("255", "hex", 8, false)).toBe("0xFF");
    expect(formatBase("255", "bin", 8, false)).toBe("0b11111111");
    expect(formatBase("18446744073709551615", "hex", 64, false)).toBe("0xFFFFFFFFFFFFFFFF");
  });
  it("shows a negative integer in two's complement of the word", () => {
    expect(formatBase("-1", "hex", 8, true)).toBe("0xFF");
    expect(formatBase("-1", "hex", 16, true)).toBe("0xFFFF");
    expect(formatBase("-128", "bin", 8, true)).toBe("0b10000000");
    expect(formatBase("-1", "oct", 8, true)).toBe("0o377"); // 255 = 3·64 + 7·8 + 7
  });
  it("shows octal and small values without padding", () => {
    expect(formatBase("8", "oct", 8, false)).toBe("0o10");
    expect(formatBase("10", "hex", 8, false)).toBe("0xA");
    expect(formatBase("0", "bin", 8, false)).toBe("0b0");
  });
  it("keeps 64-bit values exact (never through Number)", () => {
    expect(formatBase("9223372036854775807", "hex", 64, true)).toBe("0x7FFFFFFFFFFFFFFF");
    expect(formatBase("-9223372036854775808", "hex", 64, true)).toBe("0x8000000000000000");
  });
  it("never wraps a value that does not fit the word", () => {
    expect(formatBase("256", "hex", 8, false)).toEqual({ error: "wordTooSmall" });
    expect(formatBase("128", "hex", 8, true)).toEqual({ error: "wordTooSmall" });
    expect(formatBase("-129", "hex", 8, true)).toEqual({ error: "wordTooSmall" });
    expect(formatBase("-1", "hex", 8, false)).toEqual({ error: "wordTooSmall" });
  });
  it("refuses a non-integer", () => {
    expect(formatBase("1.5", "hex", 8, false)).toEqual({ error: "notInteger" });
    expect(formatBase("1/2", "bin", 8, true)).toEqual({ error: "notInteger" });
    expect(formatBase("", "hex", 8, true)).toEqual({ error: "notInteger" });
  });
});
