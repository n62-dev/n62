// SPDX-License-Identifier: GPL-3.0-or-later
// R904: the "Copied" notice names the text that went on the clipboard, not the row's drawing (R832 named the drawing, so
// a 40-digit copy read as 12 digits). A long copy shows its start on one line: a number (with a unit or none) cut after as
// many significant digits as the row draws (R832's look), its digit count in front; any other text cut at NAMED_MAX characters.

/** The most characters of a copied text the notice names; the whole is on the clipboard. */
export const NAMED_MAX = 24;

/** The notice's two forms: the whole text (or a cut that is not a number's digits), and a number's start with its count. */
export interface NoticeWords {
  /** "Copied: {what}" */
  what: string;
  /** "Copied {n} digits: {what}" */
  digits: string;
}

export interface NoticeOptions {
  /** The digit groups as the row draws them (R55, R125); none: the text as it is (an input, an exact form). */
  group?: (s: string) => string;
  /** The significant digits the row draws (the shown text's); none: as many as fit. */
  drawnDigits?: number;
  /** The decimal mark is the comma (R57). */
  decimalComma?: boolean;
}

interface NumberParts {
  sign: string;
  int: string;
  frac: string | undefined;
  exp: string;
  rest: string;
}

/** After the number, only a unit (` km`, ` °C`): a fraction, a complex or a ` ± σ` holds more digits than the count would say. */
const UNIT_TAIL = /^ [\p{L}°]/u;

/** A text that is one plain real (`-0.333…`, `6.02E23`), with a unit or not (`72 km`), as its parts; else null. */
function numberParts(text: string, decimalComma: boolean): NumberParts | null {
  const mark = decimalComma ? "," : "\\.";
  const m = new RegExp(`^(-?)(\\d+)(?:${mark}(\\d+))?(E[-+]?\\d+)?(.*)$`, "s").exec(text);
  const rest = m?.[5] ?? "";
  if (!m || (rest !== "" && !UNIT_TAIL.test(rest))) return null;
  return { sign: m[1] ?? "", int: m[2] ?? "", frac: m[3], exp: m[4] ?? "", rest };
}

/** The significant digits of a number (its leading zeros dropped; a zero counts one). */
function significant(p: NumberParts): number {
  return (p.int + (p.frac ?? "")).replace(/^0+/, "").length || 1;
}

/** The significant digits of a shown text's leading number (either decimal mark), or undefined when it does not start with one. */
export function drawnDigits(shown: string): number | undefined {
  const m = /^-?(\d[\d.,]*)/.exec(flat(shown));
  return m?.[1] ? m[1].replace(/\D/g, "").replace(/^0+/, "").length || 1 : undefined;
}

/** The number's mantissa cut after `k` significant digits (the point kept only when a fraction digit is kept). */
function cutDigits(p: NumberParts, k: number, mark: string): string {
  let seen = 0;
  let int = "";
  for (const d of p.int) {
    if (seen >= k) return int;
    int += d;
    if (seen > 0 || d !== "0") seen++;
  }
  let frac = "";
  for (const d of p.frac ?? "") {
    if (seen >= k) break;
    frac += d;
    if (seen > 0 || d !== "0") seen++;
  }
  return frac ? `${int}${mark}${frac}` : int;
}

const flat = (s: string): string => s.replace(/[ \t\r\n]+/g, " ").trim(); // (not \s: the thin space of the digit groups stays)
const chars = (s: string): string[] => [...s];

/** The notice for a copy of `copied`: the whole text when it fits one line, else its start (a number's first digits, the count in front). */
export function copiedNotice(copied: string, words: NoticeWords, o: NoticeOptions = {}): string {
  const group = o.group ?? ((s: string) => s);
  const text = flat(copied);
  const whole = group(text);
  if (chars(whole).length <= NAMED_MAX) return words.what.replace("{what}", whole);
  const p = numberParts(text, o.decimalComma === true);
  if (p) {
    const n = significant(p);
    const mark = o.decimalComma ? "," : ".";
    const head = (k: number): string => group(`${p.sign}${cutDigits(p, k, mark)}${k < n ? "…" : ""}${p.exp}`);
    let k = Math.min(o.drawnDigits ?? n, n, NAMED_MAX); // no more digits fit the line (a 10⁵-digit Exact copy stays linear)
    while (k > 1 && chars(head(k)).length > NAMED_MAX) k--;
    if (k < n) {
      const shown = head(k) + group(p.rest);
      const cut = chars(shown).length > NAMED_MAX ? `${chars(shown).slice(0, NAMED_MAX).join("").trimEnd()}…` : shown;
      return words.digits.replace("{n}", String(n)).replace("{what}", cut);
    }
  }
  return words.what.replace("{what}", `${chars(whole).slice(0, NAMED_MAX).join("").trimEnd()}…`);
}
