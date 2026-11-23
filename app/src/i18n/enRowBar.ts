// SPDX-License-Identifier: GPL-3.0-or-later
// The words only a history row's action bar reads (views/RowBar.svelte, a lazy chunk): a table of its own, so the start
// chunk does not carry them (it is pinned, size-check.ts; R862, G399, G622). English only so far.
export const enRowBar = {
  /** The bar's accessible name (a toolbar). */
  "history.actions": "Row actions",
} as const;

export const rowBarText = (key: keyof typeof enRowBar): string => enRowBar[key];
