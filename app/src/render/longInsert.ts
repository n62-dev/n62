// SPDX-License-Identifier: GPL-3.0-or-later
// R135f2: a tapped result that is too long to put on the line (the clipboard code inserts it; out of the start chunk, which draws
// the rows but never inserts one, R832).
import { insertText } from "../i18n/enInsert.ts";
import { MAX_DRAWN_LATEX } from "./longResult.ts";

/** R135f2: a result with no chip goes on the entry line as drawn; over the cut that is 1.77 MB of LaTeX for MathLive's
 *  parser (it overflowed its stack on Σ cos(k)/k to 2000), so it is not inserted at all. A chip carries its value instead. */
export const tooLongToInsert = (shown: string, hasChip: boolean): boolean => !hasChip && shown.length > MAX_DRAWN_LATEX;

/** The notice for a tap on such a result. */
export const tooLongToInsertNote = (): string => insertText("render.tooLongInsert");
