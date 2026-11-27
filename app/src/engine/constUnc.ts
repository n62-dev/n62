// SPDX-License-Identifier: GPL-3.0-or-later
// G26 (deep-dive item 17): the digits a constant's uncertainty leaves. A Home input may hold constants as names
// (`pasc_<id>`, R40's parser switch) with a table of their values and CODATA standard uncertainties. The values are
// put in and the input evaluates as before; then the first-order σ of the result (G18's rule, units/evaluate.ts):
// σ = sqrt(Σ (∂f/∂xᵢ · σᵢ)²) over independent inputs, exactly with Giac's diff at their values. G81: inexact
// constants whose bases (G80: the value over the measured leaves it is computed from, `pasl_<leaf>`) share a leaf are
// correlated (μ₀, ε₀ and Z₀ share α): they enter as their bases, the value is evaluated through them (μ₀·ε₀·c² is
// exactly 1) and σ is taken over the leaves; any other constant is an input of its own with its value, as before.
// `uncDigits` is the number of significant digits of the shown value before the digit position of σ's first digit:
// the digits from there on are uncertain. Synchronous, UI-free. Only erasable TypeScript syntax.
import { decimalFromString, decimalToString, isZero, roundSignificant, type DecimalValue } from "./format.ts";
import { toExactLiterals } from "./exactLiterals.ts";
import type { HomeResult } from "./homeEval.ts";
import type { Giac } from "./numeric.ts";
import { isTimeout, mapNames, names, splitList } from "./giacPrint.ts";
import { basisGiac, basisOf, correlated, isZeroText, LEAF_PREFIX } from "./constBasis.ts";
import type { UncTerm, ValueFacts } from "./types.ts";
import { CONST_PREFIX } from "./ourNames.ts";

/** A constant the input holds by name: its value as Giac text (`6.67430E-11`), and its standard uncertainty in the
 *  same unit (`0.00015E-11`), absent or zero when the constant is exact. Keyed by the id after `pasc_`. */
export interface ConstEntry {
  value: string;
  unc?: string;
  /** G86: the facts the constant carries (R69 reads them), set only by `constTable` (from `constFacts`). `unc` alone
   *  decides whether the constant is inexact; these facts are read, never trusted over it. */
  facts?: ValueFacts;
  /** G81 (from Find's item, G80): the value over `pasl_<leaf>` names and exact numbers; inexact constants only. */
  basis?: string;
  /** G81: the leaves `basis` uses, each with its value and standard uncertainty. */
  basisLeaves?: Readonly<Record<string, { value: string; unc: string }>>;
}
export type ConstTable = Readonly<Record<string, ConstEntry>>;

/** The prefix of a constant sent by name (one home: ourNames.ts). */
export { CONST_PREFIX };


/** An inexact constant has a nonzero uncertainty text (the one rule; constFacts states it as facts). */
function inexact(e: ConstEntry | undefined): e is ConstEntry & { unc: string } {
  return e?.unc !== undefined && !isZeroText(e.unc);
}

/** The facts a constant carries (G86), from its uncertainty: exact when it has none (or zero); else not exact, its
 *  digits not limited by the agreement check, and `inexact` (never `=`, decisions M4-4). */
export function constFacts(e: ConstEntry): ValueFacts {
  return !inexact(e) ? { exact: true, reliableDigits: null } : { exact: false, reliableDigits: null, inexact: true };
}

/** A constant table with every entry carrying its facts (G86): where a table is built (the golden sequences, G49). */
export function constTable(entries: Readonly<Record<string, ConstEntry>>): ConstTable {
  return Object.fromEntries(Object.entries(entries).map(([id, e]) => [id, { ...e, facts: constFacts(e) }]));
}

/** G81: the inexact constants `ids` of `table` that enter through their basis (they share a leaf, constBasis.ts). */
function throughBasis(table: ConstTable, ids: readonly string[]): Set<string> {
  return correlated(ids.map((id) => [id, table[id]!] as const));
}

/**
 * `input` with every constant of `table` replaced by its value in brackets; when `keep` is given, the constants it
 * holds stay names. Names not in the table are left alone. G81: a constant that shares a leaf with another of the
 * input is replaced by its basis, its leaves as their values, or as `pasl_<leaf>` names when `leaves` is "names" (σ).
 */
export function withConstValues(input: string, table: ConstTable, keep?: ReadonlySet<string>, leaves: "values" | "names" = "values"): string {
  const through = throughBasis(table, inexactConstsIn(input, table));
  return mapNames(input, ({ name }) => {
    const id = name.slice(CONST_PREFIX.length);
    const e = name.startsWith(CONST_PREFIX) && id !== "" && Object.hasOwn(table, id) ? table[id] : undefined;
    if (!e || keep?.has(id)) return null;
    const b = through.has(id) ? basisOf(e) : undefined;
    if (b === undefined) return `(${e.value})`;
    // a leaf of zero uncertainty is its value in both modes, as in the unit view (constBasis.ts basisGiac)
    return `(${basisGiac(e, b, (l, v) => (leaves === "names" ? `${LEAF_PREFIX}${l}` : `(${v.value})`))})`;
  }, "typed");
}

/** The inexact constants of `table` that `input` holds, in order of first appearance. */
export function inexactConstsIn(input: string, table: ConstTable): string[] {
  const ids: string[] = [];
  for (const { name } of names(input, "typed")) {
    const id = name.slice(CONST_PREFIX.length);
    if (name.startsWith(CONST_PREFIX) && id !== "" && !ids.includes(id) && Object.hasOwn(table, id) && inexact(table[id])) ids.push(id);
  }
  return ids;
}

/** An independent input of σ: a Giac name, its value and its standard uncertainty (R61: a chip's too, chipFacts.ts). */
export interface SigmaInput {
  name: string;
  value: string;
  unc: string;
  /** G274: the input's key in the terms (the unit view's UncVar.key): a constant's id, `pasl_<leaf>`, `pasr_<k>`; the name when absent. */
  key?: string;
}

/** G81: the independent inputs of the inexact constants `ids`: a constant that enters through its basis brings its
 *  uncertain leaves, each once (the first constant that names a leaf gives its numbers; every basis comes from the
 *  same index); any other is one input (`keep` gets its id). */
function sigmaInputs(table: ConstTable, ids: readonly string[]): { keep: Set<string>; inputs: SigmaInput[] } {
  const keep = new Set<string>();
  const inputs: SigmaInput[] = [];
  const through = throughBasis(table, ids);
  for (const id of ids) {
    const e = table[id]!;
    const b = through.has(id) ? basisOf(e) : undefined;
    if (b === undefined) {
      keep.add(id);
      inputs.push({ name: `${CONST_PREFIX}${id}`, value: e.value, unc: e.unc!, key: id });
      continue;
    }
    basisGiac(e, b, (l, leaf) => {
      const name = `${LEAF_PREFIX}${l}`;
      if (!inputs.some((v) => v.name === name)) inputs.push({ name, value: leaf.value, unc: leaf.unc });
      return name;
    });
  }
  return { keep, inputs };
}

/** The first-order σ of `body` as its inputs and, for each, the Giac text of `∂f/∂xᵢ · σᵢ` (decimals as exact rationals):
 *  over the constants themselves, or over their leaves where they share one (G81). `ids` are `body`'s (inexactConstsIn).
 *  `extra` (R61): more independent inputs whose names `body` holds (a chip's σ). `relative` (G550): `∂ln f/∂xᵢ · σᵢ`
 *  instead, after `normal` (σᵢ over f: Psi·Gamma/Gamma is Psi, which a double evaluates where Gamma overflows it). */
function sigmaParts(body: string, table: ConstTable, ids: readonly string[], extra: readonly SigmaInput[], relative = false): { inputs: SigmaInput[]; shares: string[] } {
  const { keep, inputs: own } = sigmaInputs(table, ids);
  const inputs = [...own, ...extra];
  if (!inputs.length) return { inputs, shares: [] };
  const f = toExactLiterals(withConstValues(body, table, keep, "names"));
  const at = `[${inputs.map((v) => `${v.name}=(${toExactLiterals(v.value)})`).join(",")}]`;
  const d = (v: SigmaInput): string => (relative ? `normal(diff(ln(${f}),${v.name}))` : `diff(${f},${v.name})`);
  return { inputs, shares: inputs.map((v) => `(subst(${d(v)},${at})*(${toExactLiterals(v.unc)}))`) };
}

/** The Giac text of the first-order σ of `body` over the inexact constants `ids` (see sigmaParts). */
export function sigmaExpr(body: string, table: ConstTable, ids: readonly string[], extra: readonly SigmaInput[] = []): string {
  const { shares } = sigmaParts(body, table, ids, extra);
  return shares.length ? `sqrt(${shares.map((p) => `${p}^2`).join("+")})` : "0";
}

/** Significant digits of `value` shown at `digits` that lie before the position of σ's first digit (≥ 0). Null for
 *  a σ of zero (no digit is uncertain). A value of zero has no digit to keep: 0. */
export function uncDigitsOf(value: DecimalValue, sigma: DecimalValue, digits: number): number | null {
  if (isZero(sigma)) return null;
  if (isZero(value)) return 0;
  return Math.max(0, roundSignificant(value, digits).exp - sigma.exp);
}

/** How many names `freeName` tries for one of ours before it gives up (the name, then one more `_` each time). */
export const FREE_TRIES = 8;

/** R40 (family 9): `name`, or the first of `name_`, `name__`, … that `taken` does not hold, nor `used` (the other names
 *  of the same text); undefined after FREE_TRIES names. `taken` is the host's list of stored names (no Giac text read, P20). */
export function freeName(name: string, taken: (n: string) => boolean, used: ReadonlySet<string> = new Set()): string | undefined {
  let m = name;
  for (let i = 0; i < FREE_TRIES; i++, m += "_") if (!taken(m) && (m === name || !used.has(m))) return m;
  return undefined;
}

/** What constUncDigits found: σ with the digits it leaves (and G274's terms), or (G550) `lost`: σ inputs went in and σ
 *  could not be carried (no derivative, not one real number, no free name), which the row says (why.sigmaLost). */
export type SigmaOutcome = { uncDigits: number; uncSigma: string; uncTerms?: UncTerm[] } | { lost: true };

/** G550: the digits of σ's second try: Giac evaluates at 14 digits or fewer in doubles (numeric.ts DOUBLE_DIGITS, not
 *  imported: units/row.ts reads this module in the unit view's chunk). */
const DOUBLE_DIGITS = 14;

/** G550: |a·b| of two decimals, exactly (the relative σ times the value, which no double holds past 1E308). */
function timesAbs(a: DecimalValue, b: DecimalValue): DecimalValue {
  if (isZero(a) || isZero(b)) return { ...a, digits: "" };
  const e = a.exp + 1 - a.digits.length + (b.exp + 1 - b.digits.length);
  return decimalFromString(`${BigInt(a.digits) * BigInt(b.digits)}e${e}`)!;
}

/**
 * The `uncDigits` of a Home result computed from `body` (the input with its constants as names), with σ itself as
 * `uncSigma` (R40: the σ line): absent when no inexact constant of `table` is in it (nor an `extra` input, R61), when
 * the result is no number (a symbolic value, an error), or when σ is zero. G550: `lost` when σ inputs went in and σ
 * cannot be carried: the result is a list or not real, Giac cannot differentiate a function at the point (max, a call
 * left unevaluated), the budget ran out, or no free name for one of ours. σ is evaluated at 20 digits; when that is no
 * decimal (Giac leaves Psi of a multiprecision float unevaluated) the same text once more at double precision (σ shows
 * two digits), and then its relative form (sigmaParts) times |value|, for a value past the double's range (W!). No
 * text is read for which function failed (P20): any result that is not a decimal falls back.
 * `taken` (R40, family 9; P20): whether a name holds a user's value, from the host's own lists (the state read, the
 * definitions log, the input's own store), never from Giac's text. A user's variable named as one of our leaves or
 * constants (`pasl_fine_structure:=5`) would be read for it inside diff, so each such name is renamed to a free one
 * (freeName); when none is free, σ is lost rather than a wrong one.
 */
export function constUncDigits(
  giac: Giac,
  body: string,
  table: ConstTable,
  r: HomeResult,
  digits: number,
  extra: readonly SigmaInput[] = [],
  taken: (name: string) => boolean = () => false,
): SigmaOutcome | undefined {
  const ids = inexactConstsIn(body, table);
  if ((!ids.length && !extra.length) || !r.ok || (!r.value && !r.items)) return undefined;
  if (!r.value || r.items || !isZero(r.value.im)) return { lost: true };
  const value = r.value.re;
  let got: { sigma: DecimalValue; terms?: UncTerm[] } | null | undefined;
  const tries: [boolean, number, number][] = [[false, 20, 30], [false, DOUBLE_DIGITS, DOUBLE_DIGITS], ...(isZero(value) ? [] : [[true, DOUBLE_DIGITS, DOUBLE_DIGITS] as [boolean, number, number]])];
  for (const [relative, p, q] of tries) {
    got = sigmaAt(giac, sigmaParts(body, table, ids, extra, relative), p, q, taken);
    if (got === undefined) return { lost: true };
    if (!got) continue;
    if (relative) got = { sigma: timesAbs(got.sigma, value), ...(got.terms ? { terms: got.terms.map((t) => scaledTerm(t, value)) } : {}) };
    break;
  }
  if (!got) return { lost: true };
  const n = uncDigitsOf(value, got.sigma, digits);
  if (n === null) return undefined;
  const out = { uncDigits: n, uncSigma: decimalToString(got.sigma) };
  return got.terms ? { ...out, uncTerms: got.terms } : out;
}

/** G550: a relative term (t and uy over f², |f|) times the value: t·v², uy·|v|. */
function scaledTerm(t: UncTerm, v: DecimalValue): UncTerm {
  const uy = timesAbs(decimalFromString(t.uy)!, v);
  return { key: t.key, t: decimalToString(timesAbs(timesAbs(decimalFromString(t.t)!, v), v)), uy: decimalToString(uy) };
}

/** σ of the shares `parts` evaluated with σ at `p` digits and G274's terms at `q` (none when they are not decimals): null
 *  when Giac gives no decimal σ (or an error), undefined when it timed out or one of our names has no free name. */
function sigmaAt(giac: Giac, parts: { inputs: SigmaInput[]; shares: string[] }, p: number, q: number, taken: (name: string) => boolean): { sigma: DecimalValue; terms?: UncTerm[] } | null | undefined {
  const { inputs, shares } = parts;
  // G274: two or more inputs: one call gives σ from the exact sum (as one input's) and each share's t and uy, the
  // shares evaluated once; one input says nothing a σ does not
  const many = shares.length > 1;
  const raw = !shares.length ? "0" : many ? `(pasL_->[evalf(sqrt(add(map(pasL_,pasx_->pasx_^2))),${p}),map(pasL_,pasx_->[evalf(pasx_^2,${q}),evalf(abs(pasx_),${q})])])([${shares.join(",")}])` : `sqrt(${shares[0]}^2)`;
  const used = new Set([...names(raw, "typed")].map((n) => n.name));
  let stuck = false;
  const expr = mapNames(raw, ({ name }) => {
    if (!name.startsWith(LEAF_PREFIX) && !name.startsWith(CONST_PREFIX)) return null;
    const m = freeName(name, taken, used);
    if (m === undefined) stuck = true;
    return m ?? name;
  }, "typed");
  if (stuck) return undefined;
  const out = giac.eval(many ? expr : `evalf(${expr},${p})`);
  // a time-out is not tried again (each try would wait for Home's clock): σ is lost
  if (isTimeout(out)) return undefined;
  if (out.startsWith("GIAC_ERROR")) return null;
  const list = many ? splitList(out) : [out];
  const sigma = list?.length === 2 || !many ? decimalFromString(list![0]!) : null;
  if (!sigma) return null;
  if (!many) return { sigma };
  const terms = termsOf(inputs, list![1]!);
  return terms ? { sigma, terms } : { sigma };
}

/** G274: `[[t, uy], …]` as Giac printed it, one pair per input, each a decimal, as terms keyed by the input's key; undefined
 *  when it is not that. */
function termsOf(inputs: readonly SigmaInput[], list: string): UncTerm[] | undefined {
  const rows = splitList(list)?.map(splitList);
  if (rows?.length !== inputs.length) return undefined;
  const terms: UncTerm[] = [];
  for (const [i, row] of rows.entries()) {
    const t = row?.length === 2 ? decimalFromString(row[0]!) : null;
    const uy = row?.length === 2 ? decimalFromString(row[1]!) : null;
    if (!t || !uy) return undefined;
    const v = inputs[i]!;
    terms.push({ key: v.key ?? v.name, t: decimalToString(t), uy: decimalToString(uy) });
  }
  return terms;
}
