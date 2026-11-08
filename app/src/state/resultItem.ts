// SPDX-License-Identifier: GPL-3.0-or-later
// R155f2: what a history item keeps of an engine result (G86's rule, docs/04 2.8), split from state/results.ts: it runs once
// a result is in, never at the first frame or the first key, so it is a lazy chunk (state/itemLoad.ts) and the decimal
// code of engine/format.ts it reads stays out of the start chunk. Pure TypeScript, no runes; the golden runner calls it too.
import { decimalFromRational, decimalFromString } from "../engine/format.ts";
import { bracesOf } from "../engine/giacPrint.ts";
import { FULL_LIMIT, ITEMS_LIMIT, rationalOf, type CasIn, type FactsSource, type HomeIn, type ItemResult } from "./results.ts";
import type { ResultFacts } from "./displayMode.ts";

/** Engine text with a decimal point or an E exponent is rounded digits, not an exact value. */
const isDigitsText = (t: string): boolean => /\.|\d[eE][+-]?\d/.test(t);
/** The facts of an engine result, as kept in a history item: its ValueFacts whole (G76), with its elements'. Undefined:
 *  too large to keep. */
export function factsFrom(r: FactsSource): ResultFacts | undefined {
  const f: ResultFacts = { ...r.facts };
  if (r.digits !== undefined) f.digits = r.digits;
  if (r.items) {
    if (r.items.length > ITEMS_LIMIT) return undefined;
    f.items = r.items.map((it) => ({ ...it.facts, ...(it.value ? { value: it.value } : {}) }));
    if (r.shape) f.shape = r.shape;
  }
  if (r.braces) f.braces = r.braces;
  return f;
}

/** A true or false: as approximate as an inexact chip it came from (R18f1; decisions M4-4). */
const isTruth = (t: string): boolean => /^(true|false)$/.test(t);

/** A Home result as a history item keeps it; `inexactInput`: an inexact chip or constant went into the input. */
export function homeItem(r: HomeIn, inexactInput: boolean): ItemResult {
  const out: ItemResult = { approximate: r.approximate || (inexactInput && isTruth(r.display)) };
  if (r.value) out.value = r.value;
  if (r.ok) {
    const f = factsFrom(r);
    if (f) out.facts = f;
  }
  const q = r.value ? rationalOf(r.exact) : undefined;
  if (q) out.rational = q;
  // The chip value (docs/04 2.8): an exact result's exact text when it fits in 2 kB, else the engine's `full` (the
  // confirmed decimal), never nothing for a number (R44, F37). A result that is not exact (a float, or from an inexact
  // chip or constant) carries its confirmed decimal, never the rational of more digits (R65, D1, D2).
  const inexact = r.approximate || inexactInput;
  const exactText = !inexact && r.exact !== undefined && r.exact.length <= FULL_LIMIT ? r.exact : undefined;
  const full = exactText ?? (r.full || (inexact ? undefined : r.exact));
  if (r.ok && full && full.length <= FULL_LIMIT) {
    out.full = full;
    // A decimal cut from a longer exact text, or from a value with more digits, is not exact, though the value is.
    const cut = r.exact !== undefined || r.value?.re.sticky === true || r.value?.im.sticky === true;
    out.fullExact = !inexact && (full === exactText || (!cut && (r.facts.exact || !isDigitsText(full))));
    // G46f1: a symbolic result whose chip text (radian) differs from the text drawn (DEG) copies the drawn text.
    if (!r.value && !r.items && full !== r.display && r.display.length <= FULL_LIMIT) out.drawn = r.display;
    // G109: a list of Giac's list type: the chip keeps Giac's `list[…]` (Giac reads it back), the copy has braces
    // (the drawn text above when there is one: in DEG it is the degree text, `full` the radian one)
    if (r.braces && out.drawn === undefined) out.drawn = bracesOf(full);
  }
  return out;
}

/** A CAS result as a history item keeps it; `inexactInput` as for homeItem. */
export function casItem(r: CasIn, inexactInput: boolean): ItemResult {
  const out: ItemResult = { approximate: false };
  if (!r.ok) return out;
  // A plain number (3/4, 2.5): the Format key can show it in the other forms.
  const q = rationalOf(r.text);
  const dec = q ? decimalFromRational(BigInt(q.n), BigInt(q.d)) : decimalFromString(r.text);
  if (dec) out.value = { re: dec, im: decimalFromRational(0n, 1n) };
  if (q) out.rational = q;
  // A float result: every confirmed digit the engine gave (r.text is drawn at the shown digits only).
  const nf = r.numeric?.full;
  const full = nf !== undefined && nf.length > 0 ? nf : (r.full ?? r.text); // G46: the radian text, not the DEG drawing
  if (full.length <= FULL_LIMIT) {
    out.full = full;
    out.fullExact = !inexactInput && !r.approximate && !isDigitsText(full); // R65 (D2): an inexact chip's result never is; nor a float's (G86f1)
  }
  if (r.full !== undefined && r.full !== r.text && !r.numeric?.value && r.text.length <= FULL_LIMIT) out.drawn = r.text; // G46f1
  // A true or false that rests on a float, or on an inexact chip, is marked approximate (R18f1); a non-number with a
  // float in it comes approximate and unchecked, so ⚠ (G27)
  if (r.approximate || (inexactInput && isTruth(r.text))) {
    out.approximate = true;
    out.facts = { ...(r.numeric ? {} : r.facts), exact: false, reliableDigits: null };
  }
  // A result with a float in it comes with its value and facts (docs/04 2.9): drawn by our formatter, marked.
  const n = r.numeric;
  if (n?.value) {
    out.value = n.value;
    const f = factsFrom(n);
    if (f) out.facts = f;
    if (n.full.length <= FULL_LIMIT) {
      out.full = n.full;
      out.fullExact = false;
    }
  }
  return out;
}

