// SPDX-License-Identifier: GPL-3.0-or-later
// G141 (night review 2026-10-30, be-1): the working precision a long exact literal needs. Two evaluations at P and P + 20
// agree on whatever both lose: (1+10^-100)^(10^100) is exp(10^100*ln(1+1/10^100)), and at 40 and 60 digits the 10^-100
// is rounded away, so both give 1 and the agreement check confirmed 38 digits of a value that is e. A literal of n digits
// cancels at most n, so the check starts at n + P instead, and confirms as many digits as it does without one. G403: a
// constant subterm the double can size (constantTerms: `exp(-100*pi)`, `1/cosh(1000)`, `1-erf(12)`) counts as a literal
// that long. A tiny value stored in a name is not caught here, nor one the double cannot size (S20's intervals are the
// general cure). The literals are read by giacPrint's number reader. Only erasable TypeScript syntax, so Node runs this
// file directly.
import type { PrecisionWarn } from "./format.ts";
import { arithmeticOf, type Arith, callsOf, closing, topLevelArgs, integerLiteral, isNameChar, UNCLOSED, walk as bracketWalk, namesIn, negated, numbers, powersIn, withoutStrings, type Quoting } from "./giacPrint.ts";
import { PERIODIC } from "./names.ts";
import { constantLog10, flatErfc, type Sizes } from "./constDouble.ts";

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
 *  and whose base is a constant expression (`pi`, `sin(1)`, `(1/sin(1))`, `euler_gamma`; a
 *  power of two integer literals, read in literalCounts too, counts the same), by where its exponent's literal starts: the
 *  exponent n and log10 |b| (constantLog10, past the double's range too). Both are read by giacPrint's arithmeticOf. */
function constantPowers(text: string, q: Quoting): Map<number, { n: number; log10: number }> {
  const out = new Map<number, { n: number; log10: number }>();
  for (const p of powersIn(text, q)) {
    const e = integerLiteral(arithmeticOf(text.slice(...p.exponent), q));
    const base = e && arithmeticOf(p.base, q);
    if (!e || !base) continue;
    // G363 fix round 2: past the double's range too (constantLog10); NaN: no constant, or no magnitude (a zero)
    const log10 = constantLog10(base);
    if (!Number.isNaN(log10)) out.set(p.exponent[0] + e.at, { n: e.n, log10 });
  }
  return out;
}

/** The digit count ⌈|n|·|log10 b|⌉ of the power whose integer literal exponent is `mant` at `at`..`end` of `text`: exp(n)
 *  (EXP_POWER) or a power of a constant base (`powers`, constantPowers; G307 read pi^n alone); null when the literal is
 *  no such exponent. */
function constantPower(text: string, at: number, end: number, mant: string, powers: () => Map<number, { n: number; log10: number }>): number | null {
  const p = powers().get(at);
  // a base of exactly 1 in double is no magnitude, even to an exponent of 309 digits and more (n is Infinity), and a
  // power 0 none, so a count is never NaN (fix round 2)
  if (p) return p.log10 === 0 || p.n === 0 ? 0 : Math.ceil(Math.abs(p.n * p.log10));
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

/** G403: brackets deeper than this are not read by constantTerms (arithmeticOf recurses on each, and reads each to its
 *  close: 140 ms at 1000, a stack overflow at 3000). */
const MAX_NESTING = 200;

/** The deepest bracket nesting of `text` outside strings, by giacPrint's one bracket walk; Infinity when a string does
 *  not close (read as too deep: ⚠, literalStart). */
function nesting(text: string, q: Quoting): number {
  let max = 0;
  return bracketWalk(text, 0, (_k, d) => void (max = Math.max(max, d)), q) === UNCLOSED ? Infinity : max;
}

/** G403: the subterms t of `text` that hold a name or a call and that constantLog10 sizes (`exp(-100*pi)`, `1/cosh(1000)`,
 *  `1-erf(12)`, `ln(1+sin(1)^5000)^2`): the largest digit count ⌈|log10 t|⌉ of those in a place read modulo a period
 *  (`periodic`: the argument of a PERIODIC call or the exponent of a negative base, as periodicPlaces) and of the others
 *  (`other`), 0 for none, and whether one that is not the whole text is tiny (below 1E-LITERAL_MARGIN; G403f1: these
 *  three, not a list of every subterm, 60000 for a sum of 30000 sin(1)). One walk of arithmeticOf's tree of
 *  the whole text, or, when it is no arithmetic (a list, a call of several arguments), of each argument or element that is.
 *  `deep`: past MAX_NESTING no subterm is read, so none is known small (fix round 2: literalStart gives ⚠), nor where
 *  arithmeticOf's own recursion runs past the stack (G403f1: 10000 signs in a row, `1+-+-…1`). */
function constantTerms(text: string, q: Quoting): { periodic: number; other: number; tiny: boolean; deep: boolean } {
  const out = { periodic: 0, other: 0, tiny: false, deep: false };
  let root: Arith | null = null;
  // ±Infinity is constantLog10's "of unknown size" (asinh(10^-400)): no count
  const note = (log10: number, periodic: boolean, whole: boolean): void => {
    if (!Number.isFinite(log10)) return;
    const d = Math.ceil(Math.abs(log10));
    if (periodic) out.periodic = Math.max(out.periodic, d);
    else out.other = Math.max(out.other, d);
    if (!whole && log10 < -LITERAL_MARGIN) out.tiny = true;
  };
  // G403f1: each node's size once, its operands' read from here (a caller's Map, constDouble.ts)
  const sizes: Sizes = new Map();
  // each node of `top`, its operands before it (G403f1: an explicit stack in post-order, as a left-chained sum or product
  // of 10000 terms is 10000 nodes deep with no bracket, past MAX_NESTING's reach); `named`: whether the node holds a name
  // or a call (numbers alone are the literal rules' own)
  const walk = (top: Arith, inPeriodic: boolean): void => {
    // the nodes to read, beside each its periodic flag and whether its operands were read; `named` holds the flag of
    // each node read whose parent is not read yet, the right operand's last
    const nodes: Arith[] = [top];
    const flags: boolean[] = [inPeriodic];
    const read: boolean[] = [false];
    const named: boolean[] = [];
    const enter = (a: Arith, periodic: boolean): void => void (nodes.push(a), flags.push(periodic), read.push(false));
    while (nodes.length > 0) {
      const a = nodes.pop()!;
      const periodic = flags.pop()!;
      if (a.op === "num") {
        read.pop();
        named.push(false);
        continue;
      }
      if (!read.pop()) {
        nodes.push(a);
        flags.push(periodic);
        read.push(true);
        // the right operand entered first, so the left is read first
        if (a.op === "call") enter(a.arg, periodic || PERIODIC.has(a.name));
        else if (a.op === "neg") enter(a.a, periodic);
        else if (a.op !== "name") {
          enter(a.b, periodic || (a.op === "^" && a.a.op === "neg"));
          enter(a.a, periodic);
        }
        continue;
      }
      let isNamed = true;
      if (a.op === "call") named.pop();
      else if (a.op === "neg") isNamed = named.pop()!;
      else if (a.op !== "name") {
        const right = named.pop()!;
        isNamed = named.pop()! || right;
      }
      named.push(isNamed);
      if (isNamed) note(constantLog10(a, sizes), periodic, a === root);
      // fix round 2: Giac prints 1+erfc(50) as 1+1-erf(50), whose tree holds no node 1-erf(50)
      const erfc = flatErfc(a);
      if (erfc) note(constantLog10(erfc, sizes), periodic, false);
    }
  };
  // G403f1: arithmeticOf's own recursion (a bracket or a power chain past the stack) reads as too deep, never a throw
  const arith = (s: string): Arith | null | "deep" => {
    try {
      return arithmeticOf(s, q);
    } catch (e) {
      if (e instanceof RangeError) return "deep";
      throw e;
    }
  };
  if (nesting(text, q) > MAX_NESTING) return { ...out, deep: true };
  const whole = arith(text);
  if (whole === "deep") return { ...out, deep: true };
  if ((root = whole)) {
    walk(whole, false);
    return out;
  }
  // each argument or element of a bracket, outermost first, that no part read before holds; the brackets by giacPrint's
  // one walk (G105, as decisionArgs), strings skipped
  const opens: number[] = [];
  bracketWalk(text, 0, (k, _d, ch) => void ("([{".includes(ch) && opens.push(k)), q);
  const places = periodicPlaces(text, q);
  let covered = -1;
  for (const k of opens) {
    if (k < covered) continue;
    const close = closing(text, k, q);
    if (close < 0) continue;
    let from = k + 1;
    for (const part of topLevelArgs(text.slice(k + 1, close), q)) {
      const a = arith(text.slice(from, from + part.length));
      if (a === "deep") return { ...out, deep: true };
      if (a) {
        walk(a, places.some(([p, r]) => from >= p && from < r));
        covered = Math.max(covered, from + part.length);
      }
      from += part.length + 1;
    }
  }
  return out;
}

/** literalDigits, and the same count without the powers of a constant or exp (constantPower) that stand outside every place read
 *  modulo a period (periodicPlaces, G348). */
function literalCounts(text: string, q: Quoting): { digits: number; withoutHuge: number; decided: number; tiny: boolean; deep: boolean } {
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
  // G403: a huge or tiny constant counts as the power of a constant does (constantPower); for a decision
  // (literalPastCap) only in a place read modulo a period, so sqrt(exp(2e8)) is still decided (g58-sqrt-exp-2e8-12)
  // outside such a place only beside a tiny constant, the term a sum rounds away (`1/cosh(1000)` in `1+1/cosh(1000)`):
  // alone a huge or tiny value is right at every level (`exp(200000000*1/2)`, g58-sqrt-exp-2e8-12; `(1/2)^(1073741000+sqrt(2))`)
  const decided = total;
  const { periodic, other, tiny, deep } = constantTerms(text, q);
  count(periodic);
  if (tiny) count(other, true);
  return { digits: total, withoutHuge, decided: Math.max(decided, withoutHuge), tiny, deep };
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
  return [...constantPowers(text, q).values()].some((p) => p.n !== 0 && p.log10 !== 0 && p.n * p.log10 < 0);
}

/**
 * The digit count of the longest exact integer in `text`: an integer as Giac prints it, or, in a text as typed, a power
 * of two integer literals (`10^(-100)` stands for a 101-digit denominator); and, G307, a power of pi or exp of an integer
 * literal (`pi^(-200)` stands for a 100-digit magnitude, `exp(-200)` for an 87-digit one; Giac prints them as
 * `1/pi^200`, `1/exp(200)`), and, G363, a power of any constant base (`sin(1)^5000`, 375 digits; constantPowers), and,
 * G403, any constant subterm the double sizes (`exp(-100*pi)`, 137 digits; constantTerms). 0 when there is none. Strings, other names and decimals count nothing.
 */
export function literalDigits(text: string, q: Quoting): number {
  return literalCounts(text, q).digits;
}

/**
 * Where the agreement check of `text` starts when the value precision is P (G141): at P, or, for an exact integer of n
 * digits with n + LITERAL_MARGIN > P, at n + P. When those levels pass `cap` (MAX_EVAL_DIGITS), at P, and the value is
 * `unchecked` (⚠, never ≈): a power of ten too (G141f1, Opus pass 68: `(1-cos(10^-600))*10^1200+1` is 1.5, and at P and
 * P + 20 both round the 10^-600 away; S20's intervals are the cure), and a power of pi or exp (G307,
 * `(1+pi^(-2200))^(pi^2200)`). A power of a constant (G363), exp, or a constant subterm (G403) past the cap counts nothing in a text that forms no small value
 * (formsSmall, G307f1) when it stands outside every place read modulo a period (periodicPlaces; G307f2, G348): alone it
 * rounds no term away, and MPFR evaluates
 * exp(10000000) (`exp(10^7)` as Giac prints it) right at every level, which ≈ said before G307 (g58-exp-1e7-12). A
 * decision taken on it reads literalPastCap, which counts it.
 */
export function literalStart(text: string, P: number, cap: number, q: Quoting): { at: number; unchecked: boolean } {
  const { digits, withoutHuge, tiny, deep } = literalCounts(text, q);
  const start = (n: number): { at: number; unchecked: false } | null =>
    n + LITERAL_MARGIN <= P ? { at: P, unchecked: false } : n + P + LEVELS_ABOVE <= cap ? { at: n + P, unchecked: false } : null;
  // G403 fix round 2: a tiny subterm forms a small value with no slash or minus (Giac's 1-erf(50)), and a text too deep
  // to read may hold one
  if (deep) return { at: P, unchecked: true };
  return start(digits) ?? (tiny || formsSmall(text, q) ? null : start(withoutHuge)) ?? { at: P, unchecked: true };
}

/**
 * G307 fix round 2: `text` holds an exact magnitude that no precision we run holds, a huge power of pi or exp included
 * (the full literalDigits count, which literalStart leaves out for the value; G403's constant subterms only in a place read
 * modulo a period). The decisions read this (decideTwice): a
 * value is right at every level when alone it rounds no term away, but a sign or a branch taken on it is not, as at
 * P0 + 40 pi^2200 is off by about 10^1054 and the sign of sin(pi^2200) is a coin toss, as for sin(10^2000) (G156).
 */
export function literalPastCap(text: string, P: number, cap: number, q: Quoting): boolean {
  const n = literalCounts(text, q).decided;
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
