// SPDX-License-Identifier: GPL-3.0-or-later
// R743: the words of a history row's swipe strip. A table of its own, loaded with the swipe's chunk (views/rowSwipe.ts), so
// the start chunk does not carry it (it is pinned, size-check.ts). English only so far.
export const enRows = {
  "history.swipeDelete": "Delete",
} as const;

export const rowText = (key: keyof typeof enRows): string => enRows[key];
