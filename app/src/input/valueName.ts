// SPDX-License-Identifier: GPL-3.0-or-later
// R258: which stored value names go on the line spelled out as `\operatorname{name}`. The keys type a name as one letter,
// a letter with a subscript or a Greek letter; any other name (`rate`, `A1`, `g0`, `beam_w`) written as loose letters
// reads as a product (r·a·t·e, g·0). Vars, Find's live items and Your keys write it (find/names.svelte.ts insertOf),
// and the parser takes it back as the name when the session holds it (latex-to-giac.ts userValuesOf). Small and free of
// the parser, so Find's chunk can hold it.
import { GREEK, LETTER_NAMES } from "./parseTables.ts";

/** The names the keys type as one letter: a Greek letter's stand-in (`theta`, `beta_`) and `e_`, `i_` (R67). */
const LETTERS: ReadonlySet<string> = new Set([...Object.values(GREEK), ...Object.values(LETTER_NAMES)]);

/** Whether a stored value's name is neither one letter, nor a letter with a subscript (`x_1`, `k_B`), nor a stand-in. */
export const spelledName = (name: string): boolean => !/^[A-Za-z](_[A-Za-z0-9]+)?$/.test(name) && !LETTERS.has(name);

/** The line's form of such a name: `_` as `\_`, as a function's insert has it (find/rank.ts functionInsert). */
export const spelledLatex = (name: string): string => `\\operatorname{${name.replace(/_/g, "\\_")}}`;
