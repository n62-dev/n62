// SPDX-License-Identifier: GPL-3.0-or-later
// G363 (night review 2026-11-14, be-3): the magnitude of a constant expression, for literalPrec.ts, which reads a power of
// a constant base with an integer literal exponent as a magnitude: `sin(1)^5000` is 1.6E-375, so the agreement check must
// start past 375 digits. The value is a bound for a digit count, never shown. A constant expression holds numbers, pi and
// euler_gamma (no user's name can hold a value under them), the four operations, `^` and calls of one argument of the
// elementary functions below; any other name (a free or stored one, `pasdeg`, whose value follows the angle mode, a chip,
// `i`) or a value that is no real gives NaN. The text is read by giacPrint's arithmeticOf (G105: the one reader of Giac
// text); this file only evaluates its tree. Pure; only erasable TypeScript syntax.
import { integerLiteral, type Arith } from "./giacPrint.ts";

const CONSTANTS: Readonly<Record<string, number>> = { pi: Math.PI, euler_gamma: 0.5772156649015329 };

/** Giac's names (`log` is ln) of the functions read, each of one real argument. */
const FUNCTIONS: Readonly<Record<string, (x: number) => number>> = {
  sqrt: Math.sqrt, exp: Math.exp, ln: Math.log, log: Math.log, log10: Math.log10, abs: Math.abs,
  sin: Math.sin, cos: Math.cos, tan: Math.tan, csc: (x) => 1 / Math.sin(x), sec: (x) => 1 / Math.cos(x), cot: (x) => 1 / Math.tan(x),
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, asinh: Math.asinh, acosh: Math.acosh, atanh: Math.atanh,
};

/** The double value of `a` (arithmeticOf's tree) when it is a constant expression (above), else NaN; out of the double's
 *  range it is 0 or ±Infinity (constantLog10 reads past it). */
export function constantDouble(a: Arith): number {
  let d = doubles.get(a);
  if (d === undefined) doubles.set(a, (d = doubleOf(a)));
  return d;
}
/** G403: constantDouble and constantLog10 of each node, once (literalPrec.ts reads every node of a tree). */
const doubles = new WeakMap<Arith, number>();
const logs = new WeakMap<Arith, number>();

function doubleOf(a: Arith): number {
  switch (a.op) {
    case "num":
      return Number(a.text);
    case "name":
      return Object.hasOwn(CONSTANTS, a.name) ? CONSTANTS[a.name]! : NaN;
    case "call":
      return Object.hasOwn(FUNCTIONS, a.name) ? FUNCTIONS[a.name]!(constantDouble(a.arg)) : NaN;
    case "neg":
      return -constantDouble(a.a);
    case "+":
      return constantDouble(a.a) + constantDouble(a.b);
    case "-":
      return constantDouble(a.a) - constantDouble(a.b);
    case "*":
      return constantDouble(a.a) * constantDouble(a.b);
    case "/":
      return constantDouble(a.a) / constantDouble(a.b);
    case "^":
      return Math.pow(constantDouble(a.a), constantDouble(a.b));
  }
}

/** The logarithms rule (b) of constantLog10 reads (`log` is ln). */
const LOGS: ReadonlySet<string> = new Set(["ln", "log", "log10"]);

/** `a` is the integer literal 1. */
const isOne = (a: Arith): boolean => a.op === "num" && a.text === "1";

/** G403: u of `1+u`, `u+1` or `1-u` when u holds more than numbers, else null. */
function besideOne(a: Arith): Arith | null {
  const u = a.op === "+" ? (isOne(a.a) ? a.b : isOne(a.b) ? a.a : null) : a.op === "-" && isOne(a.a) ? a.b : null;
  return u && !ofLiterals(u) ? u : null;
}

/** G403 fix round 2: the term 1-erf(x) of a sum Giac prints flat, `s+1-erf(x)` (its tree is (s+1)-erf(x), no node 1-erf(x))
 *  or `s-1+erf(x)` (s minus it), as a node of its own for constantLog10's rule (c); null for any other node. */
export function flatErfc(a: Arith): Arith | null {
  if ((a.op !== "-" && a.op !== "+") || a.b.op !== "call" || a.b.name !== "erf") return null;
  const s = a.a;
  return s.op === (a.op === "-" ? "+" : "-") && isOne(s.b) ? { op: "-", a: s.b, b: a.b } : null;
}

/** `a` holds numbers alone (no name, no call). */
function ofLiterals(a: Arith): boolean {
  switch (a.op) {
    case "num":
      return true;
    case "name":
    case "call":
      return false;
    case "neg":
      return ofLiterals(a.a);
    default:
      return ofLiterals(a.a) && ofLiterals(a.b);
  }
}

/** Below this log10 a double is no longer normal: a sum that is 0 in double has operands this small (an underflow), not a
 *  cancellation. */
const TINY_LOG10 = -300;

/**
 * G363 fix round 2: log10 |a| of a constant expression (constantDouble's), read past the double's range where the value
 * leaves it: a product adds, a quotient subtracts, a power of an integer literal n multiplies by n (0 for a base of
 * exactly 1 or for n = 0, never NaN), sqrt halves, abs and a sign keep, exp and ln go through log10 e, and a sum of two
 * operands that underflow is bounded by the larger. `(sin(1)^5000)^-2` is 750, where the double of its base is 0. Any
 * other value the double cannot hold counts as Infinity (a start past the cap: ⚠, never ≈). A value 0 in double where
 * its operands are normal (`(1-1)`, `sin(0)`, `ln(1)`) is no magnitude (NaN, as 0^n), and so is a value that is not
 * constant or not real. G403: three values the double cannot hold are read by their asymptotes: cosh and sinh past
 * its range, ln(1 ± u) and log10(1 ± u) where 1 ± u rounds to 1 (`ln(1+sin(1)^5000)` is about u, 1E-374.8), and
 * erfc(x) for x > 5, typed or as Giac prints it (`1-erf(x)`): exp(-x²)/(x·√π), 1E-63.9 for erfc(12).
 */
export function constantLog10(a: Arith): number {
  let l = logs.get(a);
  if (l === undefined) logs.set(a, (l = log10Of(a)));
  return l;
}

function log10Of(a: Arith): number {
  // first, as 1^Infinity is NaN in double
  const e = a.op === "^" ? integerLiteral(a.b) : null;
  if (a.op === "^" && e) {
    const l = constantLog10(a.a);
    return Number.isNaN(l) ? NaN : e.n === 0 || l === 0 ? 0 : e.n * l;
  }
  // G403 (c): erfc has no double here; its relative error at x = 5 is 2 % (0.008 in log10)
  const erfcOf = a.op === "call" && a.name === "erfc" ? a.arg : a.op === "-" && isOne(a.a) && a.b.op === "call" && a.b.name === "erf" ? a.b.arg : null;
  const xc = erfcOf ? constantDouble(erfcOf) : NaN;
  if (xc > 5) return -xc * xc * Math.LOG10E - Math.log10(xc * Math.sqrt(Math.PI));
  const d = constantDouble(a);
  if (Number.isNaN(d)) return NaN;
  const inRange = Number.isFinite(d) && d !== 0;
  switch (a.op) {
    case "neg":
      return constantLog10(a.a);
    case "*":
      return inRange ? Math.log10(Math.abs(d)) : constantLog10(a.a) + constantLog10(a.b);
    case "/":
      return inRange ? Math.log10(Math.abs(d)) : constantLog10(a.a) - constantLog10(a.b);
    case "^": {
      const l = constantLog10(a.a);
      if (inRange) return Math.log10(Math.abs(d));
      const x = constantDouble(a.b);
      return Number.isNaN(l) ? NaN : Number.isFinite(l) && Number.isFinite(x) ? x * l : d === 0 ? -Infinity : Infinity;
    }
    case "+":
    case "-": {
      if (inRange) return Math.log10(Math.abs(d));
      const m = Math.max(constantLog10(a.a), constantLog10(a.b));
      return d === 0 ? (m < TINY_LOG10 ? m : NaN) : m + Math.LOG10E * Math.LN2;
    }
    case "call": {
      if (inRange) return Math.log10(Math.abs(d));
      const x = constantDouble(a.arg);
      if (Number.isNaN(x)) return NaN;
      if (a.name === "exp") return x * Math.LOG10E;
      // G403 (a): cosh(1000) is e^1000/2 to the double's last digit, 1E434.0; only an overflow (fix round 2: sinh(0) is
      // a zero, no magnitude), and sinh of an argument the double rounds to 0 is that argument (sinh x ≈ x)
      if ((a.name === "cosh" || a.name === "sinh") && Number.isFinite(x) && !Number.isFinite(d)) return Math.abs(x) * Math.LOG10E - Math.log10(2);
      if (a.name === "sinh" && d === 0) return constantLog10(a.arg);
      // G403 (b): ln(1 + u) is u to its first digits, log10(1 + u) is u/ln(10); a u of literals alone counts by its
      // literals (G141; g186-exp-sqrt-acosh-1e-300-12 prints ln(1/10^600+1)^2, which 1200 digits would send past the cap)
      const u = d === 0 && LOGS.has(a.name) ? besideOne(a.arg) : null;
      const lu = u ? constantLog10(u) : NaN;
      if (lu < -15) return a.name === "log10" ? lu - Math.log10(Math.LN10) : lu;
      // an argument in the double's range: 0 is a zero of it (ln(1), sin(0)), no magnitude; else an overflow
      if (Number.isFinite(x) && x !== 0) return d === 0 ? NaN : Infinity;
      // the argument itself is past the range
      const l = constantLog10(a.arg);
      if (Number.isNaN(l)) return NaN;
      if (a.name === "sqrt") return l / 2;
      if (a.name === "abs") return l;
      if ((a.name === "ln" || a.name === "log") && Number.isFinite(l)) return Math.log10(Math.abs(l / Math.LOG10E));
      if (a.name === "log10" && Number.isFinite(l)) return Math.log10(Math.abs(l));
      // a tiny or a huge value of unknown size
      return d === 0 ? -Infinity : Infinity;
    }
    default:
      return inRange ? Math.log10(Math.abs(d)) : d === 0 ? NaN : Infinity;
  }
}
