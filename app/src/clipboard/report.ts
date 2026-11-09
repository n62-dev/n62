// SPDX-License-Identifier: GPL-3.0-or-later
// Report a problem (R172): the text that goes on the clipboard and the link that opens the issue form
// (.github/ISSUE_TEMPLATE/bug.yml). The session can be long and a GitHub URL that is too long returns 414, so the session
// travels on the clipboard and only the short fields go in the URL. Pure functions: no UI, no clipboard, no network.

const ISSUE_NEW = "https://github.com/n62-dev/n62/issues/new";
const TEMPLATE = "bug.yml";
/** The device string in the URL is cut to this many characters. */
const DEVICE_MAX = 200;
/** The report text is at most this long: GitHub's issue body takes 65,536 characters (from memory, not in its docs) and
 *  the rest of the form needs room. */
export const REPORT_CAP = 60_000;

/** The issue form's link, with the form's `version` and `device`-style field ids as the query keys. */
export function issueUrl(f: { version: string; device: string }): string {
  const q = new URLSearchParams({ template: TEMPLATE, version: f.version, device: f.device.slice(0, DEVICE_MAX) });
  // URLSearchParams writes a space as `+`; the form reads `%20` the same and the link stays plain
  return `${ISSUE_NEW}?${q.toString().replace(/\+/g, "%20")}`;
}

/** The note that says how many rows were cut (its count is the only part that varies). */
const leftOut = (n: number): string => `(${n} older ${n === 1 ? "row" : "rows"} left out)`;

/** Version and device first, then the session (one row per line). A session past the cap keeps its newest rows, with a
 *  line that says how many were left out. */
export function reportText(version: string, device: string, session: string): string {
  const head = `Version: ${version}\nDevice: ${device}\n\n`;
  if (head.length + session.length <= REPORT_CAP) return head + session;
  const rows = session.split("\n");
  // the note is at most 60 characters: reserve room for it and its line break
  const room = REPORT_CAP - head.length - 64;
  let size = 0;
  let from = rows.length;
  while (from > 0) {
    const row = rows[from - 1] as string;
    const add = row.length + (size > 0 ? 1 : 0);
    if (size + add > room) break;
    size += add;
    from--;
  }
  return `${head}${leftOut(from)}\n${rows.slice(from).join("\n")}`;
}
