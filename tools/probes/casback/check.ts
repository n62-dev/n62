// SPDX-License-Identifier: GPL-3.0-or-later
// G64: CAS answers checked back (r16 section 3). Each check takes an answer and asks `at(expr, x)` for the number an
// expression has at x (null: not a plain real number there). A claim holds when the difference is 0 at every point.
// No expected values: the answer is checked against the question it answers. Only erasable TypeScript syntax.
// G805: the points are evaluated in doubles (Giac's evalf at 12 digits, read back as 12-digit text), so a point where the two sides differ
// is not checkable (the point is dropped, and the check is a skip unless another point fails) when a periodic function's argument (sin, cos, tan, sec,
// csc, cot, in either side) passes 10^8 there (one ulp of a double past 10^8 is 1.5·10^-8 or more, so its phase is round-off: tan of
// 9.1·10^13 two ways gave 2.04 and -22.8), or when they differ only past their first HELD_DIGITS digits at that size (|a-o| ≤ 10^-10
// of the larger: the last two of the 12 digits carry the round-off the steps grow; 2.00392368114e87 against …115e87). A side that
// really differs (in its first 10 digits, past TOL, with every argument under 10^8) still fails.
import type { ComplexValue, DecimalValue } from "../../../app/src/engine/format.ts";
import type { Shown } from "../sweep/judge.ts";

/** The value of a Giac expression with x replaced by the text `x`, or null when it is not a plain real number. */
export type At = (expr: string, x: string) => number | null;

export type Kind = "antiderivative" | "solution" | "factorisation" | "simplification";

/** Three points in (0, 1), inside the domain of ln, sqrt and 1/(x+a) for the generated forms, and one negative point,
 *  where a lost sign shows (sqrt(x^2) -> x agrees at all three positive ones). */
export const POINTS: readonly string[] = ["0.3", "0.55", "0.8", "-0.7"];
const TOL = 1e-7;
/** G805: the digits two double evaluations of one value are compared to, at any size. */
export const HELD_DIGITS = 10;
/** G805: past this a periodic function's argument holds no reliable phase in a double. */
export const PHASE_LIMIT = 1e8;

/** G805: the largest |argument| of a periodic function (sin, cos, tan, sec, csc, cot) in an expression at x; 0 with none, null unknown. */
export type Phase = (expr: string, x: string) => number | null;

export interface Verdict {
  /** "ok": holds; "wrong": differs at a point; "skip": not checkable (the reason says why). */
  status: "ok" | "wrong" | "skip";
  detail: string;
}

const ok: Verdict = { status: "ok", detail: "" };
const skip = (detail: string): Verdict => ({ status: "skip", detail });

/** What the bridge says of a printed answer (P20: its kind and tree, not its spelling). */
export interface Info {
  /** Giac's kind of the value ("undef", "error", "symbolic", "list", …). */
  kind: string;
  /** The tree holds an unevaluated `int`, `integrate`, `solve`, `undef` or an equation. */
  unresolved: boolean;
}
export type Probe = (text: string) => Info;

/** Kinds that are no expression to check back. */
const NO_EXPRESSION: ReadonlySet<string> = new Set(["undef", "error", "other", "string", "function", "boolean", "infinity", "list", "matrix", "sequence", "set"]);

/** The claim `answer = original` at every point, each evaluated alone. A point where exactly one has a real value is wrong
 *  (a lost sign: ln(x^2) -> 2*ln(x) is not real at x<0); only a point where neither has one is not checked. */
function sameAt(answer: string, original: string, at: At, phase?: Phase, points: readonly string[] = POINTS): Verdict {
  let seen = 0;
  let dropped = "";
  for (const p of points) {
    const a = at(answer, p);
    const o = at(original, p);
    if (a === null && o === null) continue;
    if (a !== null && o !== null && Math.abs(a - o) <= TOL) {
      seen++;
      continue;
    }
    const why = notCheckable([answer, original], p, phase, a, o);
    if (why) {
      dropped ||= why;
      continue;
    }
    if (a === null || o === null) return { status: "wrong", detail: `${a === null ? answer : original} is not real at x=${p}, ${a === null ? original : answer} = ${a ?? o}` };
    return { status: "wrong", detail: `${answer} = ${a}, ${original} = ${o} at x=${p}` };
  }
  // a dropped point makes the check a skip (the points that agreed may agree by chance, as two rounded phases can)
  return dropped ? skip(dropped) : seen > 0 ? ok : skip("no real number at any point");
}

/** G805 (the rule in the header): why a point where the sides differ is not checkable in doubles, or null when it is. */
function notCheckable(exprs: readonly string[], x: string, phase: Phase | undefined, a: number | null, o: number | null): string | null {
  if (a !== null && o !== null && Math.abs(a - o) <= 10 ** -HELD_DIGITS * Math.max(Math.abs(a), Math.abs(o))) return `the sides differ only past ${HELD_DIGITS} digits at x=${x} (${a}, ${o})`;
  if (!phase) return null;
  const top = Math.max(...exprs.map((e) => phase(e, x) ?? 0));
  return top > PHASE_LIMIT ? `a periodic function's argument is ${top.toPrecision(3)} at x=${x}, past 10^8` : null;
}

function notAnswer(answer: string, probe: Probe): string | null {
  const i = probe(answer);
  if (i.unresolved) return "unevaluated in the answer";
  return NO_EXPRESSION.has(i.kind) ? `answer is ${i.kind}` : null;
}

/** An antiderivative differentiates to the integrand. */
export function checkAntiderivative(integrand: string, answer: string, at: At, probe: Probe, phase?: Phase): Verdict {
  const why = notAnswer(answer, probe);
  return why ? skip(why) : sameAt(`diff(${answer},x)`, integrand, at, phase);
}

/** A factorisation expands back to the original. */
export function checkFactorisation(original: string, answer: string, at: At, probe: Probe, phase?: Phase): Verdict {
  const why = notAnswer(answer, probe);
  return why ? skip(why) : sameAt(answer, original, at, phase);
}

/** A simplification agrees with the original at the points. */
export function checkSimplification(original: string, answer: string, at: At, probe: Probe, phase?: Phase): Verdict {
  const why = notAnswer(answer, probe);
  return why ? skip(why) : sameAt(answer, original, at, phase);
}

/** The entries of a printed list, read by Giac's bridge (P20: no bracket loop here); null when the text is not a list. */
export type Entries = (text: string) => string[] | null;

/** Every solution of `lhs=rhs` substitutes to 0 (one check per entry, so a missing solution is not noticed: only wrong ones). */
export function checkSolutions(equation: string, answer: string, at: At, entries: Entries, probe: Probe, phase?: Phase): Verdict {
  const sols = entries(answer);
  if (!sols || sols.length === 0) return skip("no list of solutions");
  const sides = equation.split("=");
  if (sides.length !== 2) return skip("not an equation");
  const diff = `(${sides[0]})-(${sides[1]})`;
  for (const s of sols) {
    const why = notAnswer(s, probe);
    if (why) return skip(`solution ${s}: ${why}`);
    const v = at(diff, s);
    if (v === null) return skip(`solution ${s} gives no real number`);
    if (Math.abs(v) <= TOL) continue;
    const not = notCheckable([diff], s, phase, null, null);
    if (not) return skip(`solution ${s}: ${not}`);
    return { status: "wrong", detail: `${diff} = ${v} at x=${s}` };
  }
  return ok;
}

/** One question for the stage: what is asked of the CAS and how its answer is checked back. */
export interface Question {
  id: string;
  kind: Kind;
  /** The CAS input. */
  input: string;
  /** The expression the answer is checked against (integrand, original, equation). */
  subject: string;
}

/** G805: `phase` (optional) reads a periodic function's argument at a point, for the rule in the header. */
export function checkBack(q: Question, answer: string, at: At, entries: Entries, probe: Probe, phase?: Phase): Verdict {
  switch (q.kind) {
    case "antiderivative": return checkAntiderivative(q.subject, answer, at, probe, phase);
    case "solution": return checkSolutions(q.subject, answer, at, entries, probe, phase);
    case "factorisation": return checkFactorisation(q.subject, answer, at, probe, phase);
    case "simplification": return checkSimplification(q.subject, answer, at, probe, phase);
  }
}

/** mulberry32: a fixed-seed generator. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sgn = (n: number, first = false): string => (n < 0 ? `-${-n}` : first ? `${n}` : `+${n}`);

/** Generated questions, deterministic for a seed: integrals, factorisations and equations in x (simplifications come from G61's generator, in the stage). */
export function generated(seed: number, count: number): Question[] {
  const r = rng(seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const n = (lo: number, hi: number): number => lo + Math.floor(r() * (hi - lo + 1));
  const out: Question[] = [];
  for (let i = 0; i < count; i++) {
    const a = n(2, 5);
    const b = n(1, 4);
    const k = i % 3;
    if (k === 0) {
      const f = pick([`x^${a}`, `sin(${a}*x)`, `exp(${a}*x)`, `1/(x+${b})`, `x*exp(x)`, `x^${a}+${b}*x`, `cos(${a}*x)*${b}`, `x*sin(x)`, `sqrt(x+${b})`]);
      out.push({ id: `antiderivative: ${f}`, kind: "antiderivative", input: `int(${f},x)`, subject: f });
    } else if (k === 1) {
      const p = n(-4, 4) || 1;
      const q = n(-4, 4) || 2;
      const f = pick([`x^2${sgn(p + q)}*x${sgn(p * q)}`, `x^3${sgn(-p)}*x^2${sgn(-q)}*x${sgn(p * q)}`, `${a * a}*x^2-${b * b}`, `x^4-${a * a}`]);
      out.push({ id: `factorisation: ${f}`, kind: "factorisation", input: `factor(${f})`, subject: f });
    } else {
      const p = n(-5, 5);
      const q = n(-5, 5);
      const eq = pick([`x^2${sgn(-(p + q))}*x${sgn(p * q)}=0`, `${a}*x${sgn(b)}=${n(-6, 6)}`, `x^2=${a}`, `x^3-${a}*x=0`, `x^2+${b}*x=${a}`]);
      out.push({ id: `solution: ${eq}`, kind: "solution", input: `solve(${eq},x)`, subject: eq });
    }
  }
  return out;
}

/** The questions G55's corpus holds in a checkable form (indefinite int, factor, solve with one equation, simplify, all in x); the rest is counted as skipped. */
export function fromCorpus(inputs: readonly string[]): { questions: Question[]; skipped: number } {
  const questions: Question[] = [];
  let skipped = 0;
  for (const input of inputs) {
    let m: RegExpExecArray | null;
    if ((m = /^int\((.+),x\)$/.exec(input))) questions.push({ id: `corpus antiderivative: ${m[1]}`, kind: "antiderivative", input, subject: m[1]! });
    else if ((m = /^factor\((.+)\)$/.exec(input))) questions.push({ id: `corpus factorisation: ${m[1]}`, kind: "factorisation", input, subject: m[1]! });
    else if ((m = /^solve\((.+=.+),x\)$/.exec(input))) questions.push({ id: `corpus solution: ${m[1]}`, kind: "solution", input, subject: m[1]! });
    else if ((m = /^simplify\((.+)\)$/.exec(input))) questions.push({ id: `corpus simplification: ${m[1]}`, kind: "simplification", input, subject: m[1]! });
    else skipped++;
  }
  return { questions, skipped };
}

// G798: laws that need no oracle (a family test, owner-style hunt 2026-11-23). A law is two Home inputs whose answers must agree
// (scale a float matrix by c and the answer scales by the known power; lcm of any signs is lcm of the absolute values, ≥ 0). Each side's
// claim is its mark at the setting digits: `=` the exact value, `≈` every shown digit, `⚠ n` n digits (as the sweep's judge reads it),
// a bare `⚠` or `⚠ 0` nothing. A broken law is wrong only when both sides claim digits; the two are compared within what both claim
// (each within one unit of its last claimed digit, at the larger magnitude). An error or a non-number on either side is not checkable.

/** What Home showed for one side (the sweep's Shown: tools/probes/sweep/shown.ts). */
export type LawShown = Pick<Shown, "ok" | "mark" | "n" | "value" | "items" | "shape">;

export interface Law {
  /** The id in casback-known.yaml: `<law> d<digits>: <left LaTeX>`. */
  id: string;
  law: string;
  /** Keyboard LaTeX of the two sides, as Home gets them (latexToGiac). */
  left: string;
  right: string;
  /** The Digits setting both sides run at. */
  digits: number;
  /** Both sides must be ≥ 0 (lcm, gcd). */
  nonneg?: true;
}

interface Dec {
  m: bigint;
  e: number;
}
const decOf = (v: DecimalValue): Dec => ({ m: (v.neg ? -1n : 1n) * BigInt(v.digits || "0"), e: v.exp + 1 - v.digits.length });
/** floor(log10|v|) + 1; -Infinity for 0. */
const magOf = (v: DecimalValue): number => (v.digits === "" ? -Infinity : v.exp + 1);

/** The digits a side claims: Infinity for an exact `=`, null for none. */
function claimOf(s: LawShown, digits: number): number | null {
  if (s.mark === "=") return s.value && (s.value.re.sticky || s.value.im.sticky) ? digits : Infinity;
  if (s.mark === "≈") return digits;
  return s.mark === "⚠" && s.n !== undefined && s.n >= 1 ? s.n : null;
}

/** The power of ten just above |d|: floor(log10|d|) + 1; -Infinity for 0. */
const top = (d: Dec): number => (d.m === 0n ? -Infinity : d.e + (d.m < 0n ? -d.m : d.m).toString().length);

/** |a − b| ≤ 10^p + 10^q (an infinite p or q adds nothing). */
function near(a: Dec, b: Dec, p: number, q: number): boolean {
  const ps = [p, q].filter((x) => Number.isFinite(x));
  const lo = Math.min(a.m === 0n ? Infinity : a.e, b.m === 0n ? Infinity : b.e, ...ps);
  if (!Number.isFinite(lo)) return true; // both 0, both exact
  // far apart (a value 4000 decades from the other or from the bound): the difference is the larger value
  if (Math.max(top(a), top(b), ...ps) - lo > 4000) return ps.length > 0 && Math.max(top(a), top(b)) <= Math.max(...ps);
  const at = (d: Dec): bigint => (d.m === 0n ? 0n : d.m * 10n ** BigInt(d.e - lo));
  const diff = at(a) - at(b);
  const bound = ps.reduce((sum, x) => sum + 10n ** BigInt(x - lo), 0n);
  return (diff < 0n ? -diff : diff) <= bound;
}

const show = (v: ComplexValue): string => {
  const one = (d: DecimalValue): string => (d.digits === "" ? "0" : `${d.neg ? "-" : ""}${d.digits[0]}${d.digits.length > 1 ? `.${d.digits.slice(1, 16)}${d.digits.length > 16 ? "…" : ""}` : ""}E${d.exp}`);
  return d0(v.im) ? one(v.re) : `${one(v.re)}+${one(v.im)}i`;
};
const d0 = (d: DecimalValue): boolean => d.digits === "";
const markText = (s: LawShown): string => `${s.mark ?? ""}${s.n ?? ""}`;

/** One entry against the other: wrong when both claim and they differ beyond what both claim. */
function entryVerdict(l: LawShown, r: LawShown, digits: number, where: string): Verdict {
  const cl = claimOf(l, digits);
  const cr = claimOf(r, digits);
  if (!l.value || !r.value) return skip(`${where}no number`);
  if (cl === null || cr === null) return ok;
  const m = Math.max(magOf(l.value.re), magOf(l.value.im), magOf(r.value.re), magOf(r.value.im));
  const p = cl === Infinity ? Infinity : m - cl;
  const q = cr === Infinity ? Infinity : m - cr;
  for (const part of ["re", "im"] as const) {
    if (!near(decOf(l.value[part]), decOf(r.value[part]), p, q)) return { status: "wrong", detail: `${where}${show(l.value)} ${markText(l)} vs ${show(r.value)} ${markText(r)}` };
  }
  return ok;
}

/** The law's two sides as Home showed them. */
export function checkLaw(l: LawShown, r: LawShown, digits: number, nonneg = false): Verdict {
  if (!l.ok || !r.ok) return skip("an error on a side");
  const li = l.items ?? [l];
  const ri = r.items ?? [r];
  const claims = (xs: LawShown[]): boolean => xs.every((x) => claimOf(x, digits) !== null);
  if (li.length !== ri.length || (l.shape && r.shape && (l.shape[0] !== r.shape[0] || l.shape[1] !== r.shape[1]))) {
    const what = `shape ${l.shape?.join("×") ?? li.length} vs ${r.shape?.join("×") ?? ri.length}`;
    return claims(li) && claims(ri) ? { status: "wrong", detail: what } : skip(`${what}, a side marked ⚠`);
  }
  for (let i = 0; i < li.length; i++) {
    const where = li.length > 1 ? `entry ${i + 1}: ` : "";
    for (const s of nonneg ? [li[i]!, ri[i]!] : []) {
      if (s.value && claimOf(s, digits) !== null && ((s.value.re.neg && !d0(s.value.re)) || !d0(s.value.im))) return { status: "wrong", detail: `${where}${show(s.value)} ${markText(s)} is not ≥ 0` };
    }
    const v = entryVerdict(li[i]!, ri[i]!, digits, where);
    if (v.status !== "ok") return v;
  }
  return ok;
}

/** The scales of the matrix laws: c = 10^k. */
export const LAW_SCALES: readonly number[] = [-13, -7, 7, 13];
/** The Digits settings the laws run at (the default and the most the setting allows; G622's ⚠ 14 shows at 30). */
export const LAW_DIGITS: readonly number[] = [12, 30];

const law = (name: string, left: string, right: string, digits: number, nonneg = false): Law => ({ id: `${name} d${digits}: ${left}`, law: name, left, right, digits, ...(nonneg ? { nonneg: true as const } : {}) });
const op = (name: string, ...args: string[]): string => `\\operatorname{${name}}\\left(${args.join(",")}\\right)`;
/** A float matrix: approx(…) around the matrix, unless it is one already (half of G797's leaves are). */
const approx = (m: string): string => (/^\\operatorname\{approx\}\\left\(.*\\right\)$/.test(m) ? m : op("approx", m));

/** The matrix laws for A, B (n×n) and a column b, each made a float matrix by approx(…), at every scale and Digits setting:
 *  (c·A)·B = c·(A·B), det(c·A) = c^n·det(A), inv(c·A) = inv(A)/c, rank(c·A) = rank(A), linsolve(c·A, c·b) = linsolve(A, b). */
export function matrixLaws(a: string, b: string, col: string, n: number): Law[] {
  const A = approx(a);
  const B = approx(b);
  const out: Law[] = [];
  for (const d of LAW_DIGITS) {
    for (const k of LAW_SCALES) {
      const c = `10^{${k}}`;
      const cA = `${c}\\times ${A}`;
      out.push(
        law("product", `\\left(${cA}\\right)\\times ${B}`, `${c}\\times \\left(${A}\\times ${B}\\right)`, d),
        law("det", op("det", cA), `\\left(${c}\\right)^{${n}}\\times ${op("det", A)}`, d),
        law("inv", op("inv", cA), `\\frac{${op("inv", A)}}{${c}}`, d),
        law("rank", op("rank", cA), op("rank", A), d),
        law("linsolve", op("linsolve", cA, `${c}\\times ${col}`), op("linsolve", A, col), d),
      );
    }
  }
  return out;
}

const pm = (rows: number[][]): string => `\\begin{pmatrix}${rows.map((r) => r.join("&")).join("\\\\")}\\end{pmatrix}`;
/** The hand matrices of the hunt, in every run: G790's [[1,2],[3,4]], G622's [[1,2,3],[4,5,6],[7,8,10]] and its singular [[…],[7,8,9]]. */
export const LAW_MATRICES_PINNED: readonly { n: 2 | 3; a: string; b: string; col: string }[] = [
  { n: 2, a: pm([[1, 2], [3, 4]]), b: pm([[1, 2], [3, 4]]), col: pm([[1], [2]]) },
  { n: 3, a: pm([[1, 2, 3], [4, 5, 6], [7, 8, 10]]), b: pm([[1, 2, 3], [4, 5, 6], [7, 8, 10]]), col: pm([[1], [2], [3]]) },
  { n: 3, a: pm([[1, 2, 3], [4, 5, 6], [7, 8, 9]]), b: pm([[1, 2, 3], [4, 5, 6], [7, 8, 10]]), col: pm([[1], [2], [3]]) },
];

/** The fixed integers of the sign laws: 0, small, 2^31 ± 1, 2^63 ± 1, 2^70 (the negatives come from the laws). */
export const LAW_INTEGERS: readonly bigint[] = [0n, 7n, 12n, 2n ** 31n - 1n, 2n ** 31n + 1n, 2n ** 63n - 1n, 2n ** 63n + 1n, 2n ** 70n];

/** An integer as an operand (a negative one in brackets after ×). */
const int = (x: bigint, paren = false): string => (x < 0n && paren ? `\\left(${x}\\right)` : `${x}`);

/** The integer laws for a and b ≥ 0 at Digits 30 (exact, so one setting; there most of them show in full): lcm(±a,±b) = lcm(a,b) ≥ 0, gcd the same, hamdist(a,b) =
 *  hamdist(−a−1,−b−1) (two's complement: −a−1 is a with every bit flipped), b·iquo(a,b) + irem(a,b) = a for every sign pair (b ≠ 0). */
export function integerLaws(a: bigint, b: bigint): Law[] {
  const out: Law[] = [];
  const signs: readonly [bigint, bigint][] = [[1n, 1n], [1n, -1n], [-1n, 1n], [-1n, -1n]];
  const d = 30;
  for (const [sa, sb] of signs) {
    if ((a === 0n && sa < 0n) || (b === 0n && sb < 0n)) continue; // −0 is 0
    const x = sa * a;
    const y = sb * b;
    if (sa < 0n || sb < 0n) out.push(law("lcm", op("lcm", int(x), int(y)), op("lcm", int(a), int(b)), d, true), law("gcd", op("gcd", int(x), int(y)), op("gcd", int(a), int(b)), d, true));
    if (y !== 0n) out.push(law("division", `${int(y, true)}\\times ${op("iquo", int(x), int(y))}+${op("irem", int(x), int(y))}`, int(x), d));
  }
  out.push(law("hamdist", op("hamdist", int(a), int(b)), op("hamdist", int(-a - 1n), int(-b - 1n)), d));
  return out;
}

/** Every integer law over the ordered pairs of LAW_INTEGERS. */
export function integerLawSet(): Law[] {
  return LAW_INTEGERS.flatMap((a) => LAW_INTEGERS.flatMap((b) => integerLaws(a, b)));
}
