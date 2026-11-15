// SPDX-License-Identifier: GPL-3.0-or-later
// G54: our replacements for Giac functions, by the name the user writes. One map for the parser (input/emit.ts) and for
// every path that sends Giac text without the parser (the library import and its `// test:` lines, the export back).
// No UI imports; only erasable TypeScript syntax.
import { closing, isProgramWord, leadingName, mapNames, names, outerGroups, topLevelArgs, topLevelOps, trailingName, walk, withoutStrings, type Quoting } from "./giacPrint.ts";
import { isStandIn } from "./standIns.ts";

/** Giac's own `mod` is the modular-number constructor (an error as a call); Find's `mod` is irem (Euclidean,
 *  never negative: irem(-7,3) = 2), so the written word is renamed to our pasmod (homeEval.ts ENGINE_DEFINITIONS:
 *  irem for integers, and the same remainder for a rational, where irem is an error). G42: median and percentile are ours
 *  too (the median of an even list, percentile unevaluated in Giac; `median` is a reserved word there); G155: so is sem. */
export const CALL_NAME: Readonly<Record<string, string>> = { mod: "pasmod", irem: "pasmod", median: "pasmedian", percentile: "paspercentile", sem: "passem" };

/** The word the export writes back for our name (`irem` and `mod` are the same function; `mod` is the written one). */
const WRITTEN_NAME: Readonly<Record<string, string>> = { pasmod: "mod", pasmedian: "median", paspercentile: "percentile", passem: "sem" };

/** Renames the calls `name(` in Giac text by `map`: whole names, calls only (a name not followed by an opening bracket,
 *  or part of a longer name or a `.name`, stays), outside strings. */
function renameCalls(text: string, map: Readonly<Record<string, string>>, q: Quoting): string {
  const digit = (c: string): boolean => c >= "0" && c <= "9";
  return mapNames(text, ({ name, at, call }) => {
    if (!call || !Object.hasOwn(map, name)) return null;
    const before = text.charAt(at - 1);
    // After a number the product sign goes in (2median(L) → 2*pasmedian(L)): the verifier's smoke runs read `2pasatan(1)` as
    // 2*pi/4 either way, so this is for clarity, not a Giac need (G145)
    const afterNumber = digit(before) || (before === "." && digit(text.charAt(at - 2)));
    if (before === "." && !afterNumber) return null;
    return (afterNumber ? "*" : "") + map[name]!;
  }, q);
}

/** Giac text with the user's `mod`, `irem`, `median`, `percentile` and `sem` calls read as our definitions, as the parser does. */
export function renameOurCalls(text: string): string {
  return renameCalls(text, CALL_NAME, "typed");
}

/** The inverse, for the export: `pasmedian(` is written `median(`, so a file reads the same on the way back in. It reads
 *  the log's commands, typed (G105f2: a variable's value too, giacPrint.ts typedFromPrinted). */
export function writeUserNames(text: string): string {
  return renameCalls(text, WRITTEN_NAME, "typed");
}

/** G377: the relation an == test and a ≠ test keep as their text (`kept` of equalityBlock). */
export const TEST_REL = { eq: "==", ne: "!=" } as const;

/**
 * R18f1: the value test `a == b` (`negate`: `a ≠ b`) as Giac text; `kept` (`A==B`, the sides as shown) is what it
 * stays when undecided. Written by the parser (input/emit.ts equalityTest) and by the library import (readTests); read
 * back by the export (writeTests), so this text is the one shape of the block. The rules: emit.ts equalityTest.
 */
/** G377: how every block starts (its two sides' parameters); writeTests finds a block by it. */
const BLOCK_OPENER = "((a_,b_)->";

export function equalityBlock(a: string, b: string, negate: boolean, kept: string): string {
  const [yes, no] = negate ? ["false", "true"] : ["true", "false"];
  const k = `'${kept}'`;
  const big = (v: string): string => `max(abs(evalf(${v},30)))`;
  const float = "string(exact(d_))!=string(d_)";
  const test =
    `{if(${float}){sto(1,${EQ_INEXACT_FLAG});sto(d_,${EQ_DIFF})};` +
    `when(${float},when(${EQ_VERDICT}==0,${yes},when(${EQ_VERDICT}==1,${no},${k})),` +
    `when(simplify(d_)==0*d_,${yes},when(lname(d_)==[] and (type(d_)==integer or type(d_)==rational or ` +
    `${big("d_")}>10^-20*max(${big("a_")},${big("b_")})),${no},${k})))}`;
  return `${BLOCK_OPENER}((d_)->${test})(a_-b_))(${a},${b})`;
}

/** G377: equalityBlock's fixed text around its slots, read from the block itself: the head up to the first `kept`,
 *  the part between the two, and the tail from the second up to the sides' `(`. */
const blockShape = (negate: boolean): { head: string; mid: string; tail: string } => {
  const slot = (c: string): string => `\u0000${c}`;
  const [head = "", mid = "", rest = ""] = equalityBlock(slot("a"), slot("b"), negate, slot("k")).split(slot("k"));
  return { head, mid, tail: rest.slice(0, rest.indexOf(slot("a"))) };
};
let shapes: ({ negate: boolean } & ReturnType<typeof blockShape>)[] | undefined;
/** Both shapes, made at first use (the names they hold are declared below). */
const SHAPES = (): NonNullable<typeof shapes> => (shapes ??= [false, true].map((negate) => ({ negate, ...blockShape(negate) })));

/** The block that starts at `at` in `text`, if one does: where it ends and what it keeps. */
function blockAt(text: string, at: number): { end: number; kept: string } | null {
  for (const { negate, head, mid, tail } of SHAPES()) {
    if (!text.startsWith(head, at)) continue;
    const from = at + head.length;
    const to = text.indexOf(mid, from);
    if (to < 0) continue;
    const kept = text.slice(from, to);
    const open = to + mid.length + kept.length + tail.length - 1;
    if (!text.startsWith(kept + tail, to + mid.length)) continue;
    const close = closing(text, open, "typed");
    const sides = close < 0 ? [] : topLevelArgs(text.slice(open + 1, close), "typed");
    if (sides.length === 2 && equalityBlock(sides[0]!, sides[1]!, negate, kept) === text.slice(at, close + 1)) return { end: close + 1, kept };
  }
  return null;
}

/**
 * G377: the inverse of the import's readTests, for the export: each == or ≠ block in a log's command written back as
 * the test it keeps (`x==(5/10^1)`, `x!=1/3`), so a file holds no name of ours and reads the same on the way back in.
 * Innermost first (a test inside a side is written before the one around it). The kept text is bracketed where an
 * operator beside it would bind tighter than `==` (the parser's own blocks stand in a bracket, an argument or a
 * definition's right side).
 */
export function writeTests(text: string): string {
  const starts: number[] = [];
  walk(text, 0, (k) => void (text.startsWith(BLOCK_OPENER, k) && starts.push(k)), "typed");
  let out = text;
  for (const at of starts.reverse()) {
    const b = blockAt(out, at);
    if (!b) continue;
    const before = out.slice(0, at).trimEnd();
    const after = out.slice(b.end).trimStart();
    const open = before === "" || OPEN_ENDS.some((e) => before.endsWith(e)) || LOGIC_WORDS.has(trailingName(before));
    const shut = after === "" || SHUT_STARTS.some((e) => after.startsWith(e)) || LOGIC_WORDS.has(leadingName(after, false) ?? "");
    out = out.slice(0, at) + (open && shut ? b.kept : `(${b.kept})`) + out.slice(b.end);
  }
  return out;
}

/** G377: what a kept test may stand right after, or right before, without a bracket (a logic word too). */
const OPEN_ENDS = ["(", "[", "{", ",", ";", ":=", "->"];
const SHUT_STARTS = [")", "]", "}", ",", ";"];

/** G377: what ends a test's side in typed text (a separator) and the relations beside which a test is not one alone.
 *  `not` binds tighter than `==` in Giac (`not 1==2` is false), so it is part of a side. */
const TEST_SEPARATORS = [":=", "->", "&&", "||", ",", ";"];
const RELATIONS = ["==", "!=", "<>", "<=", ">=", "=<", "=>", "<", ">", "="];
const LOGIC_WORDS: ReadonlySet<string> = new Set(["and", "or", "xor"]);
const TESTS: Readonly<Record<string, boolean>> = { "==": false, "!=": true, "<>": true };

/** Each test that stands alone between two separators of `s` (and not as a piecewise condition, `keep`) as `make` of its
 *  sides; the rest of `s` as written, its brackets read the same way. */
function markTests(s: string, make: (a: string, b: string, negate: boolean) => string, keep = false): string {
  const ops = topLevelOps(s, [...TEST_SEPARATORS, ...RELATIONS], LOGIC_WORDS);
  let out = "";
  let from = 0;
  for (const sep of [...ops.filter((o) => !RELATIONS.includes(o.op)), { at: s.length, op: "" }]) {
    const seg = s.slice(from, sep.at);
    const rels = ops.filter((o) => RELATIONS.includes(o.op) && o.at >= from && o.at < sep.at);
    const r = rels.length === 1 && !keep ? rels[0]! : undefined;
    const [a, b] = r ? [s.slice(from, r.at), s.slice(r.at + r.op.length, sep.at)] : ["", ""];
    if (r && Object.hasOwn(TESTS, r.op) && a.trim() && b.trim()) {
      out += a.slice(0, a.length - a.trimStart().length) + make(a.trim(), b.trim(), TESTS[r.op]!) + b.slice(b.trimEnd().length);
    } else out += groupsIn(seg, make);
    out += sep.op;
    from = sep.at + sep.op.length;
  }
  return out;
}

/** `seg` with the tests in each of its outer brackets made (markTests); a piecewise condition keeps Giac's own ==, as
 *  the parser writes one (input/emit.ts Piecewise). */
function groupsIn(seg: string, make: (a: string, b: string, negate: boolean) => string): string {
  let out = "";
  let i = 0;
  for (const { open, close, caller } of outerGroups(seg, "typed")) {
    const inner = seg.slice(open + 1, close);
    const args = caller === "piecewise" ? topLevelArgs(inner, "typed") : null;
    const done = args ? args.map((x, n) => markTests(x, make, n % 2 === 0 && n < args.length - 1)).join(",") : markTests(inner, make);
    out += seg.slice(i, open + 1) + done + seg.charAt(close);
    i = close + 1;
  }
  return out + seg.slice(i);
}

/** The pseudo name a test stands as while readTests puts the rest of a body through `giac` (no user writes `pas`):
 *  TEST_MARK, its number, then `_`. */
const TEST_MARK = "pastest";
/** The number of a TEST_MARK name, or -1. */
function markNumber(name: string): number {
  const k = name.startsWith(TEST_MARK) && name.endsWith("_") ? name.slice(TEST_MARK.length, -1) : "";
  return k !== "" && [...k].every((c) => c >= "0" && c <= "9") ? Number(k) : -1;
}
/** What makes a body a program, outside strings: braces, a `;`, a Giac quote. */
const PROGRAM_MARKS = ["{", ";", "'"];

/**
 * G377: a library body's tests (`A==B`, `A!=B`, `A<>B`, each alone between separators) as the parser writes a typed
 * one (equalityBlock), its sides and the rest of the body put through `giac` (the import's asGiac), the kept text with
 * our call names only (no angle factor: it is shown). A program (braces, `;`, a program word, a Giac quote) keeps
 * Giac's own ==, as the format says; so does a piecewise condition. A body without a test is `giac` of it, unchanged.
 */
export function readTests(text: string, giac: (t: string) => string): string {
  const words = [...names(text, "typed")].map((n) => n.name);
  const bare = withoutStrings(text, "", "typed");
  if (PROGRAM_MARKS.some((c) => bare.includes(c)) || words.some((w) => isProgramWord(w) && !LOGIC_WORDS.has(w))) return giac(text);
  const blocks: string[] = [];
  const marked = markTests(text, (a, b, negate) => {
    const kept = `${renameOurCalls(a)}${negate ? TEST_REL.ne : TEST_REL.eq}${renameOurCalls(b)}`;
    blocks.push(equalityBlock(readTests(a, giac), readTests(b, giac), negate, kept));
    return `${TEST_MARK}${blocks.length - 1}_`;
  });
  if (!blocks.length) return giac(text);
  return mapNames(giac(marked), ({ name }) => {
    const n = markNumber(name);
    return n >= 0 && n < blocks.length ? blocks[n]! : null;
  }, "typed");
}

/** Set to 1 by an == or ≠ test that met a float (input/emit.ts equalityTest). Purged, not set to 0, before an input
 *  runs: `sto` inside the test's function would read a value as the place to store to. EQ_DIFF is purged with it for
 *  the same reason. G145: the one home of these names and CHIP_PREFIX (the parser, the engine host and the state read import them). */
export const EQ_INEXACT_FLAG = "pasinexact";
/** R18f2: where a float-side test leaves its difference (0 equal, 1 not, 2 open is the verdict it reads). */
export const EQ_DIFF = "pasdiff";
export const EQ_VERDICT = "pasverdict";
/** The prefix of a result chip sent by name (G49's `pasr_<k>`, input/chip-giac.ts; engine/chipFacts.ts). */
export const CHIP_PREFIX = "pasr_";
/** The prefix of a constant sent by name (G26's `pasc_<id>`, R40: input/chip-giac.ts; engine/constUnc.ts). */
export const CONST_PREFIX = "pasc_";
/** The part after CHIP_PREFIX that names Ans's chip (`pasr_ans`); a result chip's is its row number k. */
export const CHIP_ANS = "ans";

/** R115: whether `name` is a chip name the parser writes (input/chip-giac.ts chipName): CHIP_PREFIX then digits, or
 *  CHIP_ANS. The unit view's `pasupm(value,sigma,key)` takes no other key. */
export function isChipName(name: string): boolean {
  if (!name.startsWith(CHIP_PREFIX)) return false;
  const k = name.slice(CHIP_PREFIX.length);
  return k === CHIP_ANS || (k !== "" && [...k].every((c) => c >= "0" && c <= "9"));
}

/** G303 (F205): the bound name of the state read's maps and Solve's residual. Giac binds a parameter, a `local` and an
 *  arrow's parameter on the symbol itself for the time of the call, so a value that holds the free symbol of that name
 *  is read through the binding: a bound `k` answered `k` for the user's stored k, which was then purged. Every name our
 *  Giac text binds is therefore written `pas<name>_` (the definitions in homeEval.ts, complex.ts, icdf.ts, eseries.ts,
 *  polyvec.ts, matrixType.ts, units/evaluate.ts): no parser table gives such a name (`e_`, `i_`, `beta_`… are the
 *  parser's own, engine/standIns.ts), the parser refuses a typed trailing `_` (`expected subscript`), a library
 *  may not define one (library.ts), and the state read takes the `pas` prefix for ours. statenames.test.ts checks
 *  each definition with Giac's own tree (bridge-2's `bound`). */
export const OUR_BOUND = "pask_";

/** G341 (F210): every name N62's Giac text defines, stores or binds starts with this (the user's names never do: the
 *  parser refuses a typed one, input/parse.ts; the library reader too, library.ts; the state read takes one for ours,
 *  stateRead.ts isOurs). A helper added later can take any such name without meeting a name a user stored. */
export const OUR_PREFIX = "pas";
/** CAS's answer slot (host.ts), the one stored name of ours outside OUR_PREFIX (step 1 of G341: a typed call reached it). */
export const CAS_ANS = "pcasans";
/** G341: the names our Giac text defines that do not start with OUR_PREFIX, by kind: the functions a user calls by
 *  their name (homeEval.ts ENGINE_DEFINITIONS, eseries), the Giac names icdf.ts replaces by ours (ICDF_REPLACED; their
 *  meaning is ours too), and CAS_ANS. A user may call these; ourNames.test.ts fails on a new name outside both. */
export const OUR_OTHER_NAMES: readonly string[] = [
  "sigfig", "par", "linreg", "stats1", "linterp", "shl", "shr", "rotl", "rotr", "bnot", "eseries",
  "normald_icdf", "student_icdf", "chisquare_icdf", "fisher_icdf", "normal_icdf", "erf", "erfc",
  "student_cdf", "studentd_cdf", "chisquare_cdf", "chisquared_cdf", "normald_cdf", "normal_cdf", "UTPN",
  CAS_ANS,
];

/** G341: a name the user may not write (the parser and the library reader refuse it): one that starts with OUR_PREFIX
 *  (lower case: `Pas` and `spas` are the user's), and CAS_ANS. */
export function isOurName(name: string): boolean {
  return name.startsWith(OUR_PREFIX) || name === CAS_ANS;
}

/** R281: a name the user may not give a value or a definition (a store after ▶, the library reader): isOurName, one of
 *  OUR_OTHER_NAMES (`sigfig:=7` would replace our definition, and the state read hides it as ours), and a name that ends
 *  in `_` other than the parser's stand-ins (`beta_`, `e_`: G311, the user's names). The one test for both. */
export function isOwnName(name: string): boolean {
  return isOurName(name) || OUR_OTHER_NAMES.includes(name) || (name.endsWith("_") && !isStandIn(name));
}

/** G100: the names our own test helper stores into (input/emit.ts equalityTest: the float flag, the difference and
 *  the verdict): a store into one is not the user's. */
export const OUR_STORES: readonly string[] = [EQ_INEXACT_FLAG, EQ_DIFF, EQ_VERDICT];

/** A store target that is one of our helpers' names, not the user's state. */
export function isOurStore(name: string): boolean {
  return OUR_STORES.includes(name);
}
