// SPDX-License-Identifier: GPL-3.0-or-later
// The texts of Settings › Key vibration and Settings › Counters (R127's press counts). A table of its own, loaded with
// the Mode sheet's chunk (views/modeSheet.ts), so the start chunk does not carry it (R91's pin, docs/04 8.3; moved out
// of en.ts by G183f1). English only so far.
export const enKeyFeel = {
  "settings.haptics": "Key vibration",
  "settings.haptics.strength": "Strength",
  "settings.haptics.ms": "Length",
  "settings.haptics.webNote": "The Android app only",
  "settings.haptics.off": "Switch key vibration on first",
  "settings.haptics.try": "Try it",
  "settings.click": "Key click",
  "settings.click.hint": "A short sound with each key press",
  "settings.counters": "Counters",
  "settings.counters.value": "{n} presses",
  "settings.taps.presses": "Key presses",
  "settings.taps.shiftAlpha": "Shift / Alpha taps",
  "settings.taps.since": "Counted on this device since",
  "settings.taps.export": "Export the counts",
  "settings.taps.reset": "Reset the counter",
  /** R53: the results mode's counts (decisions.md P16), one row in Counters and its own level. */
  "settings.uses": "Results mode",
  "settings.uses.value": "{n} folds",
  "settings.uses.handle": "Folds by the handle",
  "settings.uses.swipe": "Folds by a swipe",
  "settings.uses.pick": "Rows picked while folded",
  "settings.uses.actions": "Row actions while folded",
  "settings.on": "On",
  "settings.off": "Off",
} as const;

export type KeyFeelKey = keyof typeof enKeyFeel;

/** The text of `key`, each `{name}` replaced by its value. */
export const keyFeelText = (key: KeyFeelKey, vars: Readonly<Record<string, string>> = {}): string =>
  enKeyFeel[key].replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
