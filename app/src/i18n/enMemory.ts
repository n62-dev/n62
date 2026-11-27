// SPDX-License-Identifier: GPL-3.0-or-later
// R314: the words of Memory's Undo row (find/names.svelte.ts). A table of its own, loaded with Memory's code (Find's lazy
// chunk), so the start chunk, which carries enFind, does not. English only so far.
export const enMemory = {
  /** The row under Memory's names after a delete (a tap brings the names back). */
  "memory.undo1": "{name} deleted · Undo",
  "memory.undoN": "{n} names deleted · Undo",
  /** What an Undo says of a name defined since (it is left as it is). */
  "memory.taken": "{names} defined again, not restored",
} as const;

export type MemoryKey = keyof typeof enMemory;

export function memoryText(key: MemoryKey, vars?: Readonly<Record<string, string>>): string {
  const m: string = enMemory[key];
  return vars ? m.replace(/\{(\w+)\}/g, (all, k: string) => vars[k] ?? all) : m;
}
