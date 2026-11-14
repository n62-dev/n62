// SPDX-License-Identifier: GPL-3.0-or-later
// English strings of Copy, Paste and Share. They sit beside the code, which loads on first use (not in the start
// chunk, docs/04 section 8.3); the keyboard legends (key.select, key.deselect) stay in i18n/en.ts.
const clip = {
  "clip.title": "Menu",
  "clip.copy": "Copy",
  "clip.asShown": "Copy as shown",
  "clip.exact": "Copy exact",
  "clip.latex": "Copy LaTeX",
  "clip.insert": "Insert",
  "clip.recall": "Recall",
  "clip.store": "Store ▶",
  "clip.delete": "Delete",
  "clip.copyAs": "Copy as",
  "clip.subShown": "As shown",
  "clip.subExact": "Exact",
  "clip.subLatex": "LaTeX",
  "clip.working": "Still working",
  "clip.paste": "Paste",
  "clip.share": "Share session",
  "clip.clear": "Clear history",
  "clip.csv": "Copy table as CSV",
  "clip.copied": "Copied",
  "clip.copiedTable": "Copied the table as CSV",
  "clip.nothing": "Nothing to copy",
  "clip.noExact": "No exact form",
  "clip.noResult": "No result yet",
  "clip.notNumber": "Paste: not a number",
  "clip.unavailable": "The clipboard is not available",
  "clip.shared": "Shared",
  "clip.sharedAsCopy": "This device cannot share: copied instead",
  "clip.sessionTitle": "N62 session",
  // R130: ☰ › Export › (item 10, shared with R181 and R200) and the work report it saves (workReport.ts)
  "clip.export": "Export",
  "export.work": "Work report",
  "export.nothing": "Nothing to export",
  "export.saved": "Work report saved",
  "export.offered": "Work report offered as a download",
  "export.cancelled": "Work report not saved",
  "export.failed": "The work report could not be saved",
  "report.preview": "preview: the form of this file can change",
  "report.title": "Work report",
  "report.view": "View",
  "report.exportAngle": "Angle mode at export",
  "report.angle": "Angle",
  "report.notRecorded": "not recorded",
  "report.digits": "Digits",
  "report.format": "Number format",
  "report.decimalMark": "Decimal mark",
  "report.point": "point",
  "report.comma": "comma",
  "report.step": "Step",
  "report.input": "Input",
  "report.mark": "Mark",
  "report.value": "Value",
  "report.uncertainty": "Uncertainty",
  "report.sigma": "standard uncertainty (σ)",
  "report.uses": "Uses",
  "report.note": "Note",
  "report.error": "Error",
  "report.about":
    "About this file: Markdown that a person reads and a program can parse. The first line names the N62 version; the list under the title gives the settings that change a value. " +
    "Angle mode at export: the mode when the file was written; a row keeps the value it was computed with when the mode changes. " +
    "Each step is one history row, under a heading `## Step n`, as a list of `Name: text` lines. Input: the entry as typed. " +
    "Angle: the angle mode the step was computed in, when it differs from the mode at export, or `not recorded`; a step without it was computed in the mode at export. " +
    "Mark: `= exact` (the value shown is exact), `≈` (rounded; every digit shown is confirmed) or `⚠` (not every digit shown is confirmed, or not checked), each followed by its reason. " +
    "Value: the result as shown, in the decimal mark the header names and without digit groups, with its unit; a result of the unit view holds `± σ` before the unit. " +
    "Uncertainty: `± σ` of every value that has one (a constant's too), the standard uncertainty (σ, one standard deviation). " +
    "Uses: the stored values the input read. Note: a line the history showed under the row. Error: the message of an entry that failed. A step without a Mark line has no number to mark.",
  // R36: the picked row's line (whyLine.ts)
  "why.exact": "exact",
  "why.rounded": "rounded",
  "why.exactIs": "the exact value is",
  "why.uses": "uses",
  "why.itselfRounded": "itself rounded",
  "why.itselfUncertain": "itself uncertain",
  "why.of": "of",
  "why.confirmed": "digits confirmed",
  "why.noDigit": "no digit confirmed",
  "why.decided": "decided at limited precision",
  "why.differ": "the exact and numeric answers differ",
  "why.once": "evaluated once, nothing to compare",
  "why.pastCap": "more than 1000 digits: compared at two precisions only, not raised further",
  "why.squareUnchecked": "a matrix shape or vector length not checked",
  "why.existsUnchecked": "the check that this value exists did not finish",
  "why.isNotChecked": "is not checked",
  "why.areNotChecked": "are not checked",
  "why.notChecked": "not checked",
  "why.notConfirmed": "fewer digits confirmed than shown",
} as const;

export type ClipKey = keyof typeof clip;

/** Look up a Copy/Paste message. */
export function tc(key: ClipKey): string {
  return clip[key];
}
