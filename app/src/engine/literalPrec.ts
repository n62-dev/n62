// SPDX-License-Identifier: GPL-3.0-or-later
// G141 (night review 2026-10-30, be-1): the working precision a long exact literal needs. Two evaluations at P and P + 20
// agree on whatever both lose: (1+10^-100)^(10^100) is exp(10^100*ln(1+1/10^100)), and at 40 and 60 digits the 10^-100
// is rounded away, so both give 1 and the agreement check confirmed 38 digits of a value that is e. A literal of n digits
// cancels at most n, so the check starts at n + P instead, and confirms as many digits as it does without one. An
// intermediate loss with no long literal (a tiny value stored in a name) is not caught here (S20's intervals are the
// general cure). The literals are read by giacPrint's number reader. Only erasable TypeScript syntax, so Node runs this
// file directly.
import type { PrecisionWarn } from "./format.ts";
import { callsOf, isNameChar, numbers, withoutStrings, type Quoting } from "./giacPrint.ts";

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

/** The digit count ⌈|n|·log10 c⌉ of the power of pi or exp (CONSTANT_POWERS) whose integer literal exponent is `mant` at
 *  `at`..`end` of `text`; null when the literal is no such exponent. */
function constantPower(text: string, at: number, end: number, mant: string): number | null {
  for (const c of CONSTANT_POWERS) {
    for (const gap of c.gaps) {
      const k = at - gap.length - c.before.length;
      const b = text.charAt(k - 1);
      if (k < 0 || !text.startsWith(c.before + gap, k) || isNameChar(b) || b === ".") continue;
      if ((c.closes || gap.startsWith("(")) && !text.startsWith(")", end)) continue;
      return Math.ceil(Number(mant) * c.log10);
    }
  }
  return null;
}

/** literalDigits, and the same count without the powers of pi or exp (constantPower). */
function literalCounts(text: string, q: Quoting): { digits: number; withoutHuge: number } {
  const ints = [...numbers(text, q)].filter((n) => n.exp === undefined && !n.mant.includes("."));
  let total = 0;
  let withoutHuge = 0;
  const count = (d: number, constant = false): void => {
    total = Math.max(total, d);
    if (!constant) withoutHuge = Math.max(withoutHuge, d);
  };
  ints.forEach((n, k) => {
    count(noLeadingZeros(n.mant).length);
    const c = constantPower(text, n.at, n.end, n.mant);
    if (c !== null) count(c, true);
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
 * G307f1 (decisions.md "G307 past the cap", Opus pass 171): whether `text` can form a small value, which a huge power of
 * pi or exp then makes tiny: a division, a negative exponent (a minus after a caret, after a caret and bracket, or after
 * exp's bracket) or an inv call. A `-` or `/` in a string forms nothing. `(1+1/(3*pi^2200))^(pi^2200)` is e^(1/3), and at
 * P and P + 20 both round the 1/(3*pi^2200) away.
 */
function formsSmall(text: string, q: Quoting): boolean {
  const s = withoutStrings(text, "", q);
  if (s.includes("/") || s.includes("^-") || s.includes("^(-")) return true;
  return callsOf(s, ["inv", "exp"], q).some((c) => c.name === "inv" || s.charAt(c.open + 1) === "-");
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
 * P + 20 both round the 10^-600 away; S20's intervals are the cure), and a power of pi or exp (G307,
 * `(1+pi^(-2200))^(pi^2200)`). A power of pi or exp past the cap counts nothing in a text that forms no small value
 * (formsSmall, G307f1): alone it rounds no term away, and MPFR evaluates exp(10000000) (`exp(10^7)` as Giac prints it)
 * right at every level, which ≈ said before G307 (g58-exp-1e7-12). A decision taken on it reads literalPastCap, which
 * counts it.
 */
export function literalStart(text: string, P: number, cap: number, q: Quoting): { at: number; unchecked: boolean } {
  const { digits, withoutHuge } = literalCounts(text, q);
  const start = (n: number): { at: number; unchecked: false } | null =>
    n + LITERAL_MARGIN <= P ? { at: P, unchecked: false } : n + P + LEVELS_ABOVE <= cap ? { at: n + P, unchecked: false } : null;
  return start(digits) ?? (formsSmall(text, q) ? null : start(withoutHuge)) ?? { at: P, unchecked: true };
}

/**
 * G307 fix round 2: `text` holds an exact magnitude that no precision we run holds, a huge power of pi or exp included
 * (the full literalDigits count, which literalStart leaves out for the value). The decisions read this (decideTwice): a
 * value is right at every level when alone it rounds no term away, but a sign or a branch taken on it is not, as at
 * P0 + 40 pi^2200 is off by about 10^1054 and the sign of sin(pi^2200) is a coin toss, as for sin(10^2000) (G156).
 */
export function literalPastCap(text: string, P: number, cap: number, q: Quoting): boolean {
  const n = literalDigits(text, q);
  return n + LITERAL_MARGIN > P && n + P + LEVELS_ABOVE > cap;
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
