// SPDX-License-Identifier: GPL-3.0-or-later
// R224 (docs/05 3.9): the wide layout's condition, a landscape screen at least 1000 × 600 CSS px (a tablet held sideways,
// a desktop window). App.svelte's `@media` block says the same in CSS, which cannot read this constant: change both.
export const WIDE_QUERY = "(min-width: 1000px) and (min-height: 600px) and (orientation: landscape)";
