// SPDX-License-Identifier: GPL-3.0-or-later
// R154: what the outline of the entry field says. At rest it is --ring; Shift, Alpha and an error each have their own
// colour (App.svelte sets data-ring on .entry from this). A pure function of the session's state, so it is tested alone.
import type { ItemStatus, View } from "../state/session.svelte.ts";

export type Ring = "rest" | "shift" | "alpha" | "error";

export interface RingInput {
  /** Shift is armed or locked. */
  shift: boolean;
  /** Alpha is armed or locked. */
  alpha: boolean;
  /** The view under the keys: Home or CAS, or an app (whose entry line has Shift and Alpha but no error outline). */
  view: View | "app";
  /** The status of the shown view's newest history item. */
  newest: ItemStatus | undefined;
  /** The entry line holds nothing. */
  lineEmpty: boolean;
  /** A key was pressed or the line was edited since the last Enter. */
  editedSinceEnter: boolean;
}

/**
 * Alpha, armed or locked, wins over Shift (in the lock the next key types a letter); then Shift. The error outline
 * shows only in Home and CAS, while the newest item is an error, the line is empty and nothing has touched it since
 * Enter: the next key puts it back to rest.
 */
export function ringState(s: RingInput): Ring {
  if (s.alpha) return "alpha";
  if (s.shift) return "shift";
  if ((s.view === "home" || s.view === "cas") && s.newest === "error" && s.lineEmpty && !s.editedSinceEnter) return "error";
  return "rest";
}
