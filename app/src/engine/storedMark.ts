// SPDX-License-Identifier: GPL-3.0-or-later
// S53f1, G317: the preview and mark a stored variable carries into Vars. Worker side only (host.ts): defs.ts is read at
// start and must not pull the formatter in.
import { keepingAns } from "./analysis.ts";
import type { NameFacts, StoredMark } from "./defs.ts";
import { storeFacts } from "./facts.ts";
import { markOf } from "./format.ts";
import { homeEval, type Giac, type HomeResult, type HomeSettings } from "./homeEval.ts";
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

/** The mark facts a variable keeps when it is set from result `r` (decisions M4-7). */
export function resultFacts(r: HomeResult | undefined): NameFacts | null {
  if (!r || !r.ok) return null;
  if (!r.value && !r.items) return { exact: false, reliableDigits: null, warn: "unchecked" }; // a symbolic value with a float in it
  return { exact: false, reliableDigits: r.facts.reliableDigits, ...(r.facts.warn ? { warn: r.facts.warn } : {}) };
}

/** G328: the heads (bridge-2's tree) of an input in which a value that prints exactly can only come from exact
 *  arithmetic on exact values: a float makes floats, and nothing decides (a floor, a comparison) or turns a float exact. */
const PLAIN_HEADS: ReadonlySet<string> = new Set(["+", "-", "*", "/", "^", "sto", "copy", "approx", "evalf"]);

/** G317: a name an input set beside its result (inside it, `(A:=1/3)*0`, or one of a list assignment's, `A,B:=5,1/3`)
 *  holds its own value, not the result. In Home that value is shown as Home shows the name typed alone (homeEval, the
 *  one formatter of a result, Ans kept), with that value's mark; in CAS, on the raw eval path or for a value Home
 *  refuses, as the CAS view shows a result that is not one checked number (shownText.ts: floats at `digits`, never
 *  Giac's print at P), with no mark.
 *  G328: in Home it also gives the facts the name stores (`facts`, storedFacts' input) when they can be its own: a value
 *  that prints exactly (not `float`) from an input whose `heads` are all PLAIN_HEADS takes its own value's facts (a ⚠
 *  makes it not exact, as for a store target) merged with `lent`, those of the names and chips the input read (G48),
 *  never the result's: `(A:=5)*approx(1)` stores an exact 5. Otherwise there is no `facts` and the caller keeps the
 *  line's: Home's read of a stored float takes it as given, at P, and knows nothing of how it was made
 *  (`(A:=approx(1/3))*0` keeps approx's ⚠), nor of a decision that made an exact-looking value (`[q1,q2]:=[F,1]` with
 *  F an undecided floor, G48). */
export function sideShown(giac: Giac, name: string, home: { s: HomeSettings; bodies: Bodies; logged: LoggedNames; lent: NameFacts | null; float: boolean; heads: readonly string[] } | null, digits: number, angle: "rad" | "deg" | undefined): { preview: string; mark?: "=" | "≈"; facts?: NameFacts | null } {
  if (home) {
    const r = keepingAns(giac, () => homeEval(giac, name, home.s, undefined, PLAIN_FORM, home.bodies, false, home.logged));
    if (r.ok) {
      const f = resultFacts(r);
      const own = f && r.facts.warn !== undefined ? { ...f, inexact: true as const } : f;
      return { preview: r.display, ...storedMark(r, Math.trunc(home.s.digits)), ...(home.float || !home.heads.every((h) => PLAIN_HEADS.has(h)) ? {} : { facts: storeFacts(own, home.lent ? [home.lent] : [], null) }) };
    }
  }
  return { preview: nameShown(giac, name, digits, angle) };
}
