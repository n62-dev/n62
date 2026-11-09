// SPDX-License-Identifier: GPL-3.0-or-later
// R15c4: the words of the first-start tips. A table of its own, loaded with the tips' chunk (views/tipsHost.ts), so the
// start chunk does not carry it. English only so far. (The Settings row's label is "tips.row" in enAbout.ts.)
export const enTips = {
  "tips.title": "First-start tips",
  "tips.place": "Tap the name for your apps, Home and CAS",
  "tips.menu": "Tap ☰ for the menu: copy, paste, settings",
  "tips.flicks": "Flick a key up for its Shift function, down for its letter",
  "tips.pad": "Drag on the round pad to move the cursor",
  "tips.find": "Math opens Find: one search for every function, constant and unit",
  "tips.marks": "= exact. ≈ rounded, every digit shown is right. ⚠ could not be checked.",
  "tips.gotIt": "Got it",
} as const;

export type TipsKey = keyof typeof enTips;

export function tipsText(key: TipsKey): string {
  return enTips[key];
}
