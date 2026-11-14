// SPDX-License-Identifier: GPL-3.0-or-later
// R194: the word of the settings for the short forms of wordOps.ts (shl, shr, rotl, rotr, bnot). Only the host (the
// worker) needs it, so it is a file of its own, out of the start chunk (wordOps.ts holds the defaults and is in it).
import { WORD_BITS, WORD_DEFINITIONS, WORD_SIGNED, wordInit } from "./wordOps.ts";

/** The definitions with the word of the settings in them (`bits`; `signed`: 0 or 1): the defaults' text, its word swapped. */
export function wordDefinitions(bits: number, signed: number): Record<string, string> {
  const from = wordInit(WORD_BITS, WORD_SIGNED);
  return Object.fromEntries(Object.entries(WORD_DEFINITIONS).map(([name, def]) => [name, def.replace(from, wordInit(bits, signed))]));
}

/** The word as a settings pair gives it: `word` a size of 8, 16, 32 or 64 (else the default), `signed` true for two's complement. */
export function wordOfSettings(s: { word?: number; signed?: boolean }): { bits: number; signed: number } {
  const bits = s.word === 8 || s.word === 16 || s.word === 32 || s.word === 64 ? s.word : WORD_BITS;
  return { bits, signed: s.signed === true ? 1 : WORD_SIGNED };
}
