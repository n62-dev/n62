// SPDX-License-Identifier: GPL-3.0-or-later
// G793f1: the words of the picked row's bar (views/RowBar.svelte, in the clipboard chunk). A table of its own, so the
// start chunk does not carry them (it is pinned, size-check.ts; R862, G399). English only so far.
export const enRowBar = {
  /** The bar's name for a screen reader. */
  "history.actions": "Row actions",
} as const;

export const rowBarText = (key: keyof typeof enRowBar): string => enRowBar[key];
