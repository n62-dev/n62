// SPDX-License-Identifier: GPL-3.0-or-later
// R722: the bar's controls in their order, left to right (views/StatusLine.svelte draws them; docs/05 3.2). The layout
// lock pins this order (spec/layout-lock.yaml `bar:`): the ⇧ α slot between CAS and the angle is a sign, not a control.

/** The bar's controls: ⌄ (R786: Home and CAS only, an empty cell elsewhere), Apps ▾ (the place), the Home and CAS tabs, the format and digits chip `mode` (Home and CAS only; an app's
 *  bay holds its view icons and Mode is the last row of its ☰, R785), the angle, ☰. */
export const BAR_ITEMS = ["fold", "apps", "home", "cas", "mode", "angle", "menu"] as const;
export type BarItem = (typeof BAR_ITEMS)[number];

/** R724: the folded bar's controls (keyboard/Fold.svelte with views/StatusLine.svelte `folded`; lock `folded-bar:`): ⌃, the
 *  Home and CAS tabs, Store ▶ and Copy › while a row is picked, ☰. The free stretch and the ⇧ α slot are no controls. */
export const FOLDED_BAR_ITEMS = ["unfold", "home", "cas", "store", "copy", "menu"] as const;
