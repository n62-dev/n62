// SPDX-License-Identifier: GPL-3.0-or-later
// How big a sheet's rows are (docs/05 3.1, R770): a row has its normal height and a sheet taller than its box scrolls;
// nothing shrinks. Plain numbers, no DOM.
import type { MenuItem } from "../apps/types.ts";

/** A list row's height, and the least one (font and padding together; sheetWindow.ts builds rows from the least). */
export const ROW = 42;
export const ROW_FLOOR = 36;
/** The reason line under a disabled row (docs/05 3.1). */
export const REASON = 16;
/** A row whose value has ◀ ▶ buttons is at least as tall as they are (44 × 44 px for the thumb). */
export const STEP = 44;
/** A row with a button per value (R86, Mode): 44 px buttons and 4 px of air above and below. */
export const OPTIONS = 52;
/** What a row needs besides its line: a reason line, ◀ ▶ buttons. */
export interface RowNeeds {
  readonly reason: boolean;
  readonly steps: boolean;
  /** A button per value (R86). */
  readonly options?: boolean;
}

/** A row's height for a line height `row`. */
export const rowHeight = (row: number, r: RowNeeds): number => Math.max(row + (r.reason ? REASON : 0), r.steps ? STEP : 0, r.options ? OPTIONS : 0);

/** A disabled row says why, once for a run of neighbouring disabled rows with the same reason: under the run's last
 *  row (R7 open point 5: five rows saying "Define a function first" do not fit, and say nothing more). */
export function showsReason(items: readonly MenuItem[], i: number): boolean {
  const item = items[i];
  if (!item?.disabled || !item.reason) return false;
  const next = items[i + 1];
  return !(next?.disabled && next.reason === item.reason);
}

/** The row has a second line: its reason (showsReason), its hint (R49), or the colour dots of a row with ◀ ▶ buttons (R50e:
 *  at 360 px the buttons and the name leave no room for them beside the label). */
export const twoLines = (items: readonly MenuItem[], i: number): boolean => {
  const item = items[i];
  return showsReason(items, i) || item?.hint !== undefined || (item !== undefined && item.dots !== undefined && hasSteps(item));
};

/** The row draws a button per value (R86). */
export const hasOptions = (item: MenuItem): boolean => item.options !== undefined;

/** The row has a value that ◀ ▶ change in place (the Mode sheet, R21a). */
export const hasSteps = (item: MenuItem): boolean => item.adjust !== undefined && item.value !== undefined;
