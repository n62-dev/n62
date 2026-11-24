// SPDX-License-Identifier: GPL-3.0-or-later
// R925 (F379): in the unit view, `×10ⁿ` or `·10ⁿ` right after a number, n a signed whole number, is part of that number,
// as an ᴇ mark is: one quantity with one unit slot after the power, read as the ᴇ form (6.62607015×10⁻³⁴ is 6.62607015ᴇ-34).
// The slot reader (unitFormula.ts numberEnd) and the parser's units mode (parse.ts) read the same span from here. Plain TS.
import type { Json } from "./emit.ts";
import type { Tok } from "./tokenize.ts";

/** The span in LaTeX: `\times` or `\cdot`, 10, `^`, then a braced signed whole number or one bare digit. */
export const TEN_POWER = /^\s*\\(?:times|cdot)(?![A-Za-z])\s*10\s*\^\s*(?:\{\s*[-+]?\s*\d+\s*\}|\d(?![\d.]))/;

const isCh = (t: Tok | undefined, v: string): boolean => t?.t === "ch" && t.v === v;

/** The span in tokens at `k`: its exponent ("-34") and its token count, or null. */
export function tenPowerAt(toks: readonly Tok[], k: number): { exp: string; len: number } | null {
  const op = toks[k];
  if (op?.t !== "cmd" || (op.v !== "times" && op.v !== "cdot")) return null;
  const ten = toks[k + 1];
  if (ten?.t !== "num" || ten.v !== "10" || !isCh(toks[k + 2], "^")) return null;
  const bare = toks[k + 3];
  if (bare?.t === "num") return /^\d$/.test(bare.v) ? { exp: bare.v, len: 4 } : null;
  if (!isCh(bare, "{")) return null;
  let j = k + 4;
  const sign = isCh(toks[j], "-") ? "-" : "";
  if (sign || isCh(toks[j], "+")) j++;
  const n = toks[j];
  if (n?.t !== "num" || !/^\d+$/.test(n.v) || !isCh(toks[j + 1], "}")) return null;
  return { exp: sign + n.v, len: j + 2 - k };
}

/** The number `mant`·10^`exp` as the parser writes an ᴇ number (R14): `{num: "1.5e-3"}`. */
export function eLiteral(mant: string, exp: string): Json {
  const m = mant.replace(/^0+(?=\d)/, "").replace(/\.$/, "").replace(/^\./, "0.");
  const sign = exp.startsWith("-") ? "-" : "";
  return { num: `${m}e${sign}${exp.replace(/^[-+]/, "").replace(/^0+(?=\d)/, "")}` };
}
