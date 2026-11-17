// SPDX-License-Identifier: GPL-3.0-or-later
// R722: the bar's controls in their order, left to right (views/StatusLine.svelte draws them; docs/05 3.2). The layout
// lock pins this order (spec/layout-lock.yaml `bar:`): the ⇧ α slot between CAS and the angle is a sign, not a control.

/** The bar's controls: Apps ▾ (the place), the Home and CAS tabs, the angle, format and digits chips, ☰. */
export const BAR_ITEMS = ["apps", "home", "cas", "angle", "format", "digits", "menu"] as const;
export type BarItem = (typeof BAR_ITEMS)[number];

/** R724: the folded bar's controls (keyboard/Fold.svelte with views/StatusLine.svelte `folded`; lock `folded-bar:`): ⌃, the
 *  Home and CAS tabs, Store ▶ and Copy › while a row is picked, ☰. The free stretch and the ⇧ α slot are no controls. */
export const FOLDED_BAR_ITEMS = ["unfold", "home", "cas", "store", "copy", "menu"] as const;
