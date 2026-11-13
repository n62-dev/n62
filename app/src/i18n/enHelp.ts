// SPDX-License-Identifier: GPL-3.0-or-later
// R197: the Help key's words (views/helpSheet.ts). A table of its own, so the chunks that share Find's table (the unit
// view's) do not carry them. English only so far.
export const enHelp = {
  "title": "Help: {name}",
  "example": "Example",
  "insert": "Insert the example",
  "rad": "(radians)",
  "deg": "(degrees)",
} as const;

export type HelpMessageKey = keyof typeof enHelp;

/** A Help message; `{name}` placeholders are filled from `vars`. */
export function helpText(key: HelpMessageKey, vars?: Readonly<Record<string, string>>): string {
  const m: string = enHelp[key];
  return vars ? m.replace(/\{(\w+)\}/g, (all, k: string) => vars[k] ?? all) : m;
}
