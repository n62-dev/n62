// SPDX-License-Identifier: GPL-3.0-or-later
// The chip macros of the entry line (docs/04 section 3.6), shared by the MathLive field and the static history
// renderer. `captureSelection` makes each chip one unit the cursor steps over and ⌫ deletes whole; `expand: false`
// keeps the macro itself in the field's value, so the parser sees `\res{k}{…}`, not the digits drawn.
// The first argument names the chip (the key in the entry's chip table, input/chips.ts), the second is only what
// it shows. Drawn upright on the see-through tint (--chip-tint in style.css, R748; the shape is CSS: style.css and entry/field.ts), so a chip never looks like a variable.
// Plain data: importing this does not load MathLive. The table itself (CHIP_MACROS, ENTRY_MACROS) is entry/macroTable.ts,
// out of the start chunk: it loads with MathLive (render/mathlive.svelte.ts, R791 fix round 1).

/**
 * The exponent mark (R14, P12 point 4): `1.5\emark-3` is 1.5·10⁻³, drawn `1.5ᴇ-3` (U+1D07, the small-capital E the
 * reference draws). A macro, not the bare character, for two reasons found by probing MathLive 0.111.1: as a bare
 * ordinary character it made the minus after it a binary operator (drawn `1.5ᴇ − 3`, spaced like a subtraction),
 * and `\mathopen{ᴇ}` alone is a group the cursor steps into. `\mathopen` gives the tight spacing (an opening atom
 * makes the following minus a sign), `captureSelection` makes it one step for the cursor and ⌫ (its macro:
 * entry/macroTable.ts).
 */
export const EMARK = "\\emark";

/** A history result as a chip: `shown` is the result's display LaTeX. */
export const resChip = (k: number, shown: string): string => `\\res{${k}}{${shown}}`;
/** A constant as a chip: `symbol` is LaTeX (`c`, `k_{B}`, `\\mu_{0}`). */
export const constChip = (id: string, symbol: string): string => `\\const{${id}}{${symbol}}`;
export const ANS_CHIP = "\\ans";

/** The LaTeX of an atom is one chip (the controller treats it as a whole term before ÷, x², xʸ, x⁻¹). */
export const isChipLatex = (latex: string): boolean => /^\\(?:res|ans|const|unit|pfx)(?![A-Za-z])/.test(latex);
