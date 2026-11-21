// SPDX-License-Identifier: GPL-3.0-or-later
// R281: the store sheet's words (views/storeSheet.svelte.ts). A table of its own, loaded with that lazy chunk, so neither the
// start chunk nor Find's (which the unit view loads) carries them. English only so far.
export const enStore = {
  "store.title": "Store {value} in",
  "store.titleBare": "Store in",
  "store.free": "{name} is free",
  "store.again": "{value} · again?",
  "store.holds": "{what}. Tap {name} again to replace it",
  "store.holdsWith": "{what}. Tap {name} again to replace it with {with}",
  // R804: letters typed. A free name says what Enter does and that more letters make a longer name; a stored one asks first.
  "store.typedFree": "{name} is free · Enter stores in {name} · keep typing for a longer name",
  "store.typedFreeWith": "{name} is free · Enter stores {with} in {name} · keep typing for a longer name",
  "store.typedHeld": "{name} is stored · Enter asks before it is replaced",
  "store.holdsTyped": "{what}. Enter again replaces it",
  "store.holdsTypedWith": "{what}. Enter again replaces it with {with}",
  "store.new": "New name…",
} as const;

export type StoreMessageKey = keyof typeof enStore;

/** A store sheet message; `{name}` placeholders are filled from `vars`. */
export function storeText(key: StoreMessageKey, vars?: Readonly<Record<string, string>>): string {
  const m: string = enStore[key];
  return vars ? m.replace(/\{(\w+)\}/g, (all, k: string) => vars[k] ?? all) : m;
}
