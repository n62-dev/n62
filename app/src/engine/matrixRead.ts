// SPDX-License-Identifier: GPL-3.0-or-later
// R188 (docs/04 5.3): the matrix sheet's reads, through bridge-3 (giac_value: kind, shape, elements, kinds and the
// exact num/den of each element), never from Giac's printed text: which of the user's names hold a matrix and their
// sizes, and a matrix's elements for its grid. An element that is a number comes with its value and the facts Home
// gives it, so the grid draws it with the Home formatter and its mark (views/matrixGrid.svelte.ts): an integer or a
// rational is exact, a float or a complex with a float is unchecked (⚠, as Home marks a float in a non-number, G27).
// Any other element keeps Giac's text, its floats at the display digits as Home shows them (G38), ⚠ when it holds one.
// Runs in the worker in Home's mode (host.ts matrices); the client is calc/matrices.ts.
import type { GiacValue } from "./bridge.ts";
import { ZERO_VALUE, type ComplexValue } from "./format.ts";
import { floatsAtDigits, floatsShown, hasFloat, partValue, valuePrecision, withDigits, type Giac } from "./numeric.ts";
import type { ValueFacts } from "./types.ts";

/** A cell of the grid: a number with its facts, or Giac's text of an element that is not one (`unchecked`: it holds a
 *  float). */
export type MatrixCell = { readonly value: ComplexValue; readonly facts: ValueFacts } | { readonly text: string; readonly unchecked?: true };

/** A name that holds a matrix, its size, and (when asked for) its elements row by row. */
export interface MatrixRead {
  readonly name: string;
  readonly rows: number;
  readonly cols: number;
  readonly cells?: readonly MatrixCell[];
}

const EXACT: ValueFacts = { exact: true, reliableDigits: null };
const UNCHECKED: ValueFacts = { exact: false, reliableDigits: null, warn: "unchecked" };

/** The names of `names` (the definitions log's variables) that hold a matrix, in that order, with their sizes; `cells`:
 *  with their elements too. `giac` in Home's mode, its Digits the display digits `digits`. */
export function readMatrices(giac: Giac, names: readonly string[], digits: number, cells: boolean): MatrixRead[] {
  const P = valuePrecision(digits);
  return names.flatMap((name) => {
    // the elements printed at P, so a float keeps its digits for its value
    const v = withDigits(giac, P, digits, () => giac.value(name, []));
    const [rows, cols] = v.kind === "matrix" ? (v.shape ?? []) : [];
    if (!rows || !cols) return [];
    if (!cells) return [{ name, rows, cols }];
    const read = cellsOf(giac, v, P, digits);
    return read && read.length === rows * cols ? [{ name, rows, cols, cells: read }] : [];
  });
}

function cellsOf(giac: Giac, v: GiacValue, P: number, digits: number): MatrixCell[] | null {
  const { elements, kinds } = v;
  if (!elements || !kinds || kinds.length !== elements.length) return null;
  return elements.map((text, k) => {
    const q = v.exact?.[k];
    if (q) return { value: { re: partValue(`${q[0]}/${q[1]}`, P) ?? ZERO_VALUE, im: ZERO_VALUE }, facts: EXACT };
    const kind = kinds[k];
    if (kind === "float" || kind === "complex") {
      const at = withDigits(giac, P, digits, () => giac.value(text, [P])).at?.[String(P)]?.[0];
      const re = at && partValue(at[0], P);
      const im = at && partValue(at[1], P);
      if (re && im) return { value: { re, im }, facts: hasFloat(text) ? UNCHECKED : EXACT };
    }
    if (!hasFloat(text)) return { text };
    // as Home's symbolic path (homeEval.ts): its floats at the display digits, in Giac's order of them (x+1.414)
    const shown = floatsShown(giac, text, digits, "pasfl") ?? floatsAtDigits(giac, text, digits);
    giac.eval("purge(pasfl)");
    return { text: shown, unchecked: true };
  });
}
