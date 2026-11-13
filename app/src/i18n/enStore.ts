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
  "store.typed": "Enter stores {name}",
} as const;

export type StoreMessageKey = keyof typeof enStore;

/** A store sheet message; `{name}` placeholders are filled from `vars`. */
export function storeText(key: StoreMessageKey, vars?: Readonly<Record<string, string>>): string {
  const m: string = enStore[key];
  return vars ? m.replace(/\{(\w+)\}/g, (all, k: string) => vars[k] ?? all) : m;
}
