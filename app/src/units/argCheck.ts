// SPDX-License-Identifier: GPL-3.0-or-later
// G310: the functions whose argument the unit view's dimension check reads (decisions.md G35). build.ts flags a job
// with a slot or constant inside one of them, evaluate.ts checks their arguments in the check text. Plain TS, no engine.
import { callsOf } from "../engine/giacPrint.ts";

/** Functions of a pure number: their first argument must be one (a zero of a length too: exp(0 m) is refused). */
export const PURE_FNS = ["exp", "ln", "log10", "logb", "sinh", "cosh", "tanh", "asinh", "acosh", "atanh", "sec", "csc", "cot", "floor", "ceil", "round", "trunc", "frac", "fPart", "iPart", "Gamma", "erf", "erfc", "surd"] as const;
/** sin, cos and tan take a pure number or an angle (P15). */
export const TRIG_FNS = ["sin", "cos", "tan"] as const;
/** G40: the inverse functions that give an angle (the parser's ANGLE_OUT puts `/pasdeg` after each, R64). */
export const INVERSES = ["atan2", "asin", "acos", "atan", "asec", "acsc", "acot"] as const;

const ALL: readonly string[] = [...PURE_FNS, ...TRIG_FNS, ...INVERSES];
const SLOT = /\bpas[uk]\d+\b/;

/** Whether a formula (the request's, with its placeholders pasu<n>, pask<n>) has a slot or a constant inside a call of
 *  one of these functions: its check then runs with the value, whatever the value is. */
export function slotInCall(formula: string): boolean {
  return callsOf(formula, ALL, "typed").some((c) => c.close >= 0 && SLOT.test(formula.slice(c.open + 1, c.close)));
}
