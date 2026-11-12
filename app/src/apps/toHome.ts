// SPDX-License-Identifier: GPL-3.0-or-later
// R262: an app's answer (a Solve root, a Function readout) as Home's chip for Menu › To Home: its value with every
// confirmed digit and the facts it was shown with, so the mark travels as a history row's chip does (R65). Loaded with
// the apps; the start chunk has only the type of the chip.
import type { ValueFacts } from "../engine/types.ts";
import type { Chip } from "../input/chips.ts";
import { commaResult } from "../state/displayMode.ts";

/** The chip of an answer. `value`: a decimal with every confirmed digit (an integer when exact); `facts`: the answer's,
 *  or undefined for a value Solve passes on as exact (known(), an exact root without ⚠). An exact value that is not an
 *  integer (a fraction's decimal, cut at 40 digits) is not claimed exact: ≈, never a false =. */
export function answerChip(value: string, facts: ValueFacts | undefined): Chip {
  const v = value.replace("E", "e");
  const exact = (facts === undefined || (facts.exact && facts.inexact !== true)) && /^-?\d+$/.test(v);
  if (exact) return { value: v, exact: true, ...(facts?.warn ? { warn: facts.warn } : {}) };
  return { value: v, exact: false, reliableDigits: facts?.reliableDigits ?? null, ...(facts?.warn ? { warn: facts.warn } : {}) };
}

/** What the chip draws: the answer's shown text (plain, as the app formats it before its decimal mark) as LaTeX, `1.5E-7`
 *  as 1.5×10⁻⁷ and a PFX prefix upright; the bare ⚠ when no digit is confirmed (as Home's insert, App.svelte). */
export function answerShown(plain: string, facts: ValueFacts | undefined, comma: boolean): string {
  if (facts?.reliableDigits === 0 && !facts.warn) return "⚠";
  const latex = plain.replace(/E(-?\d+)$/, "\\times10^{$1}").replace(/ (\S+)$/, "\\,\\mathrm{$1}");
  return comma ? commaResult(latex, true) : latex;
}
