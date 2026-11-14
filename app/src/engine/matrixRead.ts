// SPDX-License-Identifier: GPL-3.0-or-later
// R188 (docs/04 5.3): the matrix sheet's reads, through bridge-3 (giac_value: kind, shape, elements, kinds and the
// exact num/den of each element), never from Giac's printed text: which of the user's names hold a matrix and their
// sizes, and a matrix's elements for its grid. An element that is a number comes with its value and the facts Home
// gives it, so the grid draws it with the Home formatter and its mark (views/matrixGrid.svelte.ts): an integer or a
// rational is exact, a float or a complex with a float is unchecked (⚠, as Home marks a float in a non-number, G27).
// Any other element keeps Giac's text, its floats at the display digits as Home shows them (G38), ⚠ when it holds one.
// R189: for the grid's write-back, each element as the definitions log types a stored value (host.ts snapshot) and as
// LaTeX the entry line reads back (ElementTex), and the check of the store the grid built from them (checkStore): a
// matrix of the same size, no other store, every element but the edited one as it was.
// Runs in the worker in Home's mode (host.ts matrices); the client is calc/matrices.ts.
import { dropAngleFactor } from "./angles.ts";
import type { GiacParse, GiacValue } from "./bridge.ts";
import { ZERO_VALUE, type ComplexValue } from "./format.ts";
import { floatsAsEvalf, unquote } from "./homeEval.ts";
import { numberLatex, typedFromPrinted } from "./giacPrint.ts";
import { DOUBLE_DIGITS, floatsAtDigits, floatsShown, hasFloat, partValue, valuePrecision, withDigits, type Giac } from "./numeric.ts";
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
  /** R189 (asked for as `cells: "typed"`): its elements row by row as typed Giac text, as the log keeps a value. */
  readonly typed?: readonly string[];
  /** R189 (with `typed`): each element as LaTeX for the entry line. */
  readonly latex?: readonly ElementTex[];
  /** R189 (with `typed`, when a store was given to check): what checkStore found. */
  readonly candidate?: Candidate;
}

/** R189: an element as LaTeX: `tex` our own (a number) or Giac's latex() (`giac`: for the tidy path, render/tidy.ts);
 *  `float`: it holds a float, which the line writes in approx() (the parser reads a typed decimal exactly). */
export interface ElementTex {
  readonly tex: string;
  readonly giac?: true;
  readonly float?: true;
}

/** R189: the grid's store checked before it is sent. `ok`: its value's elements as typed text (as `typed`); else why
 *  not: "store" it stores into another name or purges one (a cell `a:=5`), "shape" its value is not a matrix of the
 *  same size (a cell `M` or `[1,2]` makes a ragged list). */
export type Candidate = { readonly ok: true; readonly typed: readonly string[] } | { readonly ok: false; readonly why: "store" | "shape" };

/** R189: the store to check (`name:=[[…]]`, the parser's text of the grid's line) and bridge-2's parse. */
export interface StoreCheck {
  readonly store: string;
  readonly parse: (text: string) => GiacParse;
}

const EXACT: ValueFacts = { exact: true, reliableDigits: null };
const UNCHECKED: ValueFacts = { exact: false, reliableDigits: null, warn: "unchecked" };

/** The names of `names` (the definitions log's variables) that hold a matrix, in that order, with their sizes; `cells`:
 *  with their elements too (`"typed"`: as typed text, R189). `giac` in Home's mode, its Digits the display digits `digits`. */
export function readMatrices(giac: Giac, names: readonly string[], digits: number, cells: boolean | "typed", check?: StoreCheck): MatrixRead[] {
  const P = valuePrecision(digits);
  return names.flatMap((name) => {
    // the elements printed at P, so a float keeps its digits for its value
    const v = withDigits(giac, P, digits, () => giac.value(name, []));
    const [rows, cols] = v.kind === "matrix" ? (v.shape ?? []) : [];
    if (!rows || !cols) return [];
    if (!cells) return [{ name, rows, cols }];
    if (cells === "typed") {
      const p = printedOf(giac, name, digits);
      if (!p || p.length !== rows * cols) return [];
      const latex = withDigits(giac, DOUBLE_DIGITS, digits, () => p.map((e) => elementTex(giac, e)));
      const candidate = check ? checkStore(giac, check, name, rows, cols, digits) : undefined;
      return [{ name, rows, cols, typed: p.map(typedText), latex, ...(candidate ? { candidate } : {}) }];
    }
    const read = cellsOf(giac, v, P, digits);
    return read && read.length === rows * cols ? [{ name, rows, cols, cells: read }] : [];
  });
}

/** R189: the elements of the value of `text` as host.ts snapshot prints a stored value: at DOUBLE_DIGITS. */
function printedOf(giac: Giac, text: string, digits: number): string[] | null {
  return withDigits(giac, DOUBLE_DIGITS, digits, () => giac.value(text, [])).elements ?? null;
}

/** R189: a printed element as host.ts snapshot types it: each float as `evalf(<exact>,k)` (floatsAsEvalf), a string as
 *  typed text (typedFromPrinted). */
function typedText(t: string): string {
  return typedFromPrinted(hasFloat(t) ? floatsAsEvalf(t) : t);
}

/** R189: a printed element as the entry line types it: a number as our own LaTeX (giacPrint.ts numberLatex), any other
 *  element through Giac's latex() with the degree factor dropped (as homeEval.ts latexShown draws it). */
function elementTex(giac: Giac, printed: string): ElementTex {
  const float = hasFloat(printed) ? { float: true as const } : {};
  const n = numberLatex(printed);
  if (n !== null) return { tex: n, ...float };
  return { tex: unquote(giac.eval(`latex(quote(${dropAngleFactor(printed, "printed")}))`)), giac: true, ...float };
}

/** R189: the grid's store `check.store` for `name` (rows × cols): no store but into `name` and no purge (bridge-2, not
 *  evaluated), then its value (not stored) a matrix of that size, its elements as typed text. */
function checkStore(giac: Giac, check: StoreCheck, name: string, rows: number, cols: number, digits: number): Candidate {
  const head = `${name}:=`;
  const p = check.parse(check.store);
  if (!check.store.startsWith(head) || !p.ok || p.top.join(",") !== name || p.targets.some((t) => t !== name) || p.heads.includes("purge")) return { ok: false, why: "store" };
  const v = withDigits(giac, DOUBLE_DIGITS, digits, () => giac.value(check.store.slice(head.length), []));
  const [r, c] = v.kind === "matrix" ? (v.shape ?? []) : [];
  if (r !== rows || c !== cols || v.elements?.length !== rows * cols) return { ok: false, why: "shape" };
  return { ok: true, typed: v.elements.map(typedText) };
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
