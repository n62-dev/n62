// SPDX-License-Identifier: GPL-3.0-or-later
// R197: the Help key's words (views/helpSheet.ts; R869: the cards, views/helpCard.ts; R870: the unit view's, units/slotHelp.ts). A table of its own, so the chunks that share Find's table (the unit
// view's) do not carry them. English only so far.
export const enHelp = {
  "title": "Help: {name}",
  "example": "Example",
  "insert": "Insert the example",
  "rad": "(radians)",
  "deg": "(degrees)",
  // R869: the card of a unit, prefix or constant (views/helpCard.ts)
  "card.exact": "exact",
  "card.definition": "exact (SI definition)",
  "card.codata": "CODATA",
  "card.offset": "{unit} = {scale}{si} − {offset}",
  "card.step": "a difference of 1 {unit} is {size} {si}",
  "card.notChecked": "not checked",
  "card.insert": "Insert",
  // R870: Help in the unit view (units/slotHelp.ts): a factor's row, and the title of an empty slot's help
  "unit.row": "{names}: {value}",
  "unit.empty": "unit slot",
} as const;

export type HelpMessageKey = keyof typeof enHelp;

/** A Help message; `{name}` placeholders are filled from `vars`. */
export function helpText(key: HelpMessageKey, vars?: Readonly<Record<string, string>>): string {
  const m: string = enHelp[key];
  return vars ? m.replace(/\{(\w+)\}/g, (all, k: string) => vars[k] ?? all) : m;
}
