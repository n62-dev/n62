// SPDX-License-Identifier: GPL-3.0-or-later
// R194 (docs/04 5.4, 6.2): the word size and sign of the base forms (R192) and of the word ops' short forms (G229). One
// stamped record under its own key, `{ bits, signed }`, never a field of `settings`; absent until the user sets a row
// (Settings › Numbers), and then the engine's own word holds: 64 bits, unsigned. Plain TypeScript, small: the session
// reads it at the start, the backup checks it (backup.ts).

/** The key of the stamped store (state/storage.ts) that holds the record. */
export const WORD_KEY = "word";

export const WORD_SIZES = [8, 16, 32, 64] as const;
export type WordBits = (typeof WORD_SIZES)[number];

/** The word a base form is drawn in and a short form (shl, bnot…) works in. */
export interface WordSetting {
  bits: WordBits;
  signed: boolean;
}

/** What holds with no record: 64 bits, unsigned (engine/wordOps.ts WORD_BITS, WORD_SIGNED; the engine fills it itself). */
export const DEFAULT_WORD: WordSetting = { bits: 64, signed: false };

/** The record when it is whole (both fields, no other, a size of WORD_SIZES, a boolean sign); else undefined. Also the
 *  rule the backup's `word` validator repeats (backup.ts VALIDATORS, which stays off this file's chunk; word.test.ts runs both
 *  on one table), so a file never holds what the start would drop. */
export function validWord(v: unknown): WordSetting | undefined {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return undefined;
  const keys = Object.keys(v);
  const { bits, signed } = v as { bits?: unknown; signed?: unknown };
  if (keys.length !== 2 || typeof signed !== "boolean" || !WORD_SIZES.some((n) => n === bits)) return undefined;
  return { bits: bits as WordBits, signed };
}
