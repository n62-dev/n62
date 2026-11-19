// SPDX-License-Identifier: GPL-3.0-or-later
// R747: a constant on an app's line (Solve, Function) goes in as its value, never as a `\const` chip: an app stores its
// line as text and parses it without the line's chip table, so a chip there could not be valued (docs/04 3.6). Plain
// data and two pure rules, so the controller (in the start chunk) takes them at no cost.

/** Where the entry line is: Home and CAS (chips welcome), an app's expression line (Symb), or an app's number line (Num). */
export type LineKind = "home" | "expr" | "num";

/** A chip's macro in a line's LaTeX (`\const{..}`, `\res{..}`, `\ans`). */
export const hasChipLatex = (latex: string): boolean => /\\(?:const|res|ans)(?![A-Za-z])/.test(latex);

const DECIMAL = /^([+-]?\d+(?:\.\d+)?)(?:[eE]([+-]?\d+))?$/;

/** A constant's value as an app's line takes it, every digit as the chip holds it. On an expression line one term: with an
 *  exponent it is bracketed (`\left(6.6743\times10^{-11}\right)`); on a number line (Num) it is the number as the exponent
 *  key types it (`6.6743\emark-11`), which the line reads as a plain number. A value that is no plain decimal (a user key's
 *  own text) goes in as written, bracketed on an expression line. */
export function constValueLatex(value: string, kind: "expr" | "num"): string {
  const v = value.trim();
  const m = DECIMAL.exec(v);
  if (!m) return kind === "expr" ? `\\left(${v}\\right)` : v;
  const mant = m[1] as string;
  const exp = m[2] === undefined ? undefined : String(Number(m[2]));
  if (exp === undefined || exp === "0") return mant;
  return kind === "num" ? `${mant}\\emark${exp}` : `\\left(${mant}\\times10^{${exp}}\\right)`;
}
