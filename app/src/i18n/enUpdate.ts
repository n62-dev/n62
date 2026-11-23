// SPDX-License-Identifier: GPL-3.0-or-later
// A49, R97: the words of a waiting update's Restart pill. A table of its own, read only by the pill's chunk
// (views/UpdateNote.svelte), so the start chunk does not carry them (it is pinned, size-check.ts; R862). English only so far.
export const enUpdate = {
  /** The update line (A49): a new version of the web build is installed and waits for the user's Restart. */
  "update.ready": "A new version is ready.",
  "update.restart": "Restart",
} as const;

export const updateText = (key: keyof typeof enUpdate): string => enUpdate[key];
