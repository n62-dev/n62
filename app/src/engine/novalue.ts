// SPDX-License-Identifier: GPL-3.0-or-later
// G78 (backlog F50, F51; decisions.md "F50, F51", the owner 2026-10-20): Home never shows a number that went through a
// division by zero, nor Giac's text where a number was asked for and none came.
// - Giac computes in the extended reals: 1/0 is ∞ and x/∞ is 0, so 1/(1/0) and exp(ln 0) give an exact 0. A finite
//   result whose input holds a part that evaluates to an infinity is refused (throughInfinity). An infinity the user
//   typed (`inf`, a limit, an integral to ∞) is not looked for.
// - A result with no free name that is still Giac's text (asin(acos(π²)), sinh(6020³)), or a float path that gave
//   undef, is a number asked for and not found: refused "overflow" when its value is an infinity, else "no value found"
//   (lostNumber).
// - G84 (backlog F60): a value that reads as 0 while Giac's exact answer is not 0 (exp(-10^30), past MPFR's exponent
//   range) is refused "underflow", as an overflow is (underflow); G154 (F139): only when Giac can state its size.
// - G148 (vg-3, vvg-1), G148f1, G148f2: approx and evalf make Giac's answer ±infinity, undef or a float 0, at once,
//   inside a larger input too (1/approx(exp(-10^20)), ln(approx(exp(-10^20)))); the input with each call replaced by its
//   argument is refused as the bare input is, or as a call's argument is (approxRange).
// - G168 (F93): Giac's undef as the whole answer, or as an element of a Home list, is refused too: "division by zero"
//   when a part of the input divides by an exact 0, else "no value found" (undefReason); CAS asks the same of a bare undef
//   and of an answer with no free name whose evalf is no number (lostCas).
// Runs synchronously next to the engine; only erasable TypeScript syntax.
import { callsIn, type Refusal } from "./converge.ts";
import { DOUBLE_DIGITS, hasFloat, MAX_EVAL_DIGITS, withDigits, type ElementFacts, type Giac, type Shape } from "./numeric.ts";
import { callsOf, firstNameIn, functionsIn, isError, LIST_TYPE, names, parsePrinted, topLevelArgs, type PrintedNode, type Quoting, withoutStrings } from "./giacPrint.ts";
import { decimalFromString, isZero } from "./format.ts";
import type { ParseNode } from "./bridge.ts";

/** The reasons of this module; the UI shows `error.<code>` from the i18n table (enEngine.ts). */
export type NoValue = Extract<Refusal, "divisionByZero" | "overflow" | "underflow" | "noValue">;

const infinite = (t: string): boolean => /infinity/.test(t);
/** An infinity the user typed: then an infinite part is meant, not a division by zero. */
const TYPED_INF: ReadonlySet<string> = new Set(["inf", "infinity"]);
import { treeOf, UNEVALUATED, type TreeNode } from "./tree.ts";

export { UNEVALUATED };

/** Divisions by a positive integer literal or a power of ten (a typed decimal read exactly, `(981/100)`), and by the
 *  degree factor, which is never 0. */
const SAFE_DIVISION = /\/\s*(?:\(\s*)?(?:[1-9]\d*(?:\^\d+)?|pasdeg)(?:\s*\))?(?![\w.^(])/g;
/** What can give an infinity from finite parts: a division left after SAFE_DIVISION, a negative power (0^-1), or one of
 *  these. */
const NEGATIVE_POWER = /\^\s*\(?\s*-/;
const SOURCE_CALLS = ["ln", "log", "log10", "logb", "tan", "cot", "sec", "csc", "atanh", "acoth", "Gamma", "gamma", "factorial", "Psi", "psi", "Beta", "beta", "inv", "lnGamma"];
const hasSource = (t: string): boolean => t.includes("/") || NEGATIVE_POWER.test(t) || callsOf(t, SOURCE_CALLS, "typed").length > 0;
/** The operators (Giac's `sommet` of a quoted part) that can make an infinity from finite operands; a power only when
 *  its exponent is not a positive integer literal. Only these parts are evaluated again. */
const SOURCE_OPS = new Set(["/", "^", "inv", "ln", "log", "log10", "logb", "tan", "cot", "sec", "csc", "atanh", "acoth", "Gamma", "gamma", "factorial", "Psi", "psi", "Beta", "beta", "lnGamma"]);
/** A part that changes engine state when it runs (an assignment, a store, a purge, an increment) or draws a random
 *  number: evaluating it again would change state the user did not ask to change (rules-core, principle 3). */
export function changesState(text: string, q: Quoting): boolean {
  const t = withoutStrings(text, "", q);
  if (STATE_OPS.some((o) => t.includes(o))) return true;
  return callsOf(t, undefined, q).some(({ name }) => {
    const n = name.toLowerCase();
    return STATE_CALLS.has(n) || n.includes("rand") || n.includes("ranm") || n.includes("ranv");
  });
}
const STATE_OPS = [":=", "=<", "=>", "+=", "-=", "*=", "/=", "++", "--"];
/** Lower case: the names are matched in any case. */
const STATE_CALLS: ReadonlySet<string> = new Set(["sto", "purge", "assume", "additionally", "srand", "randseed", "alea", "hasard", "shuffle", "sample"]);
/** Time the walk may take. A part costs at most about what the whole input cost (Home's own exact time), and some Giac
 *  calls ignore the interrupt (GMP's factorial, decisions.md "G58"), so a part is evaluated only while the time spent
 *  plus that cost stays within this. */
const WALK_BUDGET_MS = 500;

/**
 * F51: a finite (or undef) `output` of `input` (decimals exact) that rests on an infinity inside: some part of the
 * input, below the whole, whose operator can make an infinity (SOURCE_OPS) evaluates to ±∞ or Giac's unsigned ∞. Only
 * those parts are evaluated again, one engine call each; the walk is not run (nothing found) for an input that changes
 * state when run (changesState) or calls a function `userFn` names (a stored program may change globals), and it stops
 * (nothing found) before a part that could take the walk past WALK_BUDGET_MS, at `exactMs` (Home's own exact
 * evaluation time) per part, or once `late()`.
 */
export function throughInfinity(giac: Giac, input: string, output: string, late: () => boolean, exactMs: number, userFn: (name: string) => boolean): boolean {
  if (infinite(output) || firstNameIn(input, TYPED_INF, "typed") !== null || !hasSource(input.replace(SAFE_DIVISION, "")) || callsIn(input).length) return false;
  if (changesState(input, "typed") || functionsIn(input, "typed").some(userFn)) return false;
  // The sources in the tree, innermost first, so the infinity is found at the part that makes it; the whole input is
  // not evaluated again.
  return withTree(giac, input, late, (tree) => {
    const sources: string[] = [];
    const visit = (t: TreeNode, root: boolean): void => {
      if (t.kind === 1 && UNEVALUATED.has(t.head)) return;
      for (const c of t.children) visit(c, false);
      if (!root && t.kind === 1 && t.source && SOURCE_OPS.has(t.head)) sources.push(t.path);
    };
    visit(tree, true);
    return firstWithin(sources, (p) => `when(has(eval(${p}),infinity),1,0)`, giac, late, exactMs);
  });
}

/** The tree of the quoted input as Giac stores it in pasq (G103, from bridge-3 in the same call, tree.ts), given to
 *  `walk` before the name is purged; no evaluation here. False (nothing found) without a tree, or once `late()`. */
function withTree(giac: Giac, input: string, late: () => boolean, walk: (tree: TreeNode) => boolean): boolean {
  try {
    const tree = late() ? null : treeOf(giac.value(`pasq:=quote(${input})`, [], true).tree, "pasq");
    return tree ? walk(tree) : false;
  } finally {
    giac.eval("purge(pasq)");
  }
}

/** Whether Giac answers 1 for `ask(p)` of one of `parts`, within WALK_BUDGET_MS (a part costs at most `exactMs`). */
function firstWithin(parts: readonly string[], ask: (p: string) => string, giac: Giac, late: () => boolean, exactMs: number): boolean {
  const t0 = performance.now();
  for (const p of parts) {
    if (late() || performance.now() - t0 + exactMs > WALK_BUDGET_MS) return false;
    if (giac.eval(ask(p)).trim() === "1") return true;
  }
  return false;
}

/**
 * G168: whether a part of `input` (decimals exact), the whole included, divides by an exact 0: the denominator of a `/`
 * or the argument of an `inv` evaluates to Giac's integer 0 (a float 0, from approx(0), is no exact 0). Only those parts
 * are evaluated, within the same limits as throughInfinity's walk, and none for an input that changes state when run,
 * calls a function `userFn` names, or holds a definite integral, sum or limit (callsIn: those are refused by convergence).
 */
function dividesByZero(giac: Giac, input: string, late: () => boolean, exactMs: number, userFn: (name: string) => boolean): boolean {
  if (callsIn(input).length || changesState(input, "typed") || functionsIn(input, "typed").some(userFn)) return false;
  return withTree(giac, input, late, (tree) => {
    const denominators: string[] = [];
    const visit = (t: TreeNode): void => {
      if (t.kind === 1 && UNEVALUATED.has(t.head)) return;
      for (const c of t.children) visit(c);
      if (t.kind !== 1) return;
      if (t.head === "/" && t.children.length === 2) denominators.push(t.children[1]!.path);
      else if (t.head === "inv" && t.children.length === 1) denominators.push(t.children[0]!.path);
    };
    visit(tree);
    return firstWithin(denominators, (p) => `when(string(eval(${p}))=="0",1,0)`, giac, late, exactMs);
  });
}

/** G168: why Giac's undef of `input` is no value: "divisionByZero" when it came through an infinity (F51) or a part of the
 *  input divides by an exact 0, else "noValue". */
function undefReason(giac: Giac, input: string, late: () => boolean, exactMs: number, userFn: (name: string) => boolean): NoValue {
  return throughInfinity(giac, input, "undef", late, exactMs, userFn) || dividesByZero(giac, input, late, exactMs, userFn) ? "divisionByZero" : "noValue";
}

/** G168: a list or matrix Giac printed (Giac's `list[…]` type too, at any depth) that holds an `undef` element. */
function holdsUndef(n: PrintedNode | null): boolean {
  if (!n) return false;
  if (n.items) return n.items.some(holdsUndef);
  if (n.str !== undefined) return false;
  return n.raw === "undef" || (n.raw.startsWith(LIST_TYPE) && holdsUndef(parsePrinted(n.raw.slice(LIST_TYPE.length - 1))));
}

/** A name in Giac's text that is not a call nor a constant: the result has a free name (or a stored function's name),
 *  so it is not a lost number; read from the text, so such a result costs no engine call. */
const NOT_FREE: ReadonlySet<string> = new Set(["pi", "e", "i", "euler_gamma"]);
const freeName = (t: string): boolean => [...names(t, "printed")].some((n) => !n.call && !NOT_FREE.has(n.name));
/** A printed test, function or string: no lost number (lostNumber, lostCas). */
const notAValue = (t: string): boolean => /==|<>|->|"/.test(t);
/** G172: Giac's print `t` holds no free name and nothing that is no value: the elements of a list may all have numbers. */
export const mayBeNumbers = (t: string): boolean => !notAValue(t) && !freeName(t.split(LIST_TYPE).join("["));

/**
 * F50: the reason for a result held in `slot` that is Giac's text with no free name (a number was asked for, and Giac
 * found none): "overflow" when its value is an infinity, else "noValue". G168 (F93): Giac's undef as the whole answer,
 * or as an element of a list or matrix (no number can stand for it, F50 of the owner, 2026-10-20), is refused with
 * undefReason's reason; null for anything else (a name in it, a list without undef, a string, a function, an infinity
 * Giac gave as the answer, a test). G168f1: with `undefStands` (the Num table, where a cell shows NaN) only a whole-answer
 * undef through an infinity is refused, "divisionByZero" (F51, the walk's limits as there); no list element is asked.
 */
export function lostNumber(
  giac: Giac,
  slot: string,
  input: string,
  output: string,
  late: () => boolean,
  exactMs: number,
  userFn: (name: string) => boolean,
  undefStands = false,
): NoValue | null {
  const out = output.trim();
  if (undefStands && out === "undef") return throughInfinity(giac, input, out, late, exactMs, userFn) ? "divisionByZero" : null;
  if (!undefStands && out.includes("undef") && holdsUndef(parsePrinted(out))) return undefReason(giac, input, late, exactMs, userFn);
  if (infinite(out) || notAValue(out) || freeName(out)) return null;
  if (giac.eval(`type(${slot})`).trim() !== "expression") return null;
  if (namesOf(giac, slot)?.length !== 0) return null;
  return infinite(giac.eval(`evalf(${slot})`)) ? "overflow" : "noValue";
}

const NO_NUMBER: ReadonlySet<string> = new Set(["expression", "identifier"]);
/** Giac's operator of an interval and of a geometry object: values of their own, with no number to find. */
const OBJECT_HEADS: ReadonlySet<string> = new Set([" .. ", "pnt"]);

/**
 * G168 (F93): the reason for the CAS answer `output` of `input` (decimals exact), held in `slot`, when no value came:
 * Giac's bare undef (undefReason), or an answer with no free name, whose top is a function `input` itself calls or Giac's
 * seq operator (seq(0.3,-2) comes back as `(3/10^1)$-2`), and whose evalf is no number (Giac's call back unevaluated, binomial_icdf(4,0.5,3.0)), "noValue", asked at a double's digits: Giac has no MPFR value for some functions (igamma), so a call kept
 * at P or at a high CAS setting is no lost number. When the input may run again (`rerun`) it is asked too,
 * since the answer may hold P-digit floats a double cannot read (evalf(gammad_cdf(2,3,-2,1)) at P). An exact form whose evalf is a number stays (sqrt(2), BesselJ(1,2)), as does one
 * whose evalf is an infinity (exp(10^30), an exact form MPFR's range cannot print), and a form Giac rewrote whose evalf
 * fails only past the numeric range (acos(9007199254740993^9007199254740993)*asin(2), whose top is a product); a name, a list, a string, a test, an
 * interval (`1 .. 3`), a geometry object and an answer of any other type are no lost number. An undef inside a larger
 * answer is not looked for here. `evalf` is read through type(), never printed: a geometry object as the value of a call
 * makes Giac draw it ("window is not defined" in the engine).
 */
export function lostCas(giac: Giac, slot: string, input: string, output: string, late: () => boolean, userFn: (name: string) => boolean, digits: number, rerun: boolean): NoValue | null {
  const out = output.trim();
  if (out === "undef") return undefReason(giac, input, late, 0, userFn);
  // No call in the text (and no `$`, Giac's seq operator): no engine call at all (an exact rational, a name), so most
  // answers cost nothing here.
  if (infinite(out) || notAValue(out) || freeName(out) || (!functionsIn(out, "printed").length && !out.includes("$"))) return null;
  // bridge-3's elements of the list (no printing of a value here): the printed strings hold their quotes, a head its '…' too.
  const info = giac.value(`[string(type(${slot})),size(lname(${slot})),string(sommet(${slot}))]`, []).elements;
  if (info?.length !== 3 || info[0] !== '"expression"' || info[1] !== "0") return null;
  const head = info[2]!.slice(2, -2);
  if (OBJECT_HEADS.has(head) || (head !== "$" && !functionsIn(input, "typed").includes(head))) return null;
  const noNumber = (e: string): boolean => NO_NUMBER.has(withDigits(giac, DOUBLE_DIGITS, digits, () => giac.eval(`type(evalf(${e}))`)).trim());
  return noNumber(slot) && (!rerun || noNumber(input)) ? "noValue" : null;
}

/**
 * G123 (F123): whether the value in `slot`, whose exact text `output` holds no infinity, is MPFR's ±infinity at `P`
 * digits, or has an infinite part (G123f2: +infinity*i): an overflow (1.000000000000001^(10^50), about 10^(4.3E34)), where a double finds a finite number (its ln(a/b)
 * cancels to 0, so exp of it is 1.0). One engine call, read through string(): a geometry object (point(1,0.5)) as the
 * value of a call makes Giac draw it, which throws "window is not defined" in the engine.
 */
export function overflowAt(giac: Giac, slot: string, output: string, P: number): boolean {
  // G123f2: the module's one infinity rule on the string() text, so a part that is infinite (+infinity*i) is one too.
  return !infinite(output) && infinite(giac.eval(`string(evalf(${slot},${P}))`));
}

/** G187: log10 of the largest number MPFR holds here, (2^30-1)*log10(2) = 323228496.32 rounded up (its smallest is
 *  the inverse): evalf(exp(-744261000),40) is 4.0E-323228445, evalf(exp(-744261200),40) MPFR's 0. */
export const MPFR_LOG10_RANGE = 323228497;

/** G187: the value whose tree (bridge-3, `giac.value(…, true).tree`) is `tree` is a power a^b at its top: head ^ with
 *  two children (`-a^b`, `2*a^b`, `[a^b]` are not). */
export function powerAtTop(tree: ParseNode | null | undefined): boolean {
  return !!tree && tree[0] === 1 && tree[1] === "^" && tree[3].length === 2;
}

/**
 * G187 (F122): the value in `slot`, a power a^b by its tree `tree` (powerAtTop), past MPFR's range by its size:
 * log10|a^b| = re(b*ln(a))/ln(10) at `P` digits (a complex base by its modulus, a complex exponent by its real part)
 * beyond ±MPFR_LOG10_RANGE: "overflow" or "underflow". Asked before the checks that read the value (Giac's normal and
 * simplify of (atan(ln(-pi)+9007199254740993))^(sin(10^-300)-10^300), 10^(-1.96E299), overflowed the wasm stack).
 * One engine call, only for a power; a size Giac cannot state (a free name, an error) decides nothing.
 */
export function powerPastRange(giac: Giac, slot: string, tree: ParseNode | null | undefined, P: number): NoValue | null {
  if (!powerAtTop(tree)) return null;
  const size = Number(giac.eval(`evalf(re(([op(${slot})][1])*ln([op(${slot})][0]))/ln(10),${P})`).trim());
  return Number.isNaN(size) || Math.abs(size) <= MPFR_LOG10_RANGE ? null : size > 0 ? "overflow" : "underflow";
}

/** G148: the calls that evaluate their argument in floating point at once. */
const APPROX_CALLS = ["approx", "evalf"];

/** G148: `input` calls approx or evalf (a CAS assignment of it runs its right-hand side first, to store nothing refused). */
export const mayApproxRange = (input: string): boolean => callsOf(input, APPROX_CALLS, "typed").length > 0;

/** G148f1: `t` with each approx or evalf call replaced by its first argument in parentheses (the bare input). The last
 *  call in the text holds no other, so it is replaced first, until none is left. */
function bareOf(t: string): string {
  for (let calls = callsOf(t, APPROX_CALLS, "typed"); calls.length; calls = callsOf(t, APPROX_CALLS, "typed")) {
    const c = calls[calls.length - 1]!;
    t = `${t.slice(0, c.at)}(${topLevelArgs(t.slice(c.open + 1, c.close), "typed")[0] ?? ""})${t.slice(c.close + 1)}`;
  }
  return t;
}

/**
 * G148 (vg-3, vvg-1), G148f1, G148f2: the reason for the result `output` of `input` (decimals exact) when approx or
 * evalf took a finite, non-zero exact value past MPFR's exponent range and Giac's answer is ±infinity, an infinite part,
 * undef or a float 0 (approx(exp(10^20)), approx(exp(10^20)*i), approx(exp(-10^20)), 1/approx(exp(-10^20)),
 * 2*approx(exp(-10^20)), ln(approx(exp(-10^20))), approx(exp(10^20))/exp(10^20)): the bare input (each call replaced by
 * its first argument) is evaluated exactly in `pasq` and asked what the bare input is asked (overflowAt, then underflow
 * at P), and refused with its reason. A bare input whose exact form is infinite, undef or an error (1/approx(0),
 * approx(1/0), approx(0)/0, ln(approx(0)), a limit) keeps its answer, as does one that is exactly 0 (2*approx(0)). For an
 * infinity or undef the bare input gives no reason for, each call's first argument is asked the same (approx overflowed
 * or underflowed on its way). Nothing is asked for an output that is not infinite nor undef and does not read as 0, an
 * input with no approx or evalf, one with a typed infinity, one that changes state or calls a function of the user's,
 * nor once `late()`.
 */
export function approxRange(giac: Giac, input: string, output: string, P: number, late: () => boolean, userFn: (name: string) => boolean): NoValue | null {
  // G148f2: Giac's undef of a finite bare input (approx(exp(10^20))/exp(10^20)) is asked as an infinity is.
  const over = infinite(output) || output.trim() === "undef";
  const read = over || !hasFloat(output) ? null : decimalFromString(output);
  if (!over && (read === null || !isZero(read))) return null;
  const t = input.trim();
  const calls = callsOf(t, APPROX_CALLS, "typed");
  if (!calls.length || late()) return null;
  if (firstNameIn(t, TYPED_INF, "typed") !== null || changesState(t, "typed") || functionsIn(t, "typed").some(userFn)) return null;
  const finite = (exact: string): boolean => !isError(exact) && exact !== "undef" && !infinite(exact);
  try {
    const bare = giac.eval(`pasq:=(${bareOf(t)})`).trim();
    if (!finite(bare)) return null;
    // The value in pasq, whose exact text is `exact`, asked as the bare input is: past MPFR's range up, then down.
    const past = (exact: string): NoValue | null => {
      if (exact === "0") return null;
      if (overflowAt(giac, "pasq", exact, P)) return "overflow";
      return !late() && underflow(giac, ["pasq"], P) ? "underflow" : null;
    };
    const whole = past(bare);
    if (whole || !over) return whole;
    for (const c of calls) {
      if (late()) return null;
      const exact = giac.eval(`pasq:=(${topLevelArgs(t.slice(c.open + 1, c.close), "typed")[0] ?? ""})`).trim();
      const reason = finite(exact) ? past(exact) : null;
      if (reason) return reason;
    }
    return null;
  } finally {
    giac.eval("purge(pasq)");
  }
}

/** F50: a float path's `error` text for an input with no free name: Giac's undef or an infinity (no number found);
 *  null for Giac's own error message, which stays. */
export function lostFloat(giac: Giac, input: string, error: string): NoValue | null {
  const e = error.trim();
  if (isError(e) || (e !== "undef" && !/^[+-]?infinity$/.test(e))) return null;
  const names = namesOf(giac, `quote(${input})`);
  // A name that holds a value (pasdeg, a stored variable) is not free; a free name's type is "identifier".
  if (!names || names.some((n) => !CONSTANTS.has(n) && giac.eval(`type(${n})`).trim() === "identifier")) return null;
  return infinite(e) ? "overflow" : "noValue";
}

/** Giac's lname of `expr` (the names in it), from bridge-3's elements; null when it is no list (an error). */
function namesOf(giac: Giac, expr: string): string[] | null {
  const v = giac.value(`lname(${expr})`, []);
  return v.kind === "list" || v.kind === "matrix" ? (v.elements ?? null) : null;
}

const CONSTANTS = new Set(["pi", "e", "i", "infinity", "euler_gamma"]);

/** The Giac text of element `k` of the result in `slot`. */
export function elementAt(slot: string, shape: Shape, k: number): string {
  return shape.kind === "scalar" ? slot : shape.kind === "list" ? `${slot}[${k}]` : `${slot}[${Math.floor(k / shape.cols)}][${k % shape.cols}]`;
}

/** G84: the Giac texts of the elements of the result in `slot` that read as 0 and are no exact rational (but those in
 *  `checked`, decided already). */
export function zeroElements(slot: string, facts: readonly ElementFacts[], shape: Shape, checked?: ReadonlySet<number>): string[] {
  return facts.flatMap((f, k) => (!f.exact && isZero(f.value.re) && isZero(f.value.im) && !checked?.has(k) ? [elementAt(slot, shape, k)] : []));
}

/** G154: Giac's test that `e` (MPFR's 0 at every precision) has a size it can state at `P` digits (underflow). */
export const SIZED = (e: string, P: number): string =>
  `(pasx_->type(pasx_)==real and pasx_-pasx_==0)(evalf(re(lnexpand(ln(${e}))),${P})) or (pasx_->pasx_!=0 and pasx_-pasx_==0)(evalf((${e})^(1/10^1000),${P}))`;

/**
 * F60: whether one of `elements` (Giac texts of values that read as 0) is an underflow: a number too small for MPFR's
 * exponent range (exp(-10^30)), not a 0. Decided on Giac's exact answer, not on a float (bug-patterns family 3): its
 * normal form is not 0 (simplify, which proves more, takes 0.13 s on the DEG text of exp(cosh(asin(π))) and Giac's
 * interrupt then left the answer to chance). With `P`, the element's evalf must be MPFR's 0 at P, not noise below the
 * digits read (an exact 0 that Giac cannot prove, cos(pi/7)-cos(2*pi/7)+cos(3*pi/7)-1/2, is about 1E-41 at 40 digits
 * and stays ⚠ 0), and again at MAX_EVAL_DIGITS: a cancellation (exp(10^-70)-1, 1E-70, 0 at P, P+20 and P+40) has
 * digits there, an underflow has none at any precision; it stays ⚠ 0 (precision.yaml prec-zero-cancel). Without `P`
 * (null) the 0 is a double's, where MPFR found no value. G154 (F139): with `P`, MPFR's 0 at every precision is an
 * underflow only when Giac can state a size for it (SIZED): the real part of lnexpand(ln(e)) is a finite float at P
 * (-10^30 for exp(-10^30), -10^30+ln(sin(1)) for exp(-10^30)*sin(1)), or e^(10^-1000) a finite float that is not 0
 * (exp(w/10^1000) for exp(w), w complex: exp(cosh(asin(π)/pasdeg)), whose ln Giac leaves alone). An exact 0 Giac cannot
 * prove has neither (re(asin(i/10)), MPFR's 0 since patch 0023: -infinity and 0) and stays ⚠ 0, as does an underflow
 * whose size Giac cannot state (a sum of two). One engine call per element, only for those that read as 0, the size
 * asked last in the same call; a call Giac interrupts (an error) decides nothing.
 */
export function underflow(giac: Giac, elements: readonly string[], P: number | null): boolean {
  return elements.some((e) => {
    const nonzero = (then: string): string => `when(normal(${e})==0,0,${then})`;
    const q = P === null ? nonzero("1") : `when(evalf(${e},${P})==0,when(evalf(${e},${MAX_EVAL_DIGITS})==0,${nonzero(`when(${SIZED(e, P)},1,0)`)},0),0)`;
    return giac.eval(q).trim() === "1";
  });
}
