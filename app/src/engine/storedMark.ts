// SPDX-License-Identifier: GPL-3.0-or-later
// S53f1, G317: the preview and mark a stored variable carries into Vars. Worker side only (host.ts): defs.ts is read at
// start and must not pull the formatter in.
import { keepingAns } from "./analysis.ts";
import type { StoredMark } from "./defs.ts";
import { markOf } from "./format.ts";
import { homeEval, type Giac, type HomeSettings } from "./homeEval.ts";
import type { Bodies } from "./nonsquare.ts";
import { nameShown } from "./shownText.ts";
import { precisionFacts, type ResultLike } from "./precisionFacts.ts";
import type { LoggedNames } from "./sequences.ts";
import { PLAIN_FORM } from "./stores.ts";

/** The mark of `r` as the history draws it (the weakest of a list's elements), noted on a variable that holds that value:
 *  Vars shows it for a name that has no facts (an exact value stores none). G317: the result's for the target of a plain
 *  store of it (`X ▶ A`, `A:=X`), the name's own value's for any other name the input sets. A result with no mark, or a
 *  mark that is not = or ≈ (⚠ is the facts' to say), notes nothing. */
export function storedMark(r: ResultLike, digits: number): { mark?: StoredMark } {
  const mark = markOf(precisionFacts(r), { format: "STD", digits })?.mark;
  return mark === "=" || mark === "≈" ? { mark } : {};
}

/** G317: a name an input set beside its result (inside it, `(A:=1/3)*0`, or one of a list assignment's, `A,B:=5,1/3`)
 *  holds its own value, not the result. In Home that value is shown as Home shows the name typed alone (homeEval, the
 *  one formatter of a result, Ans kept), with that value's mark; in CAS, on the raw eval path or for a value Home
 *  refuses, as the CAS view shows a result that is not one checked number (shownText.ts: floats at `digits`, never
 *  Giac's print at P), with no mark. */
export function sideShown(giac: Giac, name: string, home: { s: HomeSettings; bodies: Bodies; logged: LoggedNames } | null, digits: number, angle: "rad" | "deg" | undefined): { preview: string; mark?: "=" | "≈" } {
  if (home) {
    const r = keepingAns(giac, () => homeEval(giac, name, home.s, undefined, PLAIN_FORM, home.bodies, false, home.logged));
    if (r.ok) return { preview: r.display, ...storedMark(r, Math.trunc(home.s.digits)) };
  }
  return { preview: nameShown(giac, name, digits, angle) };
}
