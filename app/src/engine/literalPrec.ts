// SPDX-License-Identifier: GPL-3.0-or-later
// G141 (night review 2026-10-30, be-1): the working precision a long exact literal needs. Two evaluations at P and P + 20
// agree on whatever both lose: (1+10^-100)^(10^100) is exp(10^100*ln(1+1/10^100)), and at 40 and 60 digits the 10^-100
// is rounded away, so both give 1 and the agreement check confirmed 38 digits of a value that is e. A literal of n digits
// cancels at most n, so the check starts at n + P instead, and confirms as many digits as it does without one. An
// intermediate loss with no long literal (a tiny value stored in a name) is not caught here (S20's intervals are the
// general cure). The literals are read by giacPrint's number reader. Only erasable TypeScript syntax, so Node runs this
// file directly.
import type { PrecisionWarn } from "./format.ts";
import { isNameChar, numbers, type Quoting } from "./giacPrint.ts";

/** A literal with more digits than P minus this raises where the agreement check starts (G141): at P it would leave
 *  fewer than this many digits after its cancellation. */
export const LITERAL_MARGIN = 20;
/** Levels above the start the agreement check may take before its further steps (S, S+20, S+40). */
const LEVELS_ABOVE = 40;

/** `d` without its leading zeros (one 0 is kept). */
function noLeadingZeros(d: string): string {
  let k = 0;
  while (k < d.length - 1 && d.charAt(k) === "0") k++;
  return d.slice(k);
}

/** Gaps a typed power's exponent may stand behind: `10^100`, `10^-100`, `10^(100)`, `10^(-100)`. */
const EXPONENT_GAPS: readonly string[] = ["", "-", "(", "(-"];

/** G307: the constants whose power with an integer literal exponent is read as a magnitude, by how the text writes it:
 *  `pi^200`, `pi^(-200)` (a power of pi), `exp(200)`, `exp(-200)` (the eˣ key's form, emit.ts), each with log10 of the
 *  constant. No other name: a named constant has its own checks. */
const CONSTANT_POWERS: readonly { before: string; gaps: readonly string[]; closes: boolean; log10: number }[] = [
  { before: "pi^", gaps: EXPONENT_GAPS, closes: false, log10: Math.log10(Math.PI) },
  { before: "exp(", gaps: ["", "-"], closes: true, log10: Math.LOG10E },
];

/** The power of pi or exp (CONSTANT_POWERS) whose integer literal exponent is `mant` at `at`..`end` of `text`: its digit
 *  count ⌈|n|·log10 c⌉, and whether it is a tiny value (a `-` before the exponent as typed, or after a `/`, as Giac
 *  prints exp(-200): 1/exp(200)); null when the literal is no such exponent. */
function constantPower(text: string, at: number, end: number, mant: string): { digits: number; tiny: boolean } | null {
  for (const c of CONSTANT_POWERS) {
    for (const gap of c.gaps) {
      const k = at - gap.length - c.before.length;
      const b = text.charAt(k - 1);
      if (k < 0 || !text.startsWith(c.before + gap, k) || isNameChar(b) || b === ".") continue;
      if ((c.closes || gap.startsWith("(")) && !text.startsWith(")", end)) continue;
      return { digits: Math.ceil(Number(mant) * c.log10), tiny: gap.includes("-") || b === "/" };
    }
  }
  return null;
}

/** literalDigits, and the same count without a huge power of pi or exp (one that is no tiny value, constantPower). */
function literalCounts(text: string, q: Quoting): { digits: number; withoutHuge: number } {
  const ints = [...numbers(text, q)].filter((n) => n.exp === undefined && !n.mant.includes("."));
  let total = 0;
  let withoutHuge = 0;
  const count = (d: number, huge = false): void => {
    total = Math.max(total, d);
    if (!huge) withoutHuge = Math.max(withoutHuge, d);
  };
  ints.forEach((n, k) => {
    count(noLeadingZeros(n.mant).length);
    const c = constantPower(text, n.at, n.end, n.mant);
    if (c) count(c.digits, !c.tiny);
    // a power of two integer literals
    const e = ints[k + 1];
    if (!e || text.charAt(n.end) !== "^" || text.charAt(n.at - 1) === ".") return;
    const gap = text.slice(n.end + 1, e.at);
    if (!EXPONENT_GAPS.includes(gap) || (gap.startsWith("(") && !text.startsWith(")", e.end))) return;
    const a = Number(n.mant);
    const b = Number(e.mant);
    if (a < 2 || b === 0) return;
    count(Math.floor(b * Math.log10(a)) + 1);
  });
  return { digits: total, withoutHuge };
}

/**
 * The digit count of the longest exact integer in `text`: an integer as Giac prints it, or, in a text as typed, a power
 * of two integer literals (`10^(-100)` stands for a 101-digit denominator); and, G307, a power of pi or exp of an integer
 * literal (`pi^(-200)` stands for a 100-digit magnitude, `exp(-200)` for an 87-digit one; Giac prints them as
 * `1/pi^200`, `1/exp(200)`). 0 when there is none. Strings, other names and decimals count nothing.
 */
export function literalDigits(text: string, q: Quoting): number {
  return literalCounts(text, q).digits;
}

/**
 * Where the agreement check of `text` starts when the value precision is P (G141): at P, or, for an exact integer of n
 * digits with n + LITERAL_MARGIN > P, at n + P. When those levels pass `cap` (MAX_EVAL_DIGITS), at P, and the value is
 * `unchecked` (⚠, never ≈): a power of ten too (G141f1, Opus pass 68: `(1-cos(10^-600))*10^1200+1` is 1.5, and at P and
 * P + 20 both round the 10^-600 away; S20's intervals are the cure), and a tiny power of pi or exp (G307,
 * `(1+pi^(-2200))^(pi^2200)`). A huge one past the cap counts nothing: alone it rounds no term away, and MPFR evaluates
 * exp(10000000) (`exp(10^7)` as Giac prints it) right at every level, which ≈ said before G307 (g58-exp-1e7-12).
 */
export function literalStart(text: string, P: number, cap: number, q: Quoting): { at: number; unchecked: boolean } {
  const { digits, withoutHuge } = literalCounts(text, q);
  const start = (n: number): { at: number; unchecked: false } | null =>
    n + LITERAL_MARGIN <= P ? { at: P, unchecked: false } : n + P + LEVELS_ABOVE <= cap ? { at: n + P, unchecked: false } : null;
  return start(digits) ?? start(withoutHuge) ?? { at: P, unchecked: true };
}

/**
 * The one past-the-cap rule (G141f2): an element that is not exact and has confirmed digits gets "unchecked" (a warn it
 * already has is kept). An exact element stays as it is, and so does a no-digit one, which stays "no digit confirmed"
 * (G23), as ⚠ unchecked would show its wrong digits. An element with no count (null) gets the warn, so it never reads ≈.
 * The element it warns is marked `pastCap` (G182, F178), for the why line.
 */
export function uncheckedPastCap<F extends { exact: boolean; reliableDigits: number | null; warn?: PrecisionWarn; pastCap?: true }>(f: F): F {
  if (f.exact || (f.reliableDigits !== null && f.reliableDigits <= 0)) return f;
  // G182: the warn this sets is `pastCap` (two evaluations were compared), not an evaluation that ran once
  return f.warn ? f : { ...f, warn: "unchecked", pastCap: true };
}
