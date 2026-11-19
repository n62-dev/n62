// SPDX-License-Identifier: GPL-3.0-or-later
// R746: an exact result drawn as a fraction, root, power or matrix goes on the line as its maths, the caret free to enter
// it (docs/04 2.8); everything else stays a chip. Loaded with the field (entry/field.ts), outside the start chunk: the
// controller decides when the insert lands on the field (EntryController.put).
import { resultToEntry } from "./insertable.ts";

/** R746: what the exact maths drawn for a result may hold to go on the line as itself (after resultToEntry): numbers,
 *  one-letter names, π, e, i, + − · ×, brackets, fractions, roots, powers, subscripts and matrices (VECTOR: a vector's
 *  elements, each); each read back by the parser as drawn (insertable.test.ts). Anything else (a function's name, a unit, `\mathrm{…}`) keeps the chip. */
const MATHS = /^(?:\\(?:(?:[dt]?frac|sqrt|cdot|times|pi|exponentialE|imaginaryI)(?![A-Za-z])|sqrt\[\d+\]|left\(|right\)|begin\{pmatrix\}|end\{pmatrix\}|\\)|[\dA-Za-z.+\-^_{}()& ])*$/;
/** Two letters in a row outside a command (a name of more than one letter, `\mathrm` text): no plain maths. */
const WORD = /(?:^|[^\\A-Za-z])[A-Za-z]{2}/;
/** Giac's vector `[a,b]` (drawn so by CAS, `latex([1/2,1/3])`), one level: its elements, with the commas between. On the
 *  line it is `\left[…\right]`, a group the caret enters, which the parser reads back as the vector (input/parse.ts). A
 *  comma anywhere else (a sequence `\frac12,\frac13`) or a nested list keeps the chip. */
const VECTOR = /^\[([^[\],]+(?:,[^[\],]+)*)\]$/;
/** A fraction, a root, a power, a matrix or a vector: maths a chip would draw as one box the cursor cannot enter. */
const STRUCTURED = /\\(?:[dt]?frac|sqrt|begin)(?![A-Za-z])|\^|^\[/;
/** A number right before a fraction: a mixed number (Home's a b/c form `2\frac{5}{6}`), which the line reads as 2·5/6. */
const MIXED = /\d\s*\\[dt]?frac(?![A-Za-z])/;

/**
 * R746: an exact result's drawn LaTeX (`shown`, its text the exact value) as the line's maths, the caret free to enter it
 * (docs/04 2.8), or undefined when it stays a chip: no fraction, root, power, matrix or vector in it (an integer, a name), a
 * mixed number, or anything outside MATHS. A leading minus or a sum comes bracketed (resultToEntry); the × beside it is
 * the line's (entry/oneTerm.ts).
 */
export function exactMaths(shown: string): string | undefined {
  if (!STRUCTURED.test(shown) || MIXED.test(shown)) return undefined;
  const s = resultToEntry(shown);
  const inner = VECTOR.exec(s)?.[1];
  const plain = (inner?.split(",") ?? [s]).every((p) => MATHS.test(p) && !WORD.test(p.replace(/\\(?:begin|end)\{pmatrix\}/g, "")));
  return !plain ? undefined : inner === undefined ? s : `\\left[${inner}\\right]`;
}
