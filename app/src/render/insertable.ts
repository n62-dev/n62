// SPDX-License-Identifier: GPL-3.0-or-later
// L5: a history result put back on the entry line. The result's display LaTeX is turned into what our
// keyboard would have typed (constants as MathLive writes them), and wrapped in brackets when it is a sum
// or difference, so that 2× then a tapped x+1 means 2(x+1), or starts with a minus (R746), so that a tapped −5/6
// then x² means (−5/6)².

/** Top-level + or − after the first character, or a leading − (outside every group and bracket). */
function hasTopLevelSum(s: string): boolean {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\") {
      // a command name (\left, \right, \frac ...); the bracket after \left( / \right) is counted below
      const at = i;
      while (i + 1 < s.length && /[A-Za-z]/.test(s[i + 1] as string)) i++;
      const name = s.slice(at + 1, i + 1);
      if (name === "begin") depth++; // R746: a matrix's cells (`\mathrm{-2} & 1`) are inside it
      else if (name === "end") depth--;
    } else if (s[i] === "{" || s[i] === "(") depth++;
    else if (s[i] === "}" || s[i] === ")") depth--;
    else if (depth === 0 && (i > 0 || s[i] === "-") && (s[i] === "+" || s[i] === "-")) return true; // 10^{-7}: inside braces
  }
  return false;
}

export function resultToEntry(latex: string): string {
  const s = latex
    .trim()
    .replace(/\\mathrm\{i\}/g, "\\imaginaryI")
    .replace(/\\mathrm\{e\}/g, "\\exponentialE")
    .replace(/\\mathrm\{(-?\d+)\}/g, "$1"); // R746: Giac's `\frac{\mathrm{-5}}{6}` is the number −5, not a name
  return hasTopLevelSum(s) ? `\\left(${s}\\right)` : s;
}

/** R746: what the exact maths drawn for a result may hold to go on the line as itself (after resultToEntry): numbers,
 *  one-letter names, π, e, i, + − · ×, brackets, fractions, roots, powers, subscripts and matrices; each read back by the
 *  parser as drawn (insertable.test.ts). Anything else (a function's name, a unit, `\mathrm{…}`) keeps the chip. */
const MATHS = /^(?:\\(?:(?:[dt]?frac|sqrt|cdot|times|pi|exponentialE|imaginaryI)(?![A-Za-z])|sqrt\[\d+\]|left\(|right\)|begin\{pmatrix\}|end\{pmatrix\}|\\)|[\dA-Za-z.+\-^_{}()& ])*$/;
/** Two letters in a row outside a command (a name of more than one letter, `\mathrm` text): no plain maths. */
const WORD = /(?:^|[^\\A-Za-z])[A-Za-z]{2}/;
/** A fraction, a root, a power or a matrix: maths a chip would draw as one box the cursor cannot enter. */
const STRUCTURED = /\\(?:[dt]?frac|sqrt|begin)(?![A-Za-z])|\^/;
/** A number right before a fraction: a mixed number (Home's a b/c form `2\frac{5}{6}`), which the line reads as 2·5/6. */
const MIXED = /\d\s*\\[dt]?frac(?![A-Za-z])/;

/**
 * R746: an exact result's drawn LaTeX (`shown`, its text the exact value) as the line's maths, the caret free to enter it
 * (docs/04 2.8), or undefined when it stays a chip: no fraction, root, power or matrix in it (an integer, a name), a
 * mixed number, or anything outside MATHS. A leading minus or a sum comes bracketed (resultToEntry); the × beside it is
 * the line's (entry/oneTerm.ts).
 */
export function exactMaths(shown: string): string | undefined {
  if (!STRUCTURED.test(shown) || MIXED.test(shown)) return undefined;
  const s = resultToEntry(shown);
  return MATHS.test(s) && !WORD.test(s.replace(/\\(?:begin|end)\{pmatrix\}/g, "")) ? s : undefined;
}
