// SPDX-License-Identifier: GPL-3.0-or-later
// R327: a row "with σ", the one Shift + 1's uncertainty sheet explains: a finished Home row whose facts carry σ and its
// digits (the σ line's own test, state/sigmaLine.ts), or a unit row with σ (UnitRow.unc). Tiny and in the start chunk, so
// the key's dead press needs no load; the sheet itself is views/uncSheet.ts, a chunk of its own.
import type { HistoryItem } from "./session.svelte.ts";

export const hasSigma = (item: HistoryItem | undefined): item is HistoryItem =>
  item?.status === "done" && (item.units?.unc !== undefined || (item.facts?.uncSigma !== undefined && item.facts.uncDigits !== undefined));
