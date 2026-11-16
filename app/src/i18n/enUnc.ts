// SPDX-License-Identifier: GPL-3.0-or-later
// R40: the uncertainty texts (Settings › Numbers › Uncertainty, R124's Marks, R125's Digit groups, the Fmt key cycle row, the σ line,
// R327's uncertainty sheet). A table of its own,
// loaded with the Mode sheet's and the σ line's chunks, so the start chunk does not carry it (R91's pin, docs/04 8.3).
// English only so far.
export const enUnc = {
  "unc.fmtCycle": "Fmt key cycle",
  "unc.setting": "Uncertainty",
  "unc.setting.sigma": "Muted digits, σ on tap",
  "unc.setting.muted": "Muted digits",
  "unc.sigma": "σ = {s} · U = 2σ = {u} (k = 2)",
  // R327: the uncertainty sheet's head (Shift + 1; docs/archive/mockups/uncertainty-sheet.html section 4's words)
  "unc.sheet": "Uncertainty",
  "unc.sheet.sigma": "standard uncertainty (σ)",
  "unc.sheet.expanded": "expanded",
  "unc.sheet.u": "U = 2σ = {u} (k = 2)",
  "unc.sheet.relative": "relative σ",
  "unc.sheet.percent": "{p} %",
  "unc.sheet.zero": "none: the value is 0",
  // R328: the sheet's rows, each input's share of σ² (the mockup's sections 2 to 4, variant A)
  "unc.rows.input": "Input",
  "unc.rows.uy": "uᵢ",
  "unc.rows.share": "% of σ²",
  "unc.rows.small": "< {p} %",
  "unc.rows.smallNeg": "> {p} %",
  "unc.rows.second": "second order",
  "unc.rows.chip": "result chip",
  "unc.rows.via": "via {names}",
  "unc.rows.typed": "input {n}",
  "unc.rows.independent": "treated as independent; σ and shares may be off if it shares an input with another term.",
  "unc.rows.over100": "A row can exceed 100 % when the second-order term is negative: it takes σ² below the first-order rows.",
  "unc.rows.rounded": "rounded; not adjusted (the shares add to {p} %)",
  "unc.rows.jump": "No shares: an input's ± 2σ reaches a jump, where a derivative says nothing about the spread.",
  "unc.rows.singular": "No shares: an input's ± 2σ reaches a singular point, where a derivative says nothing about the spread.",
  "unc.rows.firstOrderZero": "No shares: the first-order part is 0, so all of σ² is the second-order term (shares would read 0 % and 100 %).",
  // R124: Settings › Numbers › Marks
  "marks.setting": "Marks",
  "marks.setting.muted": "Muted",
  "marks.setting.colour": "⚠ coloured",
  "marks.setting.reason": "⚠ + reason",
  "marks.setting.muted.spoken": "Marks muted",
  "marks.setting.colour.spoken": "Warning marks in colour",
  "marks.setting.reason.spoken": "Warning marks in colour, with their reason under the result",
  // R125: Settings › Numbers › Digit groups (the labels show a group; the spoken names say the separator)
  "groups.setting": "Digit groups",
  "groups.setting.thin": "1\u2009234",
  "groups.setting.apos": "1’234",
  "groups.setting.comma": "1,234",
  "groups.setting.thin.spoken": "Digit groups: thin space",
  "groups.setting.apos.spoken": "Digit groups: apostrophe",
  "groups.setting.comma.spoken": "Digit groups: comma",
  "groups.setting.commaOff": "Not the comma: the decimal mark is the comma",
} as const;

export type UncKey = keyof typeof enUnc;

/** The text of `key`, each `{name}` replaced by its value. */
export const uncText = (key: UncKey, vars: Readonly<Record<string, string>> = {}): string =>
  enUnc[key].replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
