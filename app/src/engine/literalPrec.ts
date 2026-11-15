// SPDX-License-Identifier: GPL-3.0-or-later
// G141 (night review 2026-10-30, be-1): the working precision a long exact literal needs. Two evaluations at P and P + 20
// agree on whatever both lose: (1+10^-100)^(10^100) is exp(10^100*ln(1+1/10^100)), and at 40 and 60 digits the 10^-100
// is rounded away, so both give 1 and the agreement check confirmed 38 digits of a value that is e. A literal of n digits
// cancels at most n, so the check starts at n + P instead, and confirms as many digits as it does without one. An
// intermediate loss with no long literal (a tiny value stored in a name) is not caught here (S20's intervals are the
// general cure). The literals are read by giacPrint's number reader. Only erasable TypeScript syntax, so Node runs this
// file directly.
import type { PrecisionWarn } from "./format.ts";
import { callsOf, isNameChar, namesIn, negated, numbers, powersIn, withoutStrings, type Quoting } from "./giacPrint.ts";
import { PERIODIC } from "./converge.ts";
import { constantDouble } from "./constDouble.ts";

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

/** G307: exp of an integer literal (`exp(200)`, `exp(-200)`, the eˣ key's form, emit.ts) is read as a magnitude, with
 *  log10 e; a power is read by constantPower. */
const EXP_POWER = { before: "exp(", gaps: ["", "-"] } as const;

/** G363: the base of every power in `text` whose exponent is an integer literal (`^200`, `^-200`, `^(200)`, `^(-200)`)
 *  and whose base is a constant expression other than an integer literal (constantDouble: `pi`, `sin(1)`,
 *  `(1/sin(1))`, `euler_gamma`; a power of two integer literals is read in literalCounts), by where its exponent's
 *  literal starts: the exponent n and log10 |b| from one double evaluation of the base. */
function constantPowers(text: string, q: Quoting): Map<number, { n: number; log10: number }> {
  const out = new Map<number, { n: number; log10: number }>();
  for (const p of powersIn(text, q)) {
    const m = /^(\s*\(?\s*(-?)\s*)(\d+)(\s*\)?\s*)$/.exec(text.slice(...p.exponent));
    if (!m || m[1]!.includes("(") !== m[4]!.includes(")") || /^\d+$/.test(p.base)) continue;
    const log10 = Math.log10(Math.abs(constantDouble(p.base)));
    if (!Number.isFinite(log10)) continue;
    out.set(p.exponent[0] + m[1]!.length, { n: Number(m[2]! + m[3]!), log10 });
  }
  return out;
}

/** The digit count ⌈|n|·|log10 b|⌉ of the power whose integer literal exponent is `mant` at `at`..`end` of `text`: exp(n)
 *  (EXP_POWER) or a power of a constant base (`powers`, constantPowers; G307 read pi^n alone); null when the literal is
 *  no such exponent. */
function constantPower(text: string, at: number, end: number, mant: string, powers: () => Map<number, { n: number; log10: number }>): number | null {
  const p = powers().get(at);
  if (p) return Math.ceil(Math.abs(p.n * p.log10));
  for (const gap of EXP_POWER.gaps) {
    const k = at - gap.length - EXP_POWER.before.length;
    const b = text.charAt(k - 1);
    if (k < 0 || !text.startsWith(EXP_POWER.before + gap, k) || isNameChar(b) || b === ".") continue;
    if (!text.startsWith(")", end)) continue;
    return Math.ceil(Number(mant) * Math.LOG10E);
  }
  return null;
}

/** G348 (Opus pass 175): the places of `text` whose value is read modulo a period, each [from, to): the brackets of a
 *  periodic call (converge.ts PERIODIC, G307f2), of an exp call whose argument names the imaginary unit `i`, and the
 *  exponent of a power whose base is negative or names `i` (its principal value exp(b·ln a), ln a not real) or whose
 *  exponent names `i` (`e^(i*x)` is exp(i*x)). Such a value needs its argument to an absolute precision: at P0 + 40
 *  pi^2200 is off by about 10^1054, so sin(pi^2200) showed ≈ 0.9 (it is 0.844846014387) and exp(i*pi^2207) ≈ -0.4-0.9*i
 *  (it is 0.423070018226+0.906096992423*i). An unclosed call runs to the end. */
function periodicPlaces(text: string, q: Quoting): [number, number][] {
  const out: [number, number][] = [];
  const namesI = (from: number, to: number): boolean => namesIn(text.slice(from, to), q).includes("i");
  for (const c of callsOf(text, [...PERIODIC, "exp"], q)) {
    const to = c.close < 0 ? text.length : c.close;
    if (c.name !== "exp" || namesI(c.open + 1, to)) out.push([c.open + 1, to]);
  }
  for (const p of powersIn(text, q)) if (negated(p.base, q) || namesIn(p.base, q).includes("i") || namesI(...p.exponent)) out.push(p.exponent);
  return out;
}

/** literalDigits, and the same count without the powers of a constant or exp (constantPower) that stand outside every place read
 *  modulo a period (periodicPlaces, G348). */
function literalCounts(text: string, q: Quoting): { digits: number; withoutHuge: number } {
  const ints = [...numbers(text, q)].filter((n) => n.exp === undefined && !n.mant.includes("."));
  let total = 0;
  let withoutHuge = 0;
  let places: [number, number][] | null = null;
  let powers: Map<number, { n: number; log10: number }> | null = null;
  const count = (d: number, constant = false): void => {
    total = Math.max(total, d);
    if (!constant) withoutHuge = Math.max(withoutHuge, d);
  };
  ints.forEach((n, k) => {
    count(noLeadingZeros(n.mant).length);
    const c = constantPower(text, n.at, n.end, n.mant, () => (powers ??= constantPowers(text, q)));
    if (c !== null) count(c, !(places ??= periodicPlaces(text, q)).some(([from, to]) => n.at >= from && n.at < to));
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
 * Whether a huge power of a constant or exp in `text` needs its digits for the value because the text can form a small value,
 * which the huge power then makes tiny (G307f1, decisions.md "G307 past the cap", Opus pass 171): a division, a negative
 * exponent (a minus after a caret, after a caret and bracket, or after exp's bracket), an inv call, or, G363, a power of
 * a constant base below 1 with a positive integer exponent or above 1 with a negative one (constantPowers: the base's
 * side of 1 from the same double evaluation; `sin(1)^20000` is 1E-1500 with no slash or minus).
 * `(1+1/(3*pi^2200))^(pi^2200)` is e^(1/3), and at P and P + 20 both round the 1/(3*pi^2200) away. A name or sign in a
 * string counts nothing. A huge power read modulo a period counts where it stands (literalCounts, G348).
 */
function formsSmall(text: string, q: Quoting): boolean {
  const s = withoutStrings(text, "", q);
  if (s.includes("/") || s.includes("^-") || s.includes("^(-")) return true;
  if (callsOf(s, ["inv", "exp"], q).some((c) => c.name === "inv" || s.charAt(c.open + 1) === "-")) return true;
  return [...constantPowers(text, q).values()].some((p) => p.n * p.log10 < 0);
}

/**
 * The digit count of the longest exact integer in `text`: an integer as Giac prints it, or, in a text as typed, a power
 * of two integer literals (`10^(-100)` stands for a 101-digit denominator); and, G307, a power of pi or exp of an integer
 * literal (`pi^(-200)` stands for a 100-digit magnitude, `exp(-200)` for an 87-digit one; Giac prints them as
 * `1/pi^200`, `1/exp(200)`), and, G363, a power of any constant base (`sin(1)^5000`, 375 digits; constantPowers).
 * 0 when there is none. Strings, other names and decimals count nothing.
 */
export function literalDigits(text: string, q: Quoting): number {
  return literalCounts(text, q).digits;
}

/**
 * Where the agreement check of `text` starts when the value precision is P (G141): at P, or, for an exact integer of n
 * digits with n + LITERAL_MARGIN > P, at n + P. When those levels pass `cap` (MAX_EVAL_DIGITS), at P, and the value is
 * `unchecked` (⚠, never ≈): a power of ten too (G141f1, Opus pass 68: `(1-cos(10^-600))*10^1200+1` is 1.5, and at P and
 * P + 20 both round the 10^-600 away; S20's intervals are the cure), and a power of pi or exp (G307,
 * `(1+pi^(-2200))^(pi^2200)`). A power of a constant (G363) or exp past the cap counts nothing in a text that forms no small value
 * (formsSmall, G307f1) when it stands outside every place read modulo a period (periodicPlaces; G307f2, G348): alone it
 * rounds no term away, and MPFR evaluates
 * exp(10000000) (`exp(10^7)` as Giac prints it) right at every level, which ≈ said before G307 (g58-exp-1e7-12). A
 * decision taken on it reads literalPastCap, which counts it.
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
