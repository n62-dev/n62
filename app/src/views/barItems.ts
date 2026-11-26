// SPDX-License-Identifier: GPL-3.0-or-later
// R722: the bar's controls in their order, left to right (views/StatusLine.svelte draws them; docs/05 3.2). The layout
// lock pins this order (spec/layout-lock.yaml `bar:`): the ⇧ α slot between CAS and the angle is a sign, not a control.

/** The bar's controls: ⌄ (R786: Home, CAS and, R928, Plot; an empty cell elsewhere), APP▾ (the place), Home and slot 2 (R782: CAS until a second tap on it chooses another place), the modes group (R856): `STD 12 ▾` `mode` (Home and CAS only;
 *  an app's bay holds its view icons and Mode is the last row of its ☰, R785) and the angle word, ☰. */
export const BAR_ITEMS = ["fold", "apps", "home", "slot", "mode", "angle", "menu"] as const;
export type BarItem = (typeof BAR_ITEMS)[number];

/** R724: the folded bar's controls (keyboard/Fold.svelte with views/StatusLine.svelte `folded`; lock `folded-bar:`): ⌃, the
 *  Home and slot 2 segments, the modes group (R856: `STD 12 ▾` and the angle word; hidden while a row is picked), Store ▶ and
 *  Copy › while a row is picked, ☰. The free stretch and the ⇧ α slot are no controls. */
export const FOLDED_BAR_ITEMS = ["unfold", "home", "slot", "mode", "angle", "store", "copy", "menu"] as const;

/** R928: the folded bar in an app's Plot (the one app view that folds; lock `folded-bar-app:`): ⌃, Home and slot 2, the app's
 *  views (views/AppViews.svelte; Symb and Num open their view with the keys up), the angle word, ☰. No `STD 12 ▾` (Mode is ☰'s
 *  last row in an app, R785) and no picked row. */
export const FOLDED_APP_BAR_ITEMS = ["unfold", "home", "slot", "symb", "plot", "num", "angle", "menu"] as const;
