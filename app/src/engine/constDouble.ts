// SPDX-License-Identifier: GPL-3.0-or-later
// G363 (night review 2026-11-14, be-3): one double evaluation of a constant expression, for literalPrec.ts, which reads a
// power of a constant base with an integer literal exponent as a magnitude: `sin(1)^5000` is 1.6E-375, so the agreement
// check must start past 375 digits. The value is a bound for a digit count, never shown. A constant expression holds
// numbers, pi and euler_gamma (no user's name can hold a value under them), the four operations, `^` and calls of one
// argument of the elementary functions below; any other name (a free or stored one, `pasdeg`, whose value follows the
// angle mode, a chip, `i`) or a value that is no finite real gives NaN. Pure; only erasable TypeScript syntax.

const CONSTANTS: Readonly<Record<string, number>> = { pi: Math.PI, euler_gamma: 0.5772156649015329 };

/** Giac's names (`log` is ln) of the functions read, each of one real argument. */
const FUNCTIONS: Readonly<Record<string, (x: number) => number>> = {
  sqrt: Math.sqrt, exp: Math.exp, ln: Math.log, log: Math.log, log10: Math.log10, abs: Math.abs,
  sin: Math.sin, cos: Math.cos, tan: Math.tan, csc: (x) => 1 / Math.sin(x), sec: (x) => 1 / Math.cos(x), cot: (x) => 1 / Math.tan(x),
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, asinh: Math.asinh, acosh: Math.acosh, atanh: Math.atanh,
};

const NUMBER = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;
const NAME = /^[A-Za-z_][A-Za-z_0-9]*/;

/** The double value of `text` when it is a constant expression (above), else NaN. */
export function constantDouble(text: string): number {
  let k = 0;
  const skip = (): void => {
    while (text.charAt(k) === " ") k++;
  };
  const eat = (c: string): boolean => {
    skip();
    if (text.charAt(k) !== c) return false;
    k++;
    return true;
  };
  const sum = (): number => {
    let v = product();
    for (;;) {
      if (eat("+")) v += product();
      else if (eat("-")) v -= product();
      else return v;
    }
  };
  const product = (): number => {
    let v = unary();
    for (;;) {
      if (eat("*")) v *= unary();
      else if (eat("/")) v /= unary();
      else return v;
    }
  };
  const unary = (): number => (eat("-") ? -unary() : eat("+") ? unary() : power());
  // Giac's ^ is right-associative and binds tighter than a sign before it: -2^2 is -4, 2^-2 is 1/4
  const power = (): number => {
    const b = atom();
    return eat("^") ? Math.pow(b, unary()) : b;
  };
  const atom = (): number => {
    skip();
    if (eat("(")) {
      const v = sum();
      return eat(")") ? v : NaN;
    }
    const rest = text.slice(k);
    const num = NUMBER.exec(rest);
    if (num) {
      k += num[0].length;
      return Number(num[0]);
    }
    const name = NAME.exec(rest);
    if (!name) return NaN;
    k += name[0].length;
    const n = name[0];
    if (eat("(")) {
      const f = Object.hasOwn(FUNCTIONS, n) ? FUNCTIONS[n]! : null;
      const v = sum();
      return f && eat(")") ? f(v) : NaN;
    }
    return Object.hasOwn(CONSTANTS, n) ? CONSTANTS[n]! : NaN;
  };
  const v = sum();
  skip();
  return k === text.length && Number.isFinite(v) ? v : NaN;
}
