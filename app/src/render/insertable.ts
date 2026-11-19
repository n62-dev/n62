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
    } else if (s[i] === "{" || s[i] === "(" || s[i] === "[") depth++; // R746: a vector's elements are inside it
    else if (s[i] === "}" || s[i] === ")" || s[i] === "]") depth--;
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

