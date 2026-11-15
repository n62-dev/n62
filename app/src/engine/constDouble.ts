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

/** Below this log10 a double is no longer normal: a sum that is 0 in double has operands this small (an underflow), not a
 *  cancellation. */
const TINY_LOG10 = -300;

/**
 * G363 fix round 2: log10 |a| of a constant expression (constantDouble's), read past the double's range where the value
 * leaves it: a product adds, a quotient subtracts, a power of an integer literal n multiplies by n (0 for a base of
 * exactly 1 or for n = 0, never NaN), sqrt halves, abs and a sign keep, exp and ln go through log10 e, and a sum of two
 * operands that underflow is bounded by the larger. `(sin(1)^5000)^-2` is 750, where the double of its base is 0. Any
 * other value the double cannot hold counts as Infinity (a start past the cap: ⚠, never ≈). A value 0 in double where
 * its operands are normal (`(1-1)`, `sin(0)`) is no magnitude (NaN, as 0^n), and so is a value that is not constant or
 * not real.
 */
export function constantLog10(a: Arith): number {
  // first, as 1^Infinity is NaN in double
  const e = a.op === "^" ? integerLiteral(a.b) : null;
  if (a.op === "^" && e) {
    const l = constantLog10(a.a);
    return Number.isNaN(l) ? NaN : e.n === 0 || l === 0 ? 0 : e.n * l;
  }
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
      const l = constantLog10(a.arg);
      if (Number.isNaN(l)) return NaN;
      const x = constantDouble(a.arg);
      if (a.name === "sqrt") return l / 2;
      if (a.name === "abs") return l;
      if (a.name === "exp") return Number.isFinite(x) ? x * Math.LOG10E : x;
      if ((a.name === "ln" || a.name === "log") && Number.isFinite(l)) return Math.log10(Math.abs(l / Math.LOG10E));
      if (a.name === "log10" && Number.isFinite(l)) return Math.log10(Math.abs(l));
      // a zero of a normal argument is a zero; past the range, a tiny or a huge value of unknown size
      return d === 0 ? (Number.isFinite(l) && l > TINY_LOG10 ? NaN : -Infinity) : Infinity;
    }
    default:
      return inRange ? Math.log10(Math.abs(d)) : d === 0 ? NaN : Infinity;
  }
}
