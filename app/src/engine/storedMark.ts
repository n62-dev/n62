// SPDX-License-Identifier: GPL-3.0-or-later
// S53f1, G317: the preview and mark a stored variable carries into Vars. Worker side only (host.ts): defs.ts is read at
// start and must not pull the formatter in.
import { keepingAns } from "./analysis.ts";
import type { NameFacts, StoredMark } from "./defs.ts";
import { readsFacts, storeFacts, type FactsHost } from "./facts.ts";
import { markOf } from "./format.ts";
import { homeEval, type Giac, type HomeResult, type HomeSettings } from "./homeEval.ts";
import type { GiacParse } from "./bridge.ts";
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

/** G328: the heads (bridge-2's tree) of what sets a name in which a value that prints exactly can only come from exact
 *  arithmetic on exact values: a float makes floats, and nothing decides (a floor, a comparison, a branch) or turns a
 *  float exact. */
const PLAIN_HEADS: ReadonlySet<string> = new Set(["+", "-", "*", "/", "^", "sto", "copy", "approx", "evalf"]);

/** G328: when `name` is set by plain arithmetic alone (PLAIN_HEADS) on the way to its store and in the value it stores
 *  (`tree.sides`), from no name the input sets too, on a line that took no decision (`r`'s why.decided: G48 keeps
 *  `[q1,q2]:=[F,1]` ⚠ for both, F an undecided floor): the facts its own reads lend (those of the names in its value,
 *  G48 rule 2) merged with `lent`, the inexact chips and constants the line put in as values (not told apart by
 *  place). The rest of the line does not count: `(A:=5)*sin(approx(1))` and `A,B:=5,sqrt(approx(2))` set A from 5
 *  alone. Null otherwise, and on an engine without `sides`. */
export function aloneFacts(host: FactsHost, tree: GiacParse, name: string, r: HomeResult, lent: readonly NameFacts[]): { lent: NameFacts | null } | null {
  const side = tree.sides?.[name];
  if (!side || r.facts.why?.decided) return null;
  if (!side.heads.every((h) => PLAIN_HEADS.has(h)) || side.reads.some((n) => n !== name && tree.targets.includes(n))) return null;
  return { lent: storeFacts(null, lent, readsFacts(host, { names: side.reads, targets: [], fn: false }).facts) };
}

/** G317: a name an input set beside its result (inside it, `(A:=1/3)*0`, or one of a list assignment's, `A,B:=5,1/3`)
 *  holds its own value, not the result. In Home that value is shown as Home shows the name typed alone (homeEval, the
 *  one formatter of a result, Ans kept), with that value's mark; in CAS, on the raw eval path or for a value Home
 *  refuses, as the CAS view shows a result that is not one checked number (shownText.ts: floats at `digits`, never
 *  Giac's print at P), with no mark.
 *  G328: in Home it also gives the facts the name stores (`facts`, storedFacts' input) when it is set `alone`
 *  (aloneFacts): its own value's facts merged with those `alone` lends, never the result's: `(A:=5)*approx(1)` stores
 *  an exact 5 (a ⚠ of its own makes it not exact, as for a store target). Home's read of a stored float takes it as
 *  given, at P, and knows nothing of how it was made: a numeric float takes the facts of a value its line ran once
 *  (numeric.ts: at most the setting's digits, unchecked), as `approx(1/3) => A` stores. Otherwise there is no `facts`
 *  and the caller keeps the line's (`(A:=round(approx(5/2)))*1`). */
export function sideShown(giac: Giac, name: string, home: { s: HomeSettings; bodies: Bodies; logged: LoggedNames; float: boolean; alone: { lent: NameFacts | null } | null } | null, digits: number, angle: "rad" | "deg" | undefined): { preview: string; mark?: "=" | "≈"; facts?: NameFacts | null } {
  if (home) {
    const r = keepingAns(giac, () => homeEval(giac, name, home.s, undefined, PLAIN_FORM, home.bodies, false, home.logged));
    if (r.ok) {
      const shown = { preview: r.display, ...storedMark(r, Math.trunc(home.s.digits)) };
      const f = resultFacts(r);
      if (!home.alone || !f) return shown;
      const d = Math.trunc(home.s.digits);
      const once = { exact: false, reliableDigits: Math.min(f.reliableDigits ?? d, d), warn: f.warn === "unaudited" ? ("unaudited" as const) : ("unchecked" as const) };
      const own = home.float && (r.value || r.items) ? once : r.facts.warn !== undefined ? { ...f, inexact: true as const } : f;
      return { ...shown, facts: storeFacts(own, home.alone.lent ? [home.alone.lent] : [], null) };
    }
  }
  return { preview: nameShown(giac, name, digits, angle) };
}
