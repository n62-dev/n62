// SPDX-License-Identifier: GPL-3.0-or-later
// R258: which stored value names go on the line spelled out as `\operatorname{name}`. The keys type a name as one letter,
// a letter with a subscript or a Greek letter; any other name (`rate`, `A1`, `g0`, `beam_w`) written as loose letters
// reads as a product (r·a·t·e, g·0). Vars, Find's live items and Your keys write it (find/names.svelte.ts insertOf),
// and the parser takes it back as the name when the session holds it (latex-to-giac.ts userValuesOf). Small and free of
// the parser and its tables, so Find's chunk and the unit view's share none of them.
import { GREEK_NAMES } from "../render/home.ts";

/** Whether a stored value's name is neither one letter (`e_`, `i_` stand in for e and i, R67), nor a letter with a
 *  subscript (`x_1`, `k_B`), nor a Greek letter's name (`theta`, `beta_`, parse.ts GREEK). */
export const spelledName = (name: string): boolean => !/^[A-Za-z](_[A-Za-z0-9]*)?$/.test(name) && !GREEK_NAMES.has(name);

/** The line's form of such a name: `_` as `\_`, as a function's insert has it (find/rank.ts functionInsert). */
export const spelledLatex = (name: string): string => `\\operatorname{${name.replace(/_/g, "\\_")}}`;
