// SPDX-License-Identifier: GPL-3.0-or-later
// R87: the words of Settings › Help and about. A table of its own, loaded with the Mode sheet's chunk
// (views/aboutItems.ts), so the start chunk does not carry it. English only so far.
export const enAbout = {
  "help": "Help and about",
  "tips.row": "Show the first-start tips",
  "report.row": "Report a problem",
  "report.copied": "Copied. The form opens: paste the report into it",
  "report.openBy": "Copied. Open github.com/n62-dev/n62/issues/new and paste it",
  "title": "About N62",
  "aboutTitle": "About",
  "hint": "Version, source, GPL-3.0",
  "parts": "Parts we use and their licences",
  "partsTitle": "Parts",
  "partsHint": "From THIRD_PARTY.md",
  "loading": "Loading…",
  "version": "Version",
  "licence": "Licence",
  "source": "Source code",
  "credits": "Credits",
  "credits.text": "N62 is free software under the GNU General Public License, version 3 or later, with no warranty. It stands on the work of others: the Giac computer algebra system by Bernard Parisse and its authors, with GMP, MPFR and GSL under it; MathLive by Arno Gourdol for the entry line and the result display; libqalculate by Hanna Knutsson for the names and titles of units and constants and for their numbers (unit factors, constant values and uncertainties, checked in as find/factors.yaml); JSXGraph for the plots; Svelte, Vite and Capacitor for the app; the colour scheme Solarized. Every part, its licence and its full licence text are listed under Parts we use.",
  /** R149: the credits sheet (N62, then Enter). The story is the owner's own words, unedited. */
  "credits.title": "N62",
  "credits.story": "N for number, 6 first perfect number, 2 first prime number",
  "credits.madeWith": "Made with",
  "credits.licence": "N62 is free software under the GNU General Public License, version 3 or later, with no warranty.",
  "noText": "No licence text in the app",
  "copyright": "No copyright line given",
} as const;

export type AboutKey = keyof typeof enAbout;

export function aboutText(key: AboutKey): string {
  return enAbout[key];
}
