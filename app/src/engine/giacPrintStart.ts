// SPDX-License-Identifier: GPL-3.0-or-later
// R264: the part of the one reader of Giac text (giacPrint.ts, G105, P20) that the start chunk needs: the string skip,
// the bracket walk and the name pattern, with balanced, isName, names, mapNames and RATIONAL, the names render/home.ts,
// engine/defs.ts and state/results.ts read at start. Moved here unchanged and re-exported by giacPrint.ts, which builds
// the rest on it, so the lazy chunks' share of giacPrint.ts stays out of the start chunk. Not a second reader: nothing
// here is new. Synchronous, UI-free, no engine; only erasable TypeScript syntax.

/**
 * How a string is written. "typed": Giac's language (our parser's output, a library file): `\` escapes the next
 * character, so `"a\"b"` is one string (text-9). "printed": Giac's print: a quote inside a string is doubled (`"a""b"`,
 * read as two strings side by side, which skips the same text) and `\` is itself (`g(x):="q,(\\"` prints `"q,(\"`).
 */
export type Quoting = "typed" | "printed";

/** The index of the quote that closes the string whose opening quote is at `open`; -1 when none does. */
export function stringEnd(s: string, open: number, q: Quoting): number {
  for (let k = open + 1; k < s.length; k++) {
    const c = s.charAt(k);
    if (c === '"') return k;
    if (c === "\\" && q === "typed") k++;
  }
  return -1;
}

/** `s` with every string (its quotes included; an unclosed one runs to the end) replaced by `by`, or by `by` of it. */
export function withoutStrings(s: string, by: string | ((str: string) => string), q: Quoting): string {
  let out = "";
  let i = 0;
  for (let k = s.indexOf('"'); k >= 0; k = s.indexOf('"', i)) {
    const end = stringEnd(s, k, q);
    const stop = end < 0 ? s.length : end + 1;
    out += s.slice(i, k) + (typeof by === "string" ? by : by(s.slice(k, stop)));
    i = stop;
  }
  return out + s.slice(i);
}

/** The brackets the walk counts (giacPrint.ts opening reads them too). */
export const OPENERS = "([{";
export const CLOSERS = ")]}";

/** walk's answer when a string does not close. */
export const UNCLOSED = -2;

/**
 * The one bracket walk: each character of `s` from `from` that is outside strings, in order, with the depth of the
 * brackets `(`, `[`, `{` open around it (an opener counts itself, a closer does not: `f(x)` walks f 0, ( 1, x 1, ) 0).
 * Stops where `visit` returns true and gives that index; -1 at the end; UNCLOSED at a string that does not close.
 */
export function walk(s: string, from: number, visit: (k: number, depth: number, ch: string) => boolean | void, q: Quoting): number {
  let depth = 0;
  for (let k = from; k < s.length; k++) {
    const ch = s.charAt(k);
    if (ch === '"') {
      const end = stringEnd(s, k, q);
      if (end < 0) return UNCLOSED;
      k = end;
      continue;
    }
    if (OPENERS.includes(ch)) depth++;
    else if (CLOSERS.includes(ch)) depth--;
    if (visit(k, depth, ch)) return k;
  }
  return -1;
}

/** Every bracket closes, none below depth 0, and every string closes. */
export function balanced(s: string, q: Quoting): boolean {
  let last = 0;
  const end = walk(s, 0, (_k, d) => {
    last = d;
    return d < 0;
  }, q);
  return end === -1 && last === 0;
}

/** A name as Giac's language writes one. */
export const NAME = "[A-Za-z_][A-Za-z0-9_]*";
const WHOLE_NAME = new RegExp(`^${NAME}$`);

/** `s` is one name (a user name starts with a letter: `letterFirst`). */
export function isName(s: string, letterFirst = false): boolean {
  return WHOLE_NAME.test(s) && (!letterFirst || s.charAt(0) !== "_");
}

/** Every name in `s` in order (strings and the exponents of number literals are skipped), with whether it is called
 *  (`(` follows it) and where it starts. */
export function* names(s: string, q: Quoting): Generator<{ name: string; at: number; call: boolean; open: number }> {
  const t = withoutStrings(s, (x) => " ".repeat(x.length), q);
  // Number literals first, so the exponent of 2e5 is not read as a name.
  const re = new RegExp(`(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?|(${NAME})(\\s*\\()?`, "g");
  for (let m = re.exec(t); m; m = re.exec(t)) {
    if (m[1] === undefined) continue;
    yield { name: m[1], at: m.index, call: m[2] !== undefined, open: m[2] !== undefined ? m.index + m[0].length - 1 : -1 };
  }
}

/** `text` with every name replaced by `f` of it where `f` gives a text (strings skipped). */
export function mapNames(text: string, f: (n: { name: string; at: number; call: boolean }) => string | null, q: Quoting): string {
  let out = "";
  let i = 0;
  for (const n of names(text, q)) {
    const to = f(n);
    if (to === null) continue;
    out += text.slice(i, n.at) + to;
    i = n.at + n.name.length;
  }
  return out + text.slice(i);
}

/** A printed integer or rational (`-7/3`, `12`): groups 1 and 2 are the numerator and the denominator (if any). */
export const RATIONAL = /^(-?\d+)(?:\/(\d+))?$/;
