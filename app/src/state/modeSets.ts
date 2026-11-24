// SPDX-License-Identifier: GPL-3.0-or-later
// The setters only the Mode sheet (views/modeSheet.ts, a lazy chunk) calls: out of Session, so the start chunk does not
// carry them (it is pinned, size-check.ts; G792, as G785 moved Session.forget).
import { normalizeCycle, type FmtMode } from "./displayMode.ts";
import { clamp, type Session } from "./session.svelte.ts";

/** Ticks or unticks one mode of Fmt's cycle (normalizeCycle keeps it valid and never empty). */
export function setFmtMode(session: Session, mode: FmtMode, on: boolean): void {
  const ticked = new Set(session.settings.fmtCycle);
  if (on) ticked.add(mode);
  else ticked.delete(mode);
  session.settings.fmtCycle = normalizeCycle([...ticked]);
  session.save();
}

/** FIX's decimals, 0 to 12. */
export function setFixDecimals(session: Session, n: number): void {
  session.settings.fixDecimals = clamp(n, 0, 12);
  session.save();
}

