// SPDX-License-Identifier: GPL-3.0-or-later
// G315: the lists of Giac's names and the prints of names, read by numeric.ts, complex.ts, converge.ts, literalPrec.ts and
// degrees.ts. Split from numeric.ts and converge.ts so none of those imports another for a name (the one value-import cycle,
// night review 2026-11-09 ca-7, 2026-11-14 ca-5). Synchronous, UI-free; only erasable TypeScript.
import type { Giac } from "./numeric.ts";
import { KEYWORDS } from "./giacPrint.ts";
import { isAlias } from "./decisionAlias.ts";

/**
 * Functions whose floats the agreement check may trust without a second routine (docs/04 section 2.4 rule 3): the
 * decimal conversion itself and the elementary functions, which Giac evaluates with MPFR at any precision and which
 * every `≈` result of home.yaml already goes through (checked against the oracle). Every other function that returns
 * a float on the exact path is "unaudited" and gets ⚠ until it is in Find's tier 0 with a golden case (G4, EN7).
 * Audited for real arguments and for complex ones (G50, `tools/probes/complex-audit.ts`: sqrt, exp, ln, log,
 * log10, sin, cos, tan, asin, acos, atan, sinh, cosh, tanh, asinh, acosh, atanh, abs, arg and sign on 12 complex
 * arguments at 12, 30 and 50 digits). Giac's complex atan takes the other side of its cut, so it is evaluated through
 * COMPLEX_DEFINITIONS (complex.ts); complex tanh was coth until patch 0003 (G75), and ln of a negative MPFR real and
 * acos met pi as a double until patch 0005 (G60). Any part Giac still prints as a double where MPFR digits were asked
 * confirms one digit fewer than it prints (shortDigits). Giac runs in radians in every mode (G46), so DEG reads
 * the same routines (the probe's DEG rows). G223f1: linreg and stats1 (G223, tier 0) and the word ops shl, shr, rotl,
 * rotr, bnot (G229's golden rows; Find tier 0 comes with G235) are ours, exact for exact data: a float comes from approx.
 */
export const AUDITED_FUNCTIONS: ReadonlySet<string> = new Set([
  "evalf", "approx",
  "sqrt", "exp", "ln", "log", "log10", "sin", "cos", "tan", "asin", "acos", "atan",
  "sinh", "cosh", "tanh", "asinh", "acosh", "atanh",
  "abs", "re", "im", "conj", "arg", "sign", "floor", "ceil", "round", "frac", "max", "min",
  "sigfig", "par", "eseries", "pasmedian", "paspercentile", "passem", "linreg", "stats1", "linterp", "shl", "shr", "rotl", "rotr", "bnot",
]);

/** The periodic functions: the trig names, the one list of them (converge.ts, degrees.ts and literalPrec.ts read it, G307f2). */
export const PERIODIC: ReadonlySet<string> = new Set(["sin", "cos", "tan", "sec", "csc", "cot"]);

// --- G53: the prints of names (the G38 decision code is in decisions.ts) ---------------------------------------------

/** G93: Giac's words whose lexer token is T_RETURN (define_unary_function_ptr5(…, T_RETURN) in the pinned tarball): the
 *  word alone parses as a call with no argument, so evaluating it to read its print runs it (`restart` alone is
 *  restart(), which purges every name; Home's complex audit asked it of `restart(1)`). Each is a built-in: its print is
 *  `'word'`, never asked. */
const RUNS_BARE: ReadonlySet<string> = new Set([
  "Archive", "Circle", "CopyVar", "CyclePic", "del", "DelFold", "DelVar", "deSolve", "DrawFunc", "DrawInv", "DrawParm",
  "DrawPol", "DrawSlp", "DrwCtour", "Exec", "EXPORT", "Fill", "Get", "GetCalc", "giac_assert", "goto", "Graph", "hasard",
  "Input", "InputStr", "label", "Line", "LineHorz", "LineTan", "LineVert", "lis", "lis_phrase", "NewFold", "NewPic",
  "Output", "Pause", "PopUp", "Prompt", "PtOff", "PtOn", "PtText", "PxlOff", "PxlOn", "RANDOM", "RandSeed", "RANDSEED",
  "RclPic", "read", "repete", "restart", "restart_modes", "restart_vars", "resultat", "RplcPic", "SetFold", "SortA",
  "SortD", "srand", "StoPic", "throw", "Unarchiv", "VIEWS", "ZoomRcl", "ZoomSto",
]);

/** G53: the prints of names that never change, per Giac instance (a fresh engine starts empty). */
const FIXED_PRINTS = new WeakMap<Giac, Map<string, string>>();

/** Giac's print of `name`, trimmed (`'sin'`, a stored function's definition, the name itself when free). A built-in
 *  (printed quoted) is reserved, Giac refuses to store into it: its print is asked once per Giac instance (G53:
 *  notBuiltin and callsStateful asked them on every Enter). G223f1: a keyword cannot be stored into either, and is
 *  answered as a built-in without asking: a bare `local`, `catch` or `else` is a Giac parse error, which the host's
 *  strict eval turns into the whole input's syntax error (`inc(1)` of a body with try/catch, through decidingStored); G360: a spelling of our alias lists too (decisionAlias.ts isAlias: rpn.cc's bare `CEILING` is a parse error). */
export function namePrint(giac: Giac, name: string): string {
  let fixed = FIXED_PRINTS.get(giac);
  if (!fixed) FIXED_PRINTS.set(giac, (fixed = new Map()));
  const known = fixed.get(name);
  if (known !== undefined) return known;
  if (RUNS_BARE.has(name) || KEYWORDS.has(name) || isAlias(name)) return `'${name}'`;
  const out = giac.eval(name).trim();
  if (out === `'${name}'`) fixed.set(name, out);
  return out;
}

/** A predicate for "`name` is not a Giac built-in" (a stored function, or a name Giac does not know): Giac prints a
 *  built-in quoted (`sin` → `'sin'`) and a stored function as its definition (`f` → `(x)->floor(x*10^12)`). */
export function notBuiltin(giac: Giac): (name: string) => boolean {
  return (name) => namePrint(giac, name) !== `'${name}'`;
}
