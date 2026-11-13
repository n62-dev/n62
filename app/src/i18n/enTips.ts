// SPDX-License-Identifier: GPL-3.0-or-later
// R15c4, R290: the words of the first-start tips. A table of its own, loaded with the tips' chunk (views/tipsHost.ts), so the
// start chunk does not carry it. English only so far. (The Settings row's label is "tips.row" in enAbout.ts.)
export const enTips = {
  "tips.title": "First-start tips",
  "tips.place": "Tap the name for your apps, Home and CAS",
  "tips.menu": "Tap ☰, on the keys or the status line, for Paste and each app's menu",
  "tips.rows": "On a history row, hold to copy and swipe to delete",
  "tips.fold": "On the entry line, swipe down to fold the keypad and up to bring it back",
  "tips.line": "On the line, drag to scroll and hold to select a term. Select and Deselect grow and shrink it",
  "tips.marks": "= exact. ≈ rounded, every digit shown is right. ⚠ could not be checked.",
  "tips.gotIt": "Got it",
} as const;

export type TipsKey = keyof typeof enTips;

export function tipsText(key: TipsKey): string {
  return enTips[key];
}
