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
import { FUNCS } from "../input/parseTables.ts";

/** The parser's function commands whose Find id is not `fn:<command>` (Giac's names, find/functions.yaml). */
const ID_OF: Readonly<Record<string, string>> = {
  arcsin: "fn:asin", arccos: "fn:acos", arctan: "fn:atan", log: "fn:log10", lg: "fn:log10", Re: "fn:re", Im: "fn:im",
};
/** The operators whose bounds are their scripts and whose body is the bracket after them (boxes.ts BIGOP but ∫). */
const BIG_OP: Readonly<Record<string, string>> = { lim: "fn:limit", sum: "fn:sum", prod: "fn:product" };
/** The chips' macros and their argument counts (entry/macros.ts CHIP_MACROS). */
const CHIP_ARGS: Readonly<Record<string, number>> = { res: 2, ans: 0, const: 2, unit: 2, pfx: 2 };
/** AND, OR and XOR stand between their operands: no call (boxes.ts INFIX, R117). */
const INFIX = new Set(["AND", "OR", "XOR"]);

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

/** The end of one argument at `i`: a group, a command or one character. */
function argEnd(s: string, i: number): number {
  if (s[i] === "{") return groupEnd(s, i);
  if (s[i] === "\\") return commandEnd(s, i);
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

/** The name in `\operatorname{…}`'s group (with or without `\mathrm{…}` around it), or undefined. */
function operatorName(group: string): string | undefined {
  const m = /^(?:\\mathrm\{([A-Za-z][A-Za-z0-9]*)\}|([A-Za-z][A-Za-z0-9]*))$/.exec(group);
  return m?.[1] ?? m?.[2];
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
    const chipArgs = CHIP_ARGS[cmd];
    if (chipArgs !== undefined) {
      // a chip: one atom, its arguments are never read
      let j = e;
      for (let k = 0; k < chipArgs && j >= 0; k++) j = s[j] === "{" ? groupEnd(s, j) : -1;
      const end = j < 0 ? s.length : j;
      chips.push({ start: i, end });
      i = end - 1;
      continue;
    }
    if (cmd === "operatorname" && s[e] === "{") {
      const g = groupEnd(s, e);
      const name = g < 0 ? undefined : operatorName(s.slice(e + 1, g - 1));
      if (name !== undefined && !INFIX.has(name)) named(`fn:${/^[A-Z]+$/.test(name) ? name.toLowerCase() : name}`, i, scriptsEnd(s, g));
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
    } else if (cmd === "left" && s[e] === "|") {
      // |x| (Shift + (−), find/where.yaml): abs, from its bar to its closing bar
      const k = pairEnd(s, i);
      if (k > 0) calls.push({ id: "fn:abs", start: i, end: k });
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
