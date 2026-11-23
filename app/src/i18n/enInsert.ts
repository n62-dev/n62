// SPDX-License-Identifier: GPL-3.0-or-later
// R135f2: the note of a tapped result too long to insert. A table of its own, read only by render/longInsert.ts (a lazy
// chunk), so the start chunk does not carry it (it is pinned, size-check.ts; R862). English only so far.
export const enInsert = {
  /** A tap on a result too long to draw puts nothing on the line. */
  "render.tooLongInsert": "Too long to insert: Copy holds it",
} as const;

export const insertText = (key: keyof typeof enInsert): string => enInsert[key];
