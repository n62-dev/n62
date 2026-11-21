// SPDX-License-Identifier: GPL-3.0-or-later
// R15c4, R290: the words of the first-start tips. A table of its own, loaded with the tips' chunk (views/tipsHost.ts), so the
// start chunk does not carry it. English only so far. (The Settings row's label is "tips.row" in enAbout.ts.)
export const enTips = {
  "tips.title": "First-start tips",
  "tips.place": "Tap ⊞▾ for your apps. Home stays; a second tap on CAS puts another app in its place",
  "tips.menu": "Tap ☰ for Delete, Share and Export; ⚙ for Settings",
  "tips.rows": "Tap a row's input or result to pick it, hold to copy, swipe left to delete",
  "tips.fold": "Tap ⌄ on the bar or swipe down on the line to fold the keypad",
  "tips.line": "On the line, drag to scroll and hold to select a term. Select and Deselect grow and shrink it",
  "tips.marks": "= exact. ≈ rounded, every digit shown is right. ⚠ could not be checked.",
  "tips.units": "Units: type the numbers, then Shift + Units (Tmpl). A unit after each number; → Check checks the result against a unit",
  "tips.gotIt": "Got it",
} as const;

export type TipsKey = keyof typeof enTips;

export function tipsText(key: TipsKey): string {
  return enTips[key];
}
