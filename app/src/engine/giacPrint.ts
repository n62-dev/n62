// SPDX-License-Identifier: GPL-3.0-or-later
// G105 (P20): the one reader of Giac text. The bridge (bridge.ts) answers names, stores, settings and a value's kind;
// what is left to read as text is here: Giac's print for display and copy, and the input text of a few checks that
// run before Giac sees it. One string skip, one bracket walk, one name pattern; nothing else in src/engine reads
// brackets or names out of Giac text. Synchronous, UI-free, no engine; only erasable TypeScript syntax.
// R264: the string skip, the walk, the name pattern and the few reads the start chunk needs are giacPrintStart.ts, this
// file's own part, re-exported here; the start imports that file, the rest imports this one.
import { balanced, CLOSERS, isName, mapNames, NAME, names, OPENERS, RATIONAL, stringEnd, UNCLOSED, walk, withoutStrings, type Quoting } from "./giacPrintStart.ts";
export { balanced, isName, mapNames, NAME, names, RATIONAL, stringEnd, UNCLOSED, walk, withoutStrings, type Quoting };

/**
 * G105f2: a value as Giac printed it, as typed text (the log's commands are all typed). Only strings differ: a doubled
 * quote reads the same in both quotings (`d:=("x""y")` has size 3), and a string with a `\` becomes a join with
 * char(92), since Giac's lexer refuses a typed string ending in two backslashes before a bracket (`b:=("C:\\")` gives
 * undef; `b:=(["C:"+char(92),1])` holds C:\, probe 2026-10-25).
 */
export function typedFromPrinted(text: string): string {
  let out = "";
  let i = 0;
  for (let k = text.indexOf('"'); k >= 0; k = text.indexOf('"', i)) {
    let end = stringEnd(text, k, "printed");
    while (end >= 0 && text.charAt(end + 1) === '"') end = stringEnd(text, end + 1, "printed");
    if (end < 0) break;
    const str = text.slice(k, end + 1);
    const [first, ...rest] = str.slice(1, -1).split("\\");
    out += text.slice(i, k) + (rest.length ? `("${first}"${rest.map((p) => "+char(92)" + (p ? `+"${p}"` : "")).join("")})` : str);
    i = end + 1;
  }
  return out + text.slice(i);
}

/** Index of the bracket that closes the one at `open` (`(`, `[` or `{`), skipping strings; -1 when there is none. */
export function closing(s: string, open: number, q: Quoting): number {
  return Math.max(-1, walk(s, open, (_k, d, ch) => d === 0 && CLOSERS.includes(ch), q));
}

/** Index of the bracket that opens the one closing at `close`, walking back over a text without strings; -1. */
export function opening(s: string, close: number): number {
  let depth = 0;
  for (let k = close; k >= 0; k--) {
    const ch = s.charAt(k);
    if (CLOSERS.includes(ch)) depth++;
    else if (OPENERS.includes(ch) && --depth === 0) return k;
  }
  return -1;
}

/** The top-level comma-separated parts of an argument list (an unclosed string runs to the end). */
export function topLevelArgs(s: string, q: Quoting): string[] {
  const out: string[] = [];
  let start = 0;
  walk(s, 0, (k, d, ch) => {
    if (ch === "," && d === 0) {
      out.push(s.slice(start, k));
      start = k + 1;
    }
  }, q);
  out.push(s.slice(start));
  return out;
}

/** No bracket stays open (a closer too many is allowed): a block of lines read so far may end here. */
export function noneOpen(s: string, q: Quoting): boolean {
  let last = 0;
  walk(s, 0, (_k, d) => void (last = d), q);
  return last <= 0;
}

/** The elements of a bracketed Giac list as printed (`[a,b]`, or `list[a,b]`, Giac's list type), top level only; null
 *  otherwise. */
export function splitList(text: string): string[] | null {
  const t = text.trim();
  const body = t.startsWith(LIST_TYPE) ? t.slice(4) : t;
  if (!body.startsWith("[") || !body.endsWith("]")) return null;
  const inner = body.slice(1, -1);
  if (inner.trim() === "") return [];
  const parts: string[] = [];
  let start = 0;
  let last = 0;
  const end = walk(inner, 0, (k, d, ch) => {
    last = d;
    if (d < 0) return true;
    if (ch === "," && d === 0) {
      parts.push(inner.slice(start, k).trim());
      start = k + 1;
    }
  }, "printed");
  if (end !== -1 || last !== 0) return null;
  parts.push(inner.slice(start).trim());
  return parts;
}

// --- Giac's list type (G109) -----------------------------------------------------------------------------------------

/** How Giac prints a value of its list type (`list[1,4]`, subtype 23; a `[ ]` vector is 0): the print says the
 *  subtype, so bridge-3's text and the state read's give it with no extra call. A solve result is one too. */
export const LIST_TYPE = "list[";

// --- Giac's matrix type (G130) ---------------------------------------------------------------------------------------

/** How Giac prints a value of its matrix subtype (11: matrix(2,3), zeros, idn, tran, a matrix times one). Bridge-3's
 *  kind says "matrix" for a `[[…]]` vector too and carries no subtype (api.cc kindOf; adding it needs an engine rebuild),
 *  so the print is the one place that says it, as `list[` does for the list type. */
export const MATRIX_TYPE = "matrix[";

/** `text` (Giac's print) is one value of the matrix type as a whole: `matrix[` opens it and its bracket closes at the
 *  end (not `matrix[[1]]*x`, nor a vector whose element is one). */
export function matrixTyped(text: string): boolean {
  return text.startsWith(MATRIX_TYPE) && closing(text, MATRIX_TYPE.length - 1, "printed") === text.length - 1;
}

/** G225f2: a value's printed text is a list (`[…]`, a matrix's rows too, `list[…]` or `matrix[…]`). A text test: it routes, Giac's values decide. */
export function holdsList(text: string): boolean {
  return text.startsWith("[") || text.startsWith(LIST_TYPE) || text.startsWith(MATRIX_TYPE);
}

/** `text` (Giac's print) holds a value of the matrix type, at any depth, outside strings (not `mymatrix[1]`). */
export function holdsMatrixType(text: string): boolean {
  if (!text.includes(MATRIX_TYPE)) return false;
  return walk(text, 0, (k) => text.startsWith(MATRIX_TYPE, k) && !isNameChar(text.charAt(k - 1)) && text.charAt(k - 1) !== ".", "printed") >= 0;
}

/** G173: `text` (Giac's print) is one value of the matrix type and no other stands inside it. */
export function onlyMatrixType(text: string): boolean {
  return matrixTyped(text) && text.lastIndexOf(MATRIX_TYPE) === 0;
}

/** G173: the one element of the list or vector `text` (Giac's print) when that element is a matrix, its rows vectors, and
 *  whether `text` is of Giac's list type; null for any other value. */
export function soleMatrix(text: string): { matrix: string; list: boolean } | null {
  const parts = text.includes("[[") ? splitList(text) : null;
  const rows = parts?.length === 1 ? splitList(parts[0]!) : null;
  return rows?.length && rows.every((r) => r.startsWith("[")) ? { matrix: parts![0]!, list: text.startsWith(LIST_TYPE) } : null;
}

/** Giac's print with every value of its list type written with braces, as the G2 shows a list (`list[[1,2],3]` →
 *  `{[1,2],3}`, `[list[1,2],3]` → `[{1,2},3]`), at any depth; strings and a name that ends in `list` are left alone.
 *  Bridge-3 gives the kind and the flat elements but no print in braces, and a list inside a vector needs the nesting. */
export function bracesOf(text: string): string {
  // where each list type opens (its `list[`) and where its `]` closes it
  const cuts = new Map<number, [number, string]>();
  walk(text, 0, (k) => {
    const b = text.charAt(k - 1);
    if (!text.startsWith(LIST_TYPE, k) || isNameChar(b) || b === ".") return;
    const close = closing(text, k + LIST_TYPE.length - 1, "printed");
    if (close < 0) return;
    cuts.set(k, [LIST_TYPE.length, "{"]);
    cuts.set(close, [1, "}"]);
  }, "printed");
  return withCuts(text, cuts);
}

// --- Giac's when (G173) ----------------------------------------------------------------------------------------------

/** Giac's print of a conditional, C's `((c)? a : b)`, written as the call `when(c,a,b)` our entry line reads, nested
 *  and inside larger answers; for the text shown and copied only (Ans keeps Giac's value, and Giac reads its own print back). */
export function whenCalls(text: string): string {
  if (!text.includes(")? ")) return text;
  let out = "";
  let i = 0;
  walk(text, 0, (k, _d, ch) => {
    if (k < i || ch !== "(" || text.charAt(k + 1) !== "(") return;
    const c = closing(text, k + 1, "printed");
    const end = closing(text, k, "printed");
    if (c < 0 || end < 0 || !text.startsWith("? ", c + 1)) return;
    // the branches' colon: at the conditional's own depth, with a space on each side (a `:=` inside a branch has none)
    const sep = walk(text, c + 3, (j, d, x) => d === 0 && x === ":" && text.charAt(j - 1) === " " && text.charAt(j + 1) === " ", "printed");
    if (sep < 0 || sep > end) return;
    const [cond, yes, no] = [text.slice(k + 2, c), text.slice(c + 3, sep - 1), text.slice(sep + 2, end)];
    out += `${text.slice(i, k)}when(${whenCalls(cond)},${whenCalls(yes)},${whenCalls(no)})`;
    i = end + 1;
  }, "printed");
  return out + text.slice(i);
}

/** `text` (Giac's print) may be a sequence: `seq[…]` (no or one element) or elements at the top level (`1,-1`). The caller
 *  asks the value's kind (a sequence is the only value printed so). */
export function printsSequence(text: string): boolean {
  return text.startsWith("seq[") || topLevelArgs(text, "printed").length > 1;
}

/** R80f1: the inverse of bracesOf: every brace pair outside strings written as Giac's `list[…]` again
 *  (`{Ci(1),Ci(2)}` → `list[Ci(1),Ci(2)]`), so a value the CAS view shows in braces reads back as the list it came from,
 *  not as a set. `listTypeOf(bracesOf(x)) === x` for every print without a brace of its own. */
export function listTypeOf(shown: string): string {
  const cuts = new Map<number, [number, string]>();
  walk(shown, 0, (k, _d, ch) => {
    if (ch !== "{") return;
    const close = closing(shown, k, "printed");
    if (close < 0) return;
    cuts.set(k, [1, LIST_TYPE]);
    cuts.set(close, [1, "]"]);
  }, "printed");
  return withCuts(shown, cuts);
}

/** `text` with each cut (at its index: the length it replaces, the text it puts there) applied. */
function withCuts(text: string, cuts: ReadonlyMap<number, readonly [number, string]>): string {
  let out = "";
  let i = 0;
  for (const k of [...cuts.keys()].sort((x, y) => x - y)) {
    const [len, put] = cuts.get(k)!;
    out += text.slice(i, k) + put;
    i = k + len;
  }
  return out + text.slice(i);
}

// --- a printed value as a tree -------------------------------------------------------------------------------------

/** A node of Giac's printed list: its raw text, and its elements (a list) or its value (a string). */
export interface PrintedNode {
  raw: string;
  items?: PrintedNode[];
  str?: string;
}

/** Parses Giac's printed value: lists `[…]`, strings `"…"` (a quote inside is doubled) and atoms. Null when it does not
 *  parse. */
export function parsePrinted(text: string): PrintedNode | null {
  let i = 0;
  // the next quote from `from` (a string's end or a doubled quote; an atom skips a string inside it)
  const nextQuote = (from: number): number => text.indexOf('"', from);
  const node = (): PrintedNode | null => {
    while (text[i] === " " || text[i] === "\n") i++;
    const start = i;
    if (text[i] === "[") {
      i++;
      const items: PrintedNode[] = [];
      while (text[i] === " " || text[i] === "\n") i++;
      if (text[i] === "]") {
        i++;
        return { raw: text.slice(start, i), items };
      }
      for (;;) {
        const n = node();
        if (!n) return null;
        items.push(n);
        while (text[i] === " " || text[i] === "\n") i++;
        if (text[i] === ",") i++;
        else if (text[i] === "]") {
          i++;
          return { raw: text.slice(start, i), items };
        } else return null;
      }
    }
    if (text[i] === '"') {
      let s = "";
      i++;
      for (;;) {
        if (i >= text.length) return null;
        // G104: a slice up to the next quote (a 600 kB print char by char took longer than Giac printing it)
        const q = nextQuote(i);
        if (q < 0) return null;
        s += text.slice(i, q);
        i = q;
        if (text[i + 1] === '"') {
          s += '"';
          i += 2;
          continue;
        }
        i++;
        return { raw: text.slice(start, i), str: s };
      }
    }
    // An atom: up to the next , or ] outside brackets and quotes.
    const end = walk(text, i, (_k, d, c) => d < 0 || (c === "," && d === 0), "printed");
    if (end === UNCLOSED) return null;
    i = end < 0 ? text.length : end;
    const raw = text.slice(start, i).trim();
    return raw ? { raw } : null;
  };
  const out = node();
  return out && text.slice(i).trim() === "" ? out : null;
}

// --- names ----------------------------------------------------------------------------------------------------------

/** G53: Giac's language keywords that functionsIn finds in a printed program (`if (`, `while (`): like a built-in, none
 *  can hold a value, so each prints the same all session. Every entry is checked to refuse both `k:=3` and `k(x):=x`
 *  in precision.test.ts ("G53: every KEYWORDS entry refuses a value"). `return` is left out: Giac reads
 *  `return(x):=x` as `return(x:=x)` without an error, so it is asked like a user's name. */
export const KEYWORDS: ReadonlySet<string> = new Set([
  "if", "while", "throw", "and", "or", "xor", "local", "else", "elif", "then", "try", "catch", "break", "continue",
  "repeat", "until", "switch", "case", "default", "do", "from", "to", "step", "in",
]);

/** G223f1: the words Giac's printer writes in a program that no user's name can be: KEYWORDS, `for` (a built-in) and
 *  `return` (Giac reads `return(x):=x` as return(x:=x), so it never holds a definition). A program's body is read for
 *  the names it uses (complexReads); none of these is one, and Giac asked a bare `local`, `else` or `then` gives a parse
 *  error (`undef`), which ended the whole input as a syntax error. A function, not a Set spread from KEYWORDS: the
 *  bundler keeps a module-level spread in the start chunk (giacPrint.ts is in it), +0.10 kB gzip (R91 pin). */
export const isProgramWord = (w: string): boolean => KEYWORDS.has(w) || w === "for" || w === "return";

/** `c` (one character) can be part of a name. */
export function isNameChar(c: string): boolean {
  return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || (c >= "0" && c <= "9") || c === "_";
}

/** The name `s` starts with (after spaces), a user's name (letter first) unless `letterFirst` is false; null when
 *  there is none. */
export function leadingName(s: string, letterFirst = true): string | null {
  const m = LEADING_NAME.exec(s);
  return m && isName(m[1]!, letterFirst) ? m[1]! : null;
}
const LEADING_NAME = new RegExp(`^\\s*(${NAME})`);

/** Every word of `text` that looks like a name, in strings and number literals too (`2e5` gives e5): reads over. */
export function wordsOf(text: string): string[] {
  return [...new Set(text.match(ANY_NAME) ?? [])];
}
const ANY_NAME = new RegExp(NAME, "g");

/** The first name of `set` in `s` (called or not; strings skipped), or null. */
export function firstNameIn(s: string, set: ReadonlySet<string>, q: Quoting): string | null {
  for (const n of names(s, q)) if (set.has(n.name)) return n.name;
  return null;
}

/** The calls in `s` (of `only` when given), in order: name, where it starts, its `(` and its `)` (-1 when it does not
 *  close). */
export function callsOf(s: string, only: ReadonlySet<string> | readonly string[] | undefined, q: Quoting): { name: string; at: number; open: number; close: number }[] {
  const want = only === undefined ? null : new Set(only);
  const out: { name: string; at: number; open: number; close: number }[] = [];
  for (const n of names(s, q)) {
    if (!n.call || (want && !want.has(n.name))) continue;
    out.push({ name: n.name, at: n.at, open: n.open, close: closing(s, n.open, q) });
  }
  return out;
}

/** `text` with the name of every call of a key of `to` replaced by its value (`erf(` → `paserf(`). */
export function renameCalls(text: string, to: Readonly<Record<string, string>>, q: Quoting): string {
  return mapNames(text, (n) => (n.call && Object.hasOwn(to, n.name) ? to[n.name]! : null), q);
}

/** `text` with every name that is a key of `to` (called or not; not after a `.`) replaced by its value. */
export function renameNames(text: string, to: ReadonlyMap<string, string>, q: Quoting): string {
  return mapNames(text, (n) => (text.charAt(n.at - 1) !== "." ? (to.get(n.name) ?? null) : null), q);
}

/** `text` with every number literal (`12`, `2.5`, `.5`, `1e-3`, `1.2E5`; not inside a name, `x1`, `0x1F`, nor a
 *  string) replaced by `f` of its mantissa and exponent part (`e-3`, or undefined) where `f` gives a text. G117: `..`
 *  is Giac's range operator, so a number ends before it and one starts right after it (`1.5..3` is 1.5 and 3). */
export function mapNumbers(text: string, f: (mant: string, exp: string | undefined) => string | null, q: Quoting): string {
  let out = "";
  let i = 0;
  for (const n of numbers(text, q)) {
    const to = f(n.mant, n.exp);
    if (to === null) continue;
    out += text.slice(i, n.at) + to;
    i = n.end;
  }
  return out + text.slice(i);
}

/** Every number literal of `text` as mapNumbers reads them, in order: its mantissa, exponent part, start and end. */
export function* numbers(text: string, q: Quoting): Generator<{ mant: string; exp: string | undefined; at: number; end: number }> {
  const t = withoutStrings(text, (x) => " ".repeat(x.length), q);
  const re = new RegExp(`${NAME}|(\\d+\\.(?!\\.)\\d*|(?<!\\.)\\.\\d+|\\d+)([eE][+-]?\\d+)?`, "g");
  for (let m = re.exec(t); m; m = re.exec(t)) {
    if (m[1] !== undefined) yield { mant: m[1], exp: m[2], at: m.index, end: m.index + m[0].length };
  }
}

/** Every place `lit` stands in `text` as a whole literal (no name character, `.` or `^` before it, no name character
 *  or `.` after it), replaced by `by`. */
export function replaceLiteral(text: string, lit: string, by: string): string {
  let out = "";
  let i = 0;
  for (let k = text.indexOf(lit); k >= 0; k = text.indexOf(lit, k + 1)) {
    const b = text.charAt(k - 1);
    const a = text.charAt(k + lit.length);
    if (k < i || isNameChar(b) || b === "." || b === "^" || isNameChar(a) || a === ".") continue;
    out += text.slice(i, k) + by;
    i = k + lit.length;
  }
  return out + text.slice(i);
}

/** Names called in a Giac text (`romberg(exp(-x^2),x,0,1)` → romberg, exp). Strings are skipped (as `q` writes them). */
export function functionsIn(input: string, q: Quoting): string[] {
  const out: string[] = [];
  for (const n of names(input, q)) if (n.call && !out.includes(n.name)) out.push(n.name);
  return out;
}

/** Names in a Giac text that are not called (`B*2+f(x)` → B, x). Strings are skipped (as `q` writes them). */
export function namesIn(input: string, q: Quoting): string[] {
  const out: string[] = [];
  for (const n of names(input, q)) if (!n.call && !out.includes(n.name)) out.push(n.name);
  return out;
}

/** The arguments of `text` when all of it is one call of `name` (`purge(a,b)` → ["a", "b"]); null otherwise. */
export function wholeCall(text: string, name: string, q: Quoting): string[] | null {
  const t = text.trim();
  const c = callsOf(t, [name], q)[0];
  if (!c || c.at !== 0 || c.close !== t.length - 1) return null;
  const open = c.open;
  return topLevelArgs(t.slice(open + 1, -1), q).map((a) => a.trim());
}

/** The text after `name:=` when `text` starts with it (spaces allowed around `name`), or null. */
export function afterStore(text: string, name: string): string | null {
  const t = text.trimStart();
  if (!t.startsWith(name)) return null;
  const rest = t.slice(name.length).trimStart();
  return rest.startsWith(":=") && rest.length > 2 ? rest.slice(2) : null;
}

/** The name `text` defines (`f(x):=…`, `a:=…`, the name first; `_` may lead), or null. */
export function definedName(text: string): string | null {
  const m = LEADING_NAME.exec(text);
  if (!m) return null;
  const rest = text.slice(m[0].length).trimStart();
  return rest.startsWith("(") || rest.startsWith(":=") ? m[1]! : null;
}

/** The parameters of a program as Giac prints it (`(x,y)->…` → x, y), when they hold no `(`; `bare`: `x->…` too;
 *  null for another text. */
export function programParams(text: string, bare = false): string[] | null {
  const t = text.trimStart();
  if (!t.startsWith("(")) {
    const n = bare ? leadingName(t, false) : null;
    return n !== null && t.slice(n.length).trimStart().startsWith("->") ? [n] : null;
  }
  const close = closing(t, 0, "printed");
  if (close < 0 || t.slice(1, close).includes("(") || !t.slice(close + 1).trimStart().startsWith("->")) return null;
  return t.slice(1, close).split(",").map((p) => p.trim());
}

// --- shared reads of an evaluation's text (G145: one home) -------------------------------------------------------------

/** The text is Giac's error output (the worker's `GIAC_ERROR` prefix). */
export function isError(out: string): boolean {
  return out.startsWith("GIAC_ERROR");
}

/** The error is an interrupt: the time or step budget ran out. */
export function isTimeout(out: string): boolean {
  return isError(out) && /interrupt/i.test(out);
}
