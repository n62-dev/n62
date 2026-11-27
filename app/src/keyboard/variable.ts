// SPDX-License-Identifier: GPL-3.0-or-later
// R142 (ISO 80000-2): a variable is set in italic, a function, a unit, a number or a constant upright. A legend on the
// keypad is a variable exactly when its action types one letter: the Alpha letters, the Greek letters a key layer types,
// x and y on the x key. The flag comes from the action, never from the legend's text (a user key's legend follows the
// action it holds), and no mode changes it. R864 (owner, 2026-11-22): also the letter that stands for the operand in a
// template (x², xʸ, ⁿ√, |x|, x⁻¹, eˣ, 10ˣ, the unit pad's powers; not a b/c), marked in the spec's label with a backtick
// pair (spec/keyboard.yaml's header, units/pad.ts OPS), and the Alpha key's corners a and A (R729's K4), the letters its
// layers type; its face stays upright.
import type { ActionBody, Key } from "./keyboard.ts";

const LETTER = /^\p{L}$/u;

/** True if the action types one letter, so the legend that shows it is a variable (italic). */
export const typesVariable = (a: ActionBody | undefined): boolean => a?.kind === "type" && LETTER.test(a.text);

/** A key's `data-v` attribute: which layers type a letter, as p (tap), s (Shift), a (Alpha, which falls back to the tap).
 *  The keypad's CSS picks the face or legend that shows that layer. Absent when none does. The Alpha key: its corners. */
export const varLayers = (k: Key): string | undefined => {
  const { primary: p, shift: s, alpha: a = p } = k.actions;
  return k.id === "alpha" ? "sa" : (typesVariable(p) ? "p" : "") + (typesVariable(s) ? "s" : "") + (typesVariable(a) ? "a" : "") || undefined;
};

/** One run of a legend (R864): its text; `v` the template's letter (italic, the variable face); `r` raised, a modifier letter
 *  (ʸ ˣ ⁿ) drawn as its own letter raised (the variable face has no italic of them). */
export interface Part {
  t: string;
  v?: boolean;
  r?: boolean;
}

/** A legend as its runs: between a backtick pair a variable (NFKC takes ʸ to y). A user's own legend (a free key, a user cell)
 *  is never parsed: `own` false. */
export const parts = (s: string, own = true): Part[] =>
  (own ? s.split("`") : [s]).map((t, i) => {
    const n = t.normalize("NFKC");
    return i % 2 ? { t: n, v: true, r: n !== t } : { t };
  });
