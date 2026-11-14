// SPDX-License-Identifier: GPL-3.0-or-later
// R174: the words of A93's "Why trust it" section, with no node import, so README.md's generator (facts.mts) and the in-app page
// (app/src/views/aboutItems.ts, from `virtual:about`'s `trust`) build the same sentences from the same counts.

/** The date of the author's source that the sentence names ("his 7 Nov source"); the one constant beside the Status column.
 *  `aboutTrust` carries it in `patches.authorDate` for the page. */
export const AUTHOR_SOURCE_DATE = "7 Nov";

/** The counts the sentences read: facts.mts's `TrustFacts`, and `virtual:about`'s `trust`, both have them. */
export interface TrustCounts {
  readonly golden: {
    readonly answers: number;
    readonly open: number;
    readonly computed: number;
    readonly exact: number;
    readonly mpmath: number;
    readonly crossChecked: number;
    readonly handOrGuard: number;
  };
  readonly patches: {
    readonly total: number;
    readonly sent: number;
    readonly reported: number;
    readonly applied: number;
    readonly waiting: number;
    readonly notSent: number;
  };
}

/** 1966 → "1,966". */
export function group(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** The three paragraphs of the section's prose, separated by a blank line. */
export function trustSentences(f: TrustCounts, authorDate: string = AUTHOR_SOURCE_DATE): string {
  const g = f.golden, p = f.patches;
  return [
    `${group(g.answers)} recorded answers, ${group(g.open)} of them open cases. ${group(g.computed)} expected values are computed independently of Giac (${group(g.mpmath)} by mpmath, ${group(g.exact)} by exact arithmetic); ${group(g.crossChecked)} more are hand-derived or reference values cross-checked by machine; the other ${group(g.handOrGuard)} are hand-derived expected results or behaviour guards.`,
    `${group(p.total)} Giac patches. ${group(p.sent)} sent to the author: he wrote that ${group(p.reported)} should be integrated and applied ${group(p.applied)} in his ${authorDate} source, with differences being resolved; ${group(p.waiting)} more wait for his answer; ${group(p.notSent)} not sent.`,
    "When the engine, the parser or the units change, the golden gate re-runs the answers; when a golden file changes, the oracle recomputes the expected values.",
  ].join("\n\n");
}

export const TRAP_CAPTION = "*The sign of the first double depends on the order the expression is evaluated in; the other doubles are what a plain IEEE double returns.*";

/** How a refusal is written: the word and the quote marks. README's table uses markdown's, the page the level's own. */
export interface ShownStyle {
  readonly refused: string;
  readonly open: string;
  readonly close: string;
}
export const MARKDOWN_STYLE: ShownStyle = { refused: "refused", open: '"', close: '"' };

/** What N62 shows for a trap (R174f1): the golden row's mark and value; a row with no mark is a refusal and says so. One rule for
 *  README's table and the page, so a changed golden mark changes both. */
export function trapShown(mark: string, expect: string, style: ShownStyle = MARKDOWN_STYLE): string {
  return mark ? `${mark} ${expect}` : `${style.refused}: ${style.open}${expect}${style.close}`;
}
