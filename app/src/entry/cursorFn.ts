// SPDX-License-Identifier: GPL-3.0-or-later
// R196: which function the cursor is in, as a Find id (find/functions.yaml: `fn:<Giac command>`, `tmpl:<name>`), for
// the Help key's sheet (R197, docs/06: context help from the Find index). A question on the entry's LaTeX alone: no
// field, no index. The id is a candidate: the caller looks it up in the index (finder.ts FindIndex.byId) and opens Find
// when it is not there. Lazy with the entry; outside the start chunk. Plain TS.
//
// A function holds the cursor from right after the start of its name to right before the end of its bracket: on the
// name, in its scripts (a log's base, lim's, Σ's and Π's bounds) and in its bracket. Before the name or after the
// closing bracket the cursor is outside. Nested functions: the innermost one wins. A chip (`\res`, `\ans`, `\const`,
// `\unit`, `\pfx`, input/chips.ts) is one atom the cursor cannot enter: an offset inside one gives null, and what a
// chip shows (a history result's `\sin…`) is never read as a function.
// What it reads as a function, by the LaTeX a key or Find puts on the line: FUNCS' commands, `\operatorname{…}`, and the
// templates of find/where.yaml `links` (each slot checked by cursorFn.test.ts against that file and find/functions.yaml).
import { FUNCS, GREEK } from "../input/parseTables.ts";
import { isInfixWord } from "./boxes.ts";
import { CHIP_MACROS } from "./macros.ts";

/** The parser's function commands whose Find id is not `fn:<command>` (Giac's names, find/functions.yaml). */
const ID_OF: Readonly<Record<string, string>> = {
  arcsin: "fn:asin", arccos: "fn:acos", arctan: "fn:atan", log: "fn:log10", lg: "fn:log10", Re: "fn:re", Im: "fn:im",
};
/** The operators whose bounds are their scripts and whose body is the bracket after them (boxes.ts BIGOP but ∫). */
const BIG_OP: Readonly<Record<string, string>> = { lim: "fn:limit", sum: "fn:sum", prod: "fn:product" };
/** The argument count of the chip macro `cmd` (entry/macros.ts CHIP_MACROS), or undefined: no chip. */
const chipArgs = (cmd: string): number | undefined => (Object.hasOwn(CHIP_MACROS, cmd) ? CHIP_MACROS[cmd as keyof typeof CHIP_MACROS].args : undefined);
const PLACEHOLDER = "\\placeholder";

/** A span of the line: `start` before its first character, `end` after its last. */
interface Span {
  start: number;
  end: number;
}
interface Call extends Span {
  id: string;
}

/** The end of the command at `i` (a backslash): after its letters, or after its one non-letter. */
function commandEnd(s: string, i: number): number {
  let j = i + 1;
  while (j < s.length && /[A-Za-z]/.test(s[j] as string)) j++;
  return j === i + 1 ? Math.min(i + 2, s.length) : j;
}

/** The end of the group that opens at `i` (`{` or `[`), after its closer; escaped braces do not count. -1: unclosed. */
function groupEnd(s: string, i: number): number {
  const close = s[i] === "[" ? "]" : "}";
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === "\\") j++;
    else if (c === "{") depth++;
    else if (c === "}") {
      if (--depth === 0 && close === "}") return j + 1;
    } else if (c === "]" && close === "]" && depth === 0) return j + 1;
  }
  return -1;
}

/** The end of one argument at `i`: a group, a command (`\placeholder{}` with its group) or one character. */
function argEnd(s: string, i: number): number {
  if (s[i] === "{") return groupEnd(s, i);
  if (s[i] === "\\") {
    const e = commandEnd(s, i);
    return s.startsWith(PLACEHOLDER, i) && e === i + PLACEHOLDER.length && s[e] === "{" ? groupEnd(s, e) : e;
  }
  return i < s.length ? i + 1 : -1;
}

const isLeft = (s: string, i: number): boolean => s.startsWith("\\left", i) && !/[A-Za-z]/.test(s[i + 5] ?? "");
const isRight = (s: string, i: number): boolean => s.startsWith("\\right", i) && !/[A-Za-z]/.test(s[i + 6] ?? "");

/** The end of the `\left…\right…` pair at `i`, after its closing delimiter; -1 when it does not close. */
function pairEnd(s: string, i: number): number {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] !== "\\") continue;
    if (isLeft(s, j)) depth++;
    else if (isRight(s, j) && --depth === 0) return argEnd(s, j + 6);
    j = commandEnd(s, j) - 1;
  }
  return -1;
}

/** The end of the `\begin{env}` at `i`, after its `\end{env}` (the same environment inside it counted); -1: unclosed. */
function envEnd(s: string, i: number, env: string): number {
  const open = `\\begin{${env}}`;
  const close = `\\end{${env}}`;
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s.startsWith(open, j)) depth++;
    else if (s.startsWith(close, j) && --depth === 0) return j + close.length;
  }
  return -1;
}

const DIFF = "\\mathrm{d}";
const isInt = (s: string, j: number): boolean => s.startsWith("\\int", j) && commandEnd(s, j) === j + 4;

/**
 * After ∫'s variable at `j` (boxes.ts bigOp: the one atom after d, □ or a letter), or `j` when there is none. Its box
 * ends on the line with nothing to close it, so the position right after the variable is still in it.
 */
function variableEnd(s: string, j: number): number {
  if (/[A-Za-z]/.test(s[j] ?? "")) return j + 1;
  if (s[j] !== "\\") return j;
  const e = commandEnd(s, j);
  return s.startsWith(PLACEHOLDER, j) || Object.hasOwn(GREEK, s.slice(j + 1, e)) ? argEnd(s, j) : j;
}

/**
 * The end of the ∫ whose integrand starts at `h` (after its scripts): after the variable that follows its d (boxes.ts
 * diffOf: the first d on its level that no ∫ inside the integrand takes) and one more, as its variable's box holds
 * the position right after it; -1 when the integrand's box ends first.
 */
function intEnd(s: string, h: number): number {
  let open = 0;
  for (let j = h; j < s.length; ) {
    const c = s[j];
    if (c === "}" || c === "&") return -1; // the end of the box the ∫ stands in
    if (c === "{") {
      j = groupEnd(s, j);
      if (j < 0) return -1;
    } else if (c !== "\\") j++;
    else if (isRight(s, j) || s.startsWith("\\end", j) || s[j + 1] === "\\") return -1;
    else if (isLeft(s, j) || s.startsWith("\\begin{", j)) {
      j = isLeft(s, j) ? pairEnd(s, j) : envEnd(s, j, s.slice(j + 7, groupEnd(s, j + 6) - 1));
      if (j < 0) return -1;
    } else if (s.startsWith(DIFF, j)) {
      j += DIFF.length;
      if (open-- === 0) return variableEnd(s, j) + 1;
    } else {
      if (isInt(s, j)) open++;
      j = commandEnd(s, j);
    }
  }
  return -1;
}

/** After a name at `i`: past its scripts (`_…`, `^…`), each one argument. */
function scriptsEnd(s: string, i: number): number {
  let j = i;
  while (s[j] === "_" || s[j] === "^") {
    const e = argEnd(s, j + 1);
    if (e < 0) return j;
    j = e;
  }
  return j;
}

/**
 * The name in `\operatorname{…}`'s group (with or without `\mathrm{…}` around it), or undefined. An underscore is
 * written `\_` there (find/functions.yaml: `normald_cdf`).
 */
function operatorName(group: string): string | undefined {
  const m = /^(?:\\mathrm\{([A-Za-z](?:[A-Za-z0-9]|\\_)*)\}|([A-Za-z](?:[A-Za-z0-9]|\\_)*))$/.exec(group);
  return (m?.[1] ?? m?.[2])?.replace(/\\_/g, "_");
}

/** Every call on the line and every chip, in order of their start. */
function scan(s: string): { calls: Call[]; chips: Span[] } {
  const calls: Call[] = [];
  const chips: Span[] = [];
  /** The call named from `start` to `head` (its scripts included), with its bracket if one follows. */
  const named = (id: string, start: number, head: number): void => {
    const p = isLeft(s, head) ? pairEnd(s, head) : -1;
    // a name with no bracket after it still holds the cursor right after it (on the name)
    calls.push({ id, start, end: p > 0 ? p : head + 1 });
  };
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== "\\") continue;
    const e = commandEnd(s, i);
    const cmd = s.slice(i + 1, e);
    const args = chipArgs(cmd);
    if (args !== undefined) {
      // a chip: one atom, its arguments are never read
      let j = e;
      for (let k = 0; k < args && j >= 0; k++) j = s[j] === "{" ? groupEnd(s, j) : -1;
      const end = j < 0 ? s.length : j;
      chips.push({ start: i, end });
      i = end - 1;
      continue;
    }
    if (cmd === "operatorname" && s[e] === "{") {
      const g = groupEnd(s, e);
      const name = g < 0 ? undefined : operatorName(s.slice(e + 1, g - 1));
      if (name !== undefined && !isInfixWord(s.slice(i, g))) named(`fn:${/^[A-Z]+$/.test(name) ? name.toLowerCase() : name}`, i, scriptsEnd(s, g));
      if (g > 0) i = g - 1;
      continue;
    }
    if (Object.hasOwn(FUNCS, cmd) || Object.hasOwn(BIG_OP, cmd)) {
      // a log with a base (boxes.ts LOG_BASE): the base is its first box
      const id = (cmd === "log" || cmd === "ln") && s[e] === "_" ? "fn:logb" : (BIG_OP[cmd] ?? ID_OF[cmd] ?? `fn:${cmd}`);
      named(id, i, scriptsEnd(s, e));
    } else if (cmd === "sqrt") {
      let j = e;
      let index: string | undefined;
      if (s[j] === "[") {
        const k = groupEnd(s, j);
        if (k < 0) continue;
        index = s.slice(j + 1, k - 1);
        j = k;
      }
      const k = argEnd(s, j);
      if (k > 0) calls.push({ id: index === undefined ? "fn:sqrt" : index === "3" ? "tmpl:cbrt" : "fn:surd", start: i, end: k });
    } else if (cmd === "int") {
      // ∫ (find/where.yaml): its bounds, its integrand, its d and the variable after it
      const h = scriptsEnd(s, e);
      const k = intEnd(s, h);
      calls.push({ id: "fn:int", start: i, end: k > 0 ? k : h + 1 });
    } else if (cmd === "exponentialE" && s[e] === "^") {
      // eˣ (Shift + ln, find/where.yaml): e with its exponent
      calls.push({ id: "fn:exp", start: i, end: scriptsEnd(s, e) });
    } else if (cmd === "frac" && s.startsWith("{\\partial", e)) {
      // ∂ (find/where.yaml): a fraction whose parts both start with ∂ (boxes.ts)
      const g = groupEnd(s, e);
      const k = g > 0 && s.startsWith("{\\partial", g) ? groupEnd(s, g) : -1;
      if (k > 0) calls.push({ id: "fn:diff", start: i, end: k });
    } else if (cmd === "begin" && s.startsWith("{cases}", e)) {
      // piecewise (find/where.yaml): the whole table
      const k = envEnd(s, i, "cases");
      if (k > 0) calls.push({ id: "fn:piecewise", start: i, end: k });
    } else if (cmd === "left" && s[e] === "|") {
      // |x| (Shift + (−), find/where.yaml): abs, from its bar to its closing bar
      const k = pairEnd(s, i);
      if (k > 0) calls.push({ id: "fn:abs", start: i, end: k });
    } else if (cmd === "left" && s[e] === ".") {
      // evaluate-at (the subst bar, find/where.yaml): `\left.…\right|` and its subscript
      const k = pairEnd(s, i);
      if (k > 0 && s.slice(k - 7, k) === "\\right|" && s[k] === "_") calls.push({ id: "fn:subst", start: i, end: scriptsEnd(s, k) });
    }
    i = e - 1;
  }
  return { calls, chips };
}

/**
 * The Find id of the innermost function that holds `offset`, a position in `latex` (0 before its first character,
 * `latex.length` after its last), or null: outside every function, inside a chip, or off the line.
 */
export function functionAt(latex: string, offset: number): string | null {
  if (!Number.isInteger(offset) || offset < 0 || offset > latex.length) return null;
  const { calls, chips } = scan(latex);
  if (chips.some((c) => c.start < offset && offset < c.end)) return null;
  let best: Call | undefined;
  for (const c of calls) if (c.start < offset && offset < c.end && (!best || c.start > best.start)) best = c;
  return best?.id ?? null;
}
