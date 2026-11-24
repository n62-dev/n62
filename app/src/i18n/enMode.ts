// SPDX-License-Identifier: GPL-3.0-or-later
// The Mode sheet's and Settings' row names and values (views/modeSheet.ts; moved out of en.ts by R53, to make room in the
// start chunk). A table of its own, loaded with the Mode sheet's chunk (R91's pin, docs/04 8.3). English only so far.
export const enMode = {
  "mode.angle": "Angle",
  "mode.format": "Number format",
  "mode.digits": "Significant digits",
  "mode.decimals": "Decimals in Fixed",
  "mode.entry": "Entry",
  "settings.vibration": "Key vibration",
  "settings.appearance": "Appearance",
  "entry.textbook": "Textbook",
  "entry.line": "One line",
  "settings.fmtCycle.hint": "The Fmt key steps through the ticked ones",
  "settings.fmt.std": "Standard",
  "settings.fmt.sci": "Scientific",
  "settings.fmt.eng": "Engineering",
  "settings.fmt.pfx": "Prefixes (k, M, µ …)",
  "settings.fmt.fix": "Fixed",
  "settings.numbers": "Numbers",
  "settings.decimalMark": "Decimal mark",
  "settings.decimalMark.point": "Point",
  "settings.decimalMark.comma": "Comma",
} as const;

export type ModeKey = keyof typeof enMode;

export const modeText = (key: ModeKey): string => enMode[key];
