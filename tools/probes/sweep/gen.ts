// SPDX-License-Identifier: GPL-3.0-or-later
// G61: the generator of the oracle sweep (r16 Appendix B). A seeded LCG builds a tree of depth up to 3; each tree prints as keyboard
// LaTeX (what the keys write, through our parser) and as an mpmath expression for oracle.py. Pure. G326: e is written as the keys insert it,
// \exponentialE (the eˣ key's \exponentialE^{…}, spec/keyboard.yaml): the letter e is the name e_ since R67, no number.

export interface Case {
  /** Keyboard LaTeX. */
  latex: string;
  /** The same tree as a Python expression over oracle.py's names (SIN, POW, DIV, mpf('2.5'), …). */
  mp: string;
  /** True when the tree holds a trig or inverse trig function (it also runs in DEG). */
  angle: boolean;
}

interface Node extends Case {
  /** Plain leaf or closed form that needs no brackets as an operand; a power base is stricter (`plain`). */
  atom: boolean;
  plain: boolean;
}

/** The LCG of Appendix B: seed·1103515245 + 12345, 31 bits. */
export function lcg(seed: number): () => number {
  let s = BigInt(Math.abs(Math.trunc(seed))) & 0x7fffffffn;
  return () => {
    s = (s * 1103515245n + 12345n) & 0x7fffffffn;
    return Number(s) / 2147483648;
  };
}

const INTS = [0, 1, 2, 3, 5, 7, 10, 12];
const DECIMALS = ["0.1", "0.2", "0.3", "2.5", "0.001", "1.05", "9.81", "3.7"];
const EMANT = ["1.5", "2", "6.02"];
const EEXP = [3, -3, 8, -8, 22, -15];
const FACTS = [3, 5, 7, 10];
const FNS: { latex: string; mp: string; angle: boolean }[] = [
  { latex: "\\sin", mp: "SIN", angle: true },
  { latex: "\\cos", mp: "COS", angle: true },
  { latex: "\\tan", mp: "TAN", angle: true },
  { latex: "\\arcsin", mp: "ASIN", angle: true },
  { latex: "\\arccos", mp: "ACOS", angle: true },
  { latex: "\\arctan", mp: "ATAN", angle: true },
  { latex: "\\sinh", mp: "sinh", angle: false },
  { latex: "\\cosh", mp: "cosh", angle: false },
  { latex: "\\tanh", mp: "tanh", angle: false },
  { latex: "\\operatorname{asinh}", mp: "asinh", angle: false },
  { latex: "\\ln", mp: "LN", angle: false },
  { latex: "\\log", mp: "LOG10", angle: false },
];

const pick = <T>(r: () => number, a: readonly T[]): T => a[Math.min(a.length - 1, Math.floor(r() * a.length))]!;

function leaf(r: () => number, withX = false): Node {
  if (withX && r() < 0.35) return { latex: "x", mp: "x", angle: false, atom: true, plain: true };
  const x = r();
  if (x < 0.45) {
    const n = pick(r, INTS);
    return { latex: `${n}`, mp: `mpf('${n}')`, angle: false, atom: true, plain: true };
  }
  if (x < 0.7) {
    const d = pick(r, DECIMALS);
    return { latex: d, mp: `mpf('${d}')`, angle: false, atom: true, plain: true };
  }
  if (x < 0.8) return { latex: "\\pi", mp: "PI", angle: false, atom: true, plain: true };
  if (x < 0.85) return { latex: "\\exponentialE", mp: "E", angle: false, atom: true, plain: true };
  if (x < 0.92) {
    const m = pick(r, EMANT);
    const k = pick(r, EEXP);
    return { latex: `${m}ᴇ${k}`, mp: `mpf('${m}e${k}')`, angle: false, atom: false, plain: false };
  }
  const n = pick(r, FACTS);
  return { latex: `${n}!`, mp: `FACT(${n})`, angle: false, atom: false, plain: false };
}

const wrap = (n: Node, base = false): string => ((base ? n.plain : n.atom) ? n.latex : `\\left(${n.latex}\\right)`);

function build(r: () => number, depth: number, withX = false): Node {
  if (depth <= 0 || r() < 0.25) return leaf(r, withX);
  const x = r();
  const sub = (): Node => build(r, depth - 1, withX);
  if (x < 0.35) {
    const f = pick(r, FNS);
    const a = sub();
    return { latex: `${f.latex}\\left(${a.latex}\\right)`, mp: `${f.mp}(${a.mp})`, angle: f.angle || a.angle, atom: true, plain: false };
  }
  if (x < 0.42) {
    const a = sub();
    return { latex: `\\sqrt{${a.latex}}`, mp: `sqrt(${a.mp})`, angle: a.angle, atom: true, plain: true };
  }
  if (x < 0.47) {
    const a = sub();
    return { latex: `\\exponentialE^{${a.latex}}`, mp: `exp(${a.mp})`, angle: a.angle, atom: false, plain: false };
  }
  if (x < 0.5) {
    const a = sub();
    return { latex: `\\left|${a.latex}\\right|`, mp: `ABS(${a.mp})`, angle: a.angle, atom: true, plain: true };
  }
  const a = sub();
  const b = sub();
  const angle = a.angle || b.angle;
  if (x < 0.62) return { latex: `${wrap(a)}+${wrap(b)}`, mp: `(${a.mp})+(${b.mp})`, angle, atom: false, plain: false };
  if (x < 0.72) return { latex: `${wrap(a)}-${wrap(b)}`, mp: `(${a.mp})-(${b.mp})`, angle, atom: false, plain: false };
  if (x < 0.82) return { latex: `${wrap(a)}\\times ${wrap(b)}`, mp: `(${a.mp})*(${b.mp})`, angle, atom: false, plain: false };
  if (x < 0.92) return { latex: `\\frac{${a.latex}}{${b.latex}}`, mp: `DIV(${a.mp},${b.mp})`, angle, atom: true, plain: true };
  return { latex: `${wrap(a, true)}^{${b.latex}}`, mp: `POW(${a.mp},${b.mp})`, angle, atom: false, plain: false };
}

/** `count` trees from `seed`, depth up to 3 (`opts.depth`). With `opts.x` the leaves may be the variable x (G63: the view sweep; `mp` is then not an oracle input). */
export function generate(seed: number, count: number, opts: { x?: boolean; depth?: number } = {}): Case[] {
  const r = lcg(seed);
  const out: Case[] = [];
  for (let i = 0; i < count; i++) {
    const t = build(r, opts.depth ?? 3, opts.x === true);
    out.push({ latex: t.latex, mp: t.mp, angle: t.angle });
  }
  return out;
}

/** Inputs that were found wrong or hanging and stay in every run at 12 digits in RAD (backlog F44, G58: they hung Home). */
export const PINNED: Case[] = [
  { latex: "\\exponentialE^{1.5ᴇ8}", mp: "exp(mpf('1.5e8'))", angle: false },
  { latex: "\\sqrt{\\exponentialE^{2ᴇ8}}", mp: "sqrt(exp(mpf('2e8')))", angle: false },
  { latex: "3+\\frac{\\exponentialE^{1.5ᴇ8}}{\\arcsin\\left(3\\right)}", mp: "(mpf('3'))+DIV(exp(mpf('1.5e8')),ASIN(mpf('3')))", angle: false },
  { latex: "\\arccos\\left(\\left(5!\\right)^{2.5+5!}\\right)", mp: "ACOS(POW(FACT(5),(mpf('2.5'))+FACT(5)))", angle: false },
  { latex: "\\exponentialE^{10^{7}}", mp: "exp(POW(mpf('10'),mpf('7')))", angle: false },
];

// G797: matrix trees (a family test, owner-style hunt 2026-11-23: every wrong answer of h3 #1–#3 was a float matrix). A matrix leaf is a
// 2×2 or 3×3 \begin{pmatrix} of the scalar leaves above (one in five singular: the last row the sum of the first two, or twice the first),
// half of them scaled by 10^k with k in −15..15 (`10^{k}\times M` or `\frac{M}{10^{k}}`), half inside `\operatorname{approx}(…)`. The
// nodes are what the keys and Find write: + × (a scalar too) ^2, tran, inv, eˣ, sin, cos of a matrix, and at the top det, rank,
// linsolve(M, column) and M × column. mp names: oracle.py's MAT, MADD, MMUL, SMUL, MDIV, MSQ, TRN, INV, EXPM, SINM, COSM, DET, RANK,
// LINSOLVE, APPROX. Each matrix node's matrix-valued children are kept for the nightly shrink (matrixChildrenOf).

interface MNode {
  latex: string;
  mp: string;
  angle: boolean;
  /** The matrix-valued children (for the shrink). */
  kids: MNode[];
  /** A literal \begin{pmatrix}, a call or a fraction: no brackets needed as an operand. */
  atom: boolean;
  /** A bare \begin{pmatrix}: no brackets needed as a power base either. */
  lit?: true;
}

const MKIDS = new Map<string, Case[]>();
const caseOf = (n: MNode): Case => ({ latex: n.latex, mp: n.mp, angle: n.angle });
function remember(n: MNode): MNode {
  if (n.kids.length > 0 && !MKIDS.has(n.latex)) MKIDS.set(n.latex, n.kids.map(caseOf));
  return n;
}

/** The matrix-valued subtrees of a matrix tree generated in this process (the nightly shrink's children); [] for any other input. */
export function matrixChildrenOf(latex: string): Case[] {
  return MKIDS.get(latex) ?? [];
}

const pmatrix = (rows: Node[][]): { latex: string; mp: string } => ({
  latex: `\\begin{pmatrix}${rows.map((r) => r.map((e) => e.latex).join("&")).join("\\\\")}\\end{pmatrix}`,
  mp: `MAT([${rows.map((r) => `[${r.map((e) => e.mp).join(",")}]`).join(",")}])`,
});

/** An entry built from two leaves: a + b, or 2 × a. */
const sumOf = (a: Node, b: Node): Node => ({ latex: `${wrap(a)}+${wrap(b)}`, mp: `(${a.mp})+(${b.mp})`, angle: false, atom: false, plain: false });
const twice = (a: Node): Node => ({ latex: `2\\times ${wrap(a)}`, mp: `(mpf('2'))*(${a.mp})`, angle: false, atom: false, plain: false });

/** A matrix leaf of size n: the entries, maybe singular, maybe scaled by 10^k, maybe inside approx(…). */
function mleaf(r: () => number, n: number): MNode {
  const rows: Node[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => leaf(r)));
  if (r() < 0.2) rows[n - 1] = n === 2 ? rows[0]!.map(twice) : rows[0]!.map((a, j) => sumOf(a, rows[1]![j]!));
  let m: MNode = { ...pmatrix(rows), angle: false, kids: [], atom: true, lit: true };
  if (r() < 0.5) {
    const k = Math.floor(r() * 31) - 15;
    const p = `POW(mpf('10'),mpf('${Math.abs(k)}'))`;
    m =
      k > 0 && r() < 0.5
        ? { latex: `\\frac{${m.latex}}{10^{${k}}}`, mp: `MDIV(${m.mp},${p})`, angle: false, kids: [], atom: true }
        : { latex: `10^{${k}}\\times ${m.latex}`, mp: `SMUL(POW(mpf('10'),mpf('${k}')),${m.mp})`, angle: false, kids: [], atom: false };
  }
  if (r() < 0.5) m = { latex: `\\operatorname{approx}\\left(${m.latex}\\right)`, mp: `APPROX(${m.mp})`, angle: false, kids: [], atom: true };
  return m;
}

const mwrap = (n: MNode): string => (n.atom ? n.latex : `\\left(${n.latex}\\right)`);
const call = (name: string, mp: string, a: MNode, angle = false): MNode =>
  remember({ latex: `${name}\\left(${a.latex}\\right)`, mp: `${mp}(${a.mp})`, angle: angle || a.angle, kids: [a], atom: true });

/** A matrix-valued tree of size n, depth up to `depth`. */
function mbuild(r: () => number, depth: number, n: number): MNode {
  if (depth <= 0 || r() < 0.3) return mleaf(r, n);
  const x = r();
  const sub = (): MNode => mbuild(r, depth - 1, n);
  if (x < 0.14) {
    const a = sub();
    const b = sub();
    return remember({ latex: `${mwrap(a)}+${mwrap(b)}`, mp: `MADD(${a.mp},${b.mp})`, angle: a.angle || b.angle, kids: [a, b], atom: false });
  }
  if (x < 0.3) {
    const a = sub();
    const b = sub();
    return remember({ latex: `${mwrap(a)}\\times ${mwrap(b)}`, mp: `MMUL(${a.mp},${b.mp})`, angle: a.angle || b.angle, kids: [a, b], atom: false });
  }
  if (x < 0.4) {
    const s = leaf(r);
    const a = sub();
    return remember({ latex: `${wrap(s)}\\times ${mwrap(a)}`, mp: `SMUL(${s.mp},${a.mp})`, angle: a.angle, kids: [a], atom: false });
  }
  if (x < 0.48) {
    const a = sub();
    return remember({ latex: `${a.lit ? a.latex : `\\left(${a.latex}\\right)`}^{2}`, mp: `MSQ(${a.mp})`, angle: a.angle, kids: [a], atom: false });
  }
  if (x < 0.56) return call("\\operatorname{tran}", "TRN", sub());
  if (x < 0.7) return call("\\operatorname{inv}", "INV", sub());
  if (x < 0.8) {
    const a = sub();
    return remember({ latex: `\\exponentialE^{${a.latex}}`, mp: `EXPM(${a.mp})`, angle: a.angle, kids: [a], atom: false });
  }
  if (x < 0.9) return call("\\sin", "SINM", sub(), true);
  return call("\\cos", "COSM", sub(), true);
}

/** A column of n scalar leaves (linsolve's right side, a product's right factor). */
function column(r: () => number, n: number): { latex: string; mp: string } {
  return pmatrix(Array.from({ length: n }, () => [leaf(r)]));
}

function mtop(r: () => number): MNode {
  const n = r() < 0.6 ? 2 : 3;
  const x = r();
  if (x < 0.45) return mbuild(r, 2, n);
  const a = mbuild(r, 1, n);
  if (x < 0.57) return call("\\operatorname{det}", "DET", a);
  if (x < 0.69) return call("\\operatorname{rank}", "RANK", a);
  const b = column(r, n);
  if (x < 0.81) return remember({ latex: `\\operatorname{linsolve}\\left(${a.latex},${b.latex}\\right)`, mp: `LINSOLVE(${a.mp},${b.mp})`, angle: a.angle, kids: [a], atom: true });
  return remember({ latex: `${mwrap(a)}\\times ${b.latex}`, mp: `MMUL(${a.mp},${b.mp})`, angle: a.angle, kids: [a], atom: false });
}

/** `count` matrix trees from `seed`, on an LCG stream of their own (the scalar trees of a seed stay as they were). */
export function generateMatrices(seed: number, count: number): Case[] {
  const r = lcg(seed * 7 + 797);
  return Array.from({ length: count }, () => caseOf(mtop(r)));
}

/** G798: matrix leaves for casback's laws (tools/probes/casback/check.ts), on a stream of their own: A and B of one size n, each a
 *  leaf as above (maybe singular, scaled, inside approx), and a column b of n scalar leaves. */
export function generateLawMatrices(seed: number, count: number): { n: 2 | 3; a: string; b: string; col: string }[] {
  const r = lcg(seed * 7 + 798);
  return Array.from({ length: count }, () => {
    const n = r() < 0.6 ? 2 : 3;
    return { n, a: mleaf(r, n).latex, b: mleaf(r, n).latex, col: column(r, n).latex };
  });
}

/** Matrix inputs found wrong by the owner-style hunt of 2026-11-23, in every run (with their digits; G790 needs Digits > 14). */
export const MATRIX_PINNED: (Case & { digits: 12 | 30 })[] = [
  // G790 (F475): approx([[1,2],[3,4]]/10^13)·[[1],[1]] was [[0],[0]]
  { latex: "\\operatorname{approx}\\left(\\frac{\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}}{10^{13}}\\right)\\times \\begin{pmatrix}1\\\\1\\end{pmatrix}", mp: "MMUL(APPROX(MDIV(MAT([[mpf('1'),mpf('2')],[mpf('3'),mpf('4')]]),POW(mpf('10'),mpf('13')))),MAT([[mpf('1')],[mpf('1')]]))", angle: false, digits: 30 },
  // G622: the inverse of a small float matrix, and the rank of a singular one (0 with =)
  { latex: "\\operatorname{inv}\\left(\\operatorname{approx}\\left(\\frac{\\begin{pmatrix}1&2&3\\\\4&5&6\\\\7&8&10\\end{pmatrix}}{10^{13}}\\right)\\right)", mp: "INV(APPROX(MDIV(MAT([[mpf('1'),mpf('2'),mpf('3')],[mpf('4'),mpf('5'),mpf('6')],[mpf('7'),mpf('8'),mpf('10')]]),POW(mpf('10'),mpf('13')))))", angle: false, digits: 12 },
  { latex: "\\operatorname{rank}\\left(\\operatorname{approx}\\left(\\begin{pmatrix}1&2&3\\\\4&5&6\\\\7&8&9\\end{pmatrix}\\right)\\right)", mp: "RANK(APPROX(MAT([[mpf('1'),mpf('2'),mpf('3')],[mpf('4'),mpf('5'),mpf('6')],[mpf('7'),mpf('8'),mpf('9')]])))", angle: false, digits: 12 },
  // G792: sin of a float matrix with imaginary noise
  { latex: "\\sin\\left(\\operatorname{approx}\\left(\\begin{pmatrix}0&1\\\\-1&0\\end{pmatrix}\\right)\\right)", mp: "SINM(APPROX(MAT([[mpf('0'),mpf('1')],[mpf('-1'),mpf('0')]])))", angle: true, digits: 12 },
  // G802 (F481, G797's nightly): the package input, and its division alone, which killed Home's engine (a float entry beside e
  // divided by a number overflowed the wasm stack; patch 0069)
  { latex: "\\exponentialE^{\\operatorname{approx}\\left(\\frac{\\begin{pmatrix}0.1&\\exponentialE&\\pi\\\\5&2&7\\\\\\exponentialE&7&9.81\\end{pmatrix}}{10^{4}}\\right)}", mp: "EXPM(APPROX(MDIV(MAT([[mpf('0.1'),E,PI],[mpf('5'),mpf('2'),mpf('7')],[E,mpf('7'),mpf('9.81')]]),POW(mpf('10'),mpf('4')))))", angle: false, digits: 30 },
  { latex: "\\frac{\\begin{pmatrix}0.1&\\exponentialE\\\\5&2\\end{pmatrix}}{10^{4}}", mp: "MDIV(MAT([[mpf('0.1'),E],[mpf('5'),mpf('2')]]),POW(mpf('10'),mpf('4')))", angle: false, digits: 12 },
];
