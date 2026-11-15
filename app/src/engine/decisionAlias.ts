// SPDX-License-Identifier: GPL-3.0-or-later
// G360 (night review 2026-11-14, be-7): Giac's other spellings of the functions decisions.ts reads by name (its
// DECISION_FUNCTIONS, LOGS, COMPLEX_DECISION_FUNCTIONS and RATIONAL_FUNCTIONS), as G304's ANGLE_ALIAS (angles.ts) is for
// the angle commands: `ceiling(sin(10^70)*10^12)` was never decided twice and showed = 387557674395 (right
// -148099131371, as `ceil` shows). Our reading of our own lists, not a Giac fault.
import { ANGLE_ALIAS, angleName } from "./angles.ts";

/**
 * Spelling → canonical name, from the census in tools/probes/g360/ (census.out): every name in Giac 2.1.0's source
 * whose evaluator is one of these functions' (rpn.cc's uppercase forms, ti89.cc's ceiling, intDiv, remain, nCr, mul,
 * prog.cc's sorted, subst.cc's French names, misc.cc's l2norm, maple.cc's modp, igcd), the lexer's (lim, trier, IFTE,
 * arccosh) and doc/aide_cas's synonyms (unitV, somme, add); and, read by hand in rpn.cc, IP (`_INT`, trunc's split by
 * sign), FP (`g-_INT(g)`, fPart's body), ABS (abs, a list's norm) and SIGN (sign), each checked on the raw engine.
 * Out: keywords and quoted forms (if, si, alors, 'ifte'), operators (mod, %, div, !) and ∏, which no call reads.
 * The angle commands' spellings (arcsin, ASIN, ARG) are ANGLE_ALIAS's, read through it (decisionName).
 */
export const DECISION_ALIAS: Readonly<Record<string, string>> = {
  ceiling: "ceil", CEILING: "ceil", FLOOR: "floor", ROUND: "round", TRUNCATE: "trunc", IP: "trunc", FP: "fPart",
  ABS: "abs", SIGN: "sign", MAX: "max", MIN: "min", PIECEWISE: "piecewise", IFTE: "when", sialorssinon: "ifte",
  integrer: "integrate", lim: "limit", limite: "limit", resoudre: "solve", l2norm: "norm", unitV: "normalize",
  SORT: "sort", sorted: "sort", trier: "sort", LN: "ln", ACOSH: "acosh", arccosh: "acosh",
  somme: "sum", add: "sum", mul: "product", remain: "irem", modp: "irem", intDiv: "iquo", igcd: "gcd", nCr: "comb", COMB: "comb",
};

/** The canonical name of a function the decision reading knows (G360): a decision alias's, an angle alias's (G304),
 *  else the name itself. */
export function decisionName(name: string): string {
  return Object.hasOwn(DECISION_ALIAS, name) ? DECISION_ALIAS[name]! : angleName(name);
}

/** `name` is one of Giac's other spellings in DECISION_ALIAS or ANGLE_ALIAS: a built-in. rpn.cc's uppercase forms
 *  (CEILING, SIN) are tokens that need an argument, so their bare word is a parse error (G360: namePrint asked it, and
 *  Home refused `CEILING(x)` as a syntax error that CAS reads). */
export function isAlias(name: string): boolean {
  return Object.hasOwn(DECISION_ALIAS, name) || Object.hasOwn(ANGLE_ALIAS, name);
}
