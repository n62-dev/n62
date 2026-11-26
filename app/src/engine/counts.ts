// SPDX-License-Identifier: GPL-3.0-or-later
// G405 (night review 2026-11-16, be-3): a count of a list Giac computed with floats. `size(solve(x^3-3*x+2-10^-30=0,x))`
// is an exact integer, but it counts the roots a numeric routine found, which may have merged two (it showed = 2, the
// polynomial has three real roots): the count takes the list's mark (docs/04 2.1, a non-number's row: the weakest
// element's), ⚠ when a function in the list's input is not audited, else ≈, never =.
import { functionsIn, isError, wholeCall } from "./giacPrint.ts";
import { hasFloat, isAudited, withDigits, type ElementFacts, type Giac } from "./numeric.ts";

const COUNTS = ["size", "dim", "nops"];

/** The argument of a whole `size(a)`, `dim(a)` or `nops(a)` call that computes something (a call in it), else null. */
export function countedArgument(input: string): string | null {
  for (const name of COUNTS) {
    const args = wholeCall(input, name, "typed");
    if (args?.length === 1 && functionsIn(args[0]!, "typed").length) return args[0]!;
  }
  return null;
}

/** `facts` of `size(a)`, `dim(a)` or `nops(a)` (exactBody, run at P digits) with the mark of a, when a holds a float. */
export function countFacts(giac: Giac, exactBody: string, P: number, digits: number, facts: ElementFacts[]): ElementFacts[] {
  const a = countedArgument(exactBody);
  if (a === null || !facts.every((f) => f.exact)) return facts;
  const list = withDigits(giac, P, digits, () => giac.eval(a));
  if (isError(list) || !hasFloat(list)) return facts;
  return facts.map((f) => (isAudited(a, "typed") ? { ...f, exact: false } : { ...f, warn: "unaudited" as const }));
}
