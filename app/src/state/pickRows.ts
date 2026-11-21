// SPDX-License-Identifier: GPL-3.0-or-later
// Which history row Up and Down pick (P4). A "note" row is a line the app says itself (G19's safe start): it is never
// drawn as picked, so it is never picked.
import type { HistoryItem } from "./session.svelte.ts";

type Row = Pick<HistoryItem, "status">;

const pickable = (items: readonly Row[], i: number): boolean => items[i] !== undefined && items[i]!.status !== "note";

/** The nearest row at or before `from` that can be picked, or null when there is none. */
export function pickAtOrBefore(items: readonly Row[], from: number): number | null {
  for (let i = Math.min(from, items.length - 1); i >= 0; i--) if (pickable(items, i)) return i;
  return null;
}

/** The nearest row after `from` that can be picked, or null when there is none. */
export function pickAfter(items: readonly Row[], from: number): number | null {
  for (let i = Math.max(from + 1, 0); i < items.length; i++) if (pickable(items, i)) return i;
  return null;
}

/** True when `i` is a row that can be picked. */
export const canPick = (items: readonly Row[], i: number): boolean => pickable(items, i);

/** R832: what a picked row has lit: the whole row (a tap elsewhere on it, or ▲), its input, or its result. */
export type PickPart = "row" | "input" | "result";

/** R832: what a tap on part `tapped` of row `index` does while `selected` is picked with `lit` lit. "pick": the row is picked (or the
 *  light moves) with the part tapped lit; a different row, or none picked, always. "act": the tapped part does its job (the input
 *  recalls, the result inserts, R147, the G2's way): on the whole-picked row, or on the lit half. "drop": a tap elsewhere on the
 *  whole-picked row drops the pick (on a lit half it picks the whole row). */
export const rowTap = (selected: number | null, lit: PickPart, index: number, tapped: PickPart): "pick" | "act" | "drop" =>
  index !== selected ? "pick" : tapped === "row" ? (lit === "row" ? "drop" : "pick") : lit === "row" || lit === tapped ? "act" : "pick";

/** R63: the input as a row draws and copies it: a unit row's request with the units in it, else `input` (the line as drawn,
 *  R100). The recall puts back the line itself (Home has no units). */
export function drawnInput(item: HistoryItem, input: (i: HistoryItem) => string): string {
  const u = item.units?.input;
  return input(typeof u === "string" ? { ...item, latex: u } : item);
}

/** The row an action means (Copy's rule, R775): the given (picked) one when it is finished, none when it is not; with no
 *  row given, the newest finished one. Copy, Fmt and a b/c share it. */
export const targetRow = <T extends Row>(items: readonly T[], row?: T): T | undefined =>
  (row ? [row] : [...items].reverse()).find((i) => i.status === "done");
