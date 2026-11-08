// SPDX-License-Identifier: GPL-3.0-or-later
// The texts of Settings › Appearance (R50e; Key shadows R156, Key pop-ups R163). A table of its own, loaded with the Mode sheet's chunk
// (views/modeSheet.ts), so the start chunk does not carry it (R91's pin, docs/04 8.3; moved out of en.ts by R156, as
// G183f1 moved enKeyFeel.ts). English only so far.
export const enLook = {
  "appearance.theme": "Theme",
  "appearance.brightness": "Brightness",
  "appearance.brightness.system": "System",
  "appearance.brightness.light": "Light",
  "appearance.brightness.dark": "Dark",
  "appearance.contrast": "High contrast",
  "appearance.contrast.hint": "Text at 7:1, outlined keys",
  "appearance.plain": "Plain keys",
  "appearance.plain.hint": "No colour coding",
  "appearance.shadow": "Key shadows",
  "appearance.shadow.hint": "A dark line under each key",
  "appearance.pops": "Key pop-ups",
  "appearance.pops.hint": "A bubble over the key you press or flick",
} as const;

export type LookKey = keyof typeof enLook;

/** The text of `key`. */
export const lookText = (key: LookKey): string => enLook[key];
