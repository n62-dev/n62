// SPDX-License-Identifier: GPL-3.0-or-later
// The texts of Settings › Numbers › Word (R194: the word size and sign of the base forms and the word ops). A table of its
// own, loaded with the Mode sheet's chunk (views/modeSheet.ts), so the start chunk does not carry it (R91's pin, docs/04
// 8.3). English only so far.
export const enWord = {
  "word.row": "Word",
  "word.size": "Word size (bits)",
  "word.size.spoken": "bits",
  "word.signed": "Signed",
  "word.signed.hint": "Two's complement",
  "word.signed.on": "signed",
  "word.signed.off": "unsigned",
} as const;

export type WordKey = keyof typeof enWord;

export const wordText = (key: WordKey): string => enWord[key];
