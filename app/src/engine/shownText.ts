// SPDX-License-Identifier: GPL-3.0-or-later
// G317 fix round 1: the CAS view's text of a value that is not one checked number, in one place: the CAS result
// (host.ts casRun) and a name set beside a result (storedMark.ts sideShown) both print through it.
import { backInDegrees, needsDegrees, withoutDegreeQuotient } from "./degrees.ts";
import { bracesOf, LIST_TYPE, whenCalls } from "./giacPrint.ts";
import { regrouped } from "./homeEval.ts";
import { floatsShown, hasFloat, type Giac } from "./numeric.ts";

/** The value held in `slot`, printed as `text`, with its floats at the view's `digits` (G38: a float made at P prints all
 *  of P's digits, which nobody checked; held in `pasfl` then, which the caller purges when `atN`), regrouped (this build
 *  leaves x*x unevaluated, and latex() then draws x·x as "xx"). `slot` is where the text now is. */
export function floatsAtView(giac: Giac, text: string, slot: string, digits: number): { text: string; slot: string; atN: boolean } {
  const atN = hasFloat(text) ? floatsShown(giac, text, digits, "pasfl") : null;
  const at = atN === null ? slot : "pasfl";
  const t = atN ?? text;
  return { text: t.includes("*") ? regrouped(giac, at, t) : t, slot: at, atN: atN !== null };
}

/** The text drawn and copied for `text` (floatsAtView's): G46 (S14 option 2) in DEG as a DEG engine prints it (`deg`,
 *  null when the radian text stands); G173 (F93) Giac's `?:` as when(c,a,b), which the entry line reads; G109 Giac's list
 *  type (a solve result too) with braces, as Home shows it. */
export function shownOf(giac: Giac, text: string, angle: "rad" | "deg" | undefined): { deg: string | null; shown: string } {
  const deg = angle !== "deg" ? null : needsDegrees(text) ? backInDegrees(giac, text) : withoutDegreeQuotient(giac, text);
  const drawn = whenCalls(deg ?? text);
  return { deg, shown: drawn.includes(LIST_TYPE) ? bracesOf(drawn) : drawn };
}

/** G317: a stored name's value as the CAS view shows it (floatsAtView, then shownOf), never Giac's raw print at P. */
export function nameShown(giac: Giac, name: string, digits: number, angle: "rad" | "deg" | undefined): string {
  const held = giac.eval(`pasfl:=(${name})`);
  const at = floatsAtView(giac, held, "pasfl", digits);
  const { shown } = shownOf(giac, at.text, angle);
  giac.eval("purge(pasfl)");
  return shown;
}
