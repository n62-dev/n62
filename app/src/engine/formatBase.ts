// SPDX-License-Identifier: GPL-3.0-or-later
// A base is a display mode of an integer result (docs/04 section 5.4). The input is the integer's exact decimal text;
// BigInt runs on its digits only, never JS `Number`, so 64-bit values stay exact. A value is never wrapped silently:
// one that does not fit the word is an error. A negative signed value shows as two's complement of the word.
// Hex and binary are not padded to the word (255 in a 16-bit word is 0xFF); a negative value is, by its nature, full width.

export type Base = "hex" | "bin" | "oct";

export type BaseError = "notInteger" | "wordTooSmall";

const RADIX: Record<Base, number> = { hex: 16, bin: 2, oct: 8 };
const PREFIX: Record<Base, string> = { hex: "0x", bin: "0b", oct: "0o" };

/** `0xFF`, `0b11111111`, `0o377` for the integer text `text` in a word of `word` bits (signed: two's complement);
 *  `{ error }` for a non-integer or a value outside the word's range. A negative unsigned value does not fit. */
export function formatBase(text: string, base: Base, word: number, signed: boolean): string | { error: BaseError } {
  const t = text.trim();
  if (!/^[+-]?\d+$/.test(t) || !Number.isInteger(word) || word < 1) return { error: "notInteger" };
  const v = BigInt(t);
  const size = 1n << BigInt(word);
  const lo = signed ? -(size >> 1n) : 0n;
  const hi = signed ? (size >> 1n) - 1n : size - 1n;
  if (v < lo || v > hi) return { error: "wordTooSmall" };
  const bits = v < 0n ? v + size : v;
  const s = bits.toString(RADIX[base]);
  return PREFIX[base] + (base === "hex" ? s.toUpperCase() : s);
}
