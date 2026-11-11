// SPDX-License-Identifier: GPL-3.0-or-later
// R285: the words of the browser note (views/browserNote.ts), a table of its own in that lazy chunk. English only so
// far. (The About row's words are in enAbout.ts.)
export const enBrowser = {
  "note": "Tested on Chrome and Android. This browser may misbehave: tell us what you see.",
  "ok": "OK",
} as const;

export type BrowserKey = keyof typeof enBrowser;

export function browserText(key: BrowserKey): string {
  return enBrowser[key];
}
