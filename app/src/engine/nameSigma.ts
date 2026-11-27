// SPDX-License-Identifier: GPL-3.0-or-later
// G371 (night review 2026-11-14, lo-1 and fh-3; r19 "Named values"): a name stored from a result keeps what the result's
// chip carries. The store records, beside its mark facts, the σ of the value (`uncDigits`, `uncSigma`) and, from a unit
// result's chip, its unit (defs.ts NameUnit); a Home input that reads such a name takes its σ as a chip's (R61, G355:
// an independent input of σ, chipFacts.ts chipSigma), at the value the name held before the input ran. A missing fact claims
// nothing: an entry stored before G371 has neither. Synchronous, UI-free. Only erasable TypeScript syntax.
import type { DefChange, DefEntry, NameUnit } from "./defs.ts";
import type { ChipFactsTable } from "./chipFacts.ts";
import type { SigmaInput } from "./constUnc.ts";
import type { StoredRead, ValueFacts } from "./types.ts";
import { isZeroText } from "./constBasis.ts";
import { isName, mapNames } from "./giacPrint.ts";
import { CHIP_PREFIX } from "./ourNames.ts";

/** The free symbol a stored name with σ is in the σ expression (its own name holds its value during the run). */
const SIGMA_PREFIX = "pasn_";

/** The σ a stored variable's entry holds, when it is a nonzero one. */
function storedSigma(e: DefEntry | undefined): string | undefined {
  const u = e?.kind === "var" ? e.facts?.uncSigma : undefined;
  return u !== undefined && !isZeroText(u) ? u : undefined;
}

/** A stored name with σ an input read, and its σ input (constUnc.ts): free symbol `pasn_<name>`. */
export interface NameSigmaInput {
  stored: string;
  input: SigmaInput;
}

/** The σ inputs of the stored names an input read (`reads`, host.ts valuesOf: Giac's text of each, taken before the
 *  input ran) whose entry holds a nonzero σ: each name's σ and value as they stood before the run, which may set the
 *  name again (`W:=W*2`, a program that stores W). */
export function nameSigmaInputs(reads: readonly StoredRead[], byName: ReadonlyMap<string, DefEntry>): NameSigmaInput[] {
  const out: NameSigmaInput[] = [];
  for (const r of reads) {
    const unc = storedSigma(byName.get(r.name));
    const name = SIGMA_PREFIX + r.name;
    if (unc !== undefined && !out.some((v) => v.stored === r.name)) out.push({ stored: r.name, input: { name, value: r.value, unc, key: name } });
  }
  return out;
}

/** The names whose entry `defs` (a run's changes) sets or purges. */
export function namesChanged(defs: readonly DefChange[]): Set<string> {
  return new Set(defs.flatMap((c) => ("purge" in c ? c.purge : [c.set.name])));
}

/** `body` for σ (constUnc.ts sigmaExpr): each name of `named` (nameSigmaInputs') as its free symbol, an independent
 *  input with the value and σ the name held before the run. Calls of a name are left alone. G550: `through`, the names
 *  of `named` the body does not hold, and `reached` (sigmaThrough's): their σ is not carried. */
export function nameSigma(body: string, named: readonly NameSigmaInput[], reached: readonly string[] = []): { body: string; inputs: SigmaInput[]; through: string[] } {
  const names = named.map((v) => v.stored);
  const held = new Set<string>();
  const out = names.length ? mapNames(body, ({ name, call }) => (!call && names.includes(name) ? (held.add(name), SIGMA_PREFIX + name) : null), "typed") : body;
  const through = [...new Set([...names.filter((n) => !held.has(n)), ...reached])];
  return { body: out, inputs: named.map((v) => v.input), through };
}

/** G550: the run `out` with why.sigmaLost naming `lost` (the σ inputs whose σ the result does not carry: a stored name,
 *  `pasc_<id>`, `pasr_<k>`) and its σ facts dropped (a σ without them would be too small); the variable `stored` sets
 *  is not checked either (`warn: "unchecked"`), so a read of it is ⚠ too, never a bare value. `out` as it is when
 *  `lost` is empty. */
export function withSigmaLost<R extends { facts: ValueFacts }>(out: { result: R; defs: DefChange[] }, lost: readonly string[], stored?: string): { result: R; defs: DefChange[] } {
  if (!lost.length) return out;
  const { uncDigits: _d, uncSigma: _s, ...facts } = out.result.facts;
  const defs = out.defs.map((c) => {
    if (stored === undefined || !("set" in c) || c.set.kind !== "var" || c.set.name !== stored) return c;
    const f = c.set.facts ?? { exact: false, reliableDigits: null };
    return { set: { ...c.set, facts: { ...f, exact: false, warn: f.warn ?? ("unchecked" as const) } } };
  });
  return { result: { ...out.result, facts: { ...facts, why: { ...(facts.why ?? {}), sigmaLost: [...lost] } } }, defs };
}

/** The unit a store's right side `rhs` (as typed, chips by name) carries: a unit result's chip alone, or a stored name
 *  that holds one, alone; none for anything else (Home has no units: `chip × 2` is a number). */
export function unitOfStore(rhs: string, chips: ChipFactsTable, byName: ReadonlyMap<string, DefEntry>): NameUnit | undefined {
  const t = rhs.trim();
  if (!isName(t, true)) return undefined;
  const k = t.startsWith(CHIP_PREFIX) ? t.slice(CHIP_PREFIX.length) : undefined;
  if (k !== undefined) return Object.hasOwn(chips, k) ? chips[k]!.unit : undefined;
  const e = byName.get(t);
  return e?.kind === "var" ? e.unit : undefined;
}

/** `defs` with the variable `name`'s entry given the σ the store's result has (`unc`, constUnc.ts) and its `unit`;
 *  `defs` as it is when neither is there or no such entry was set. The facts it had are kept whole (X15's rule). */
export function withNameFacts(defs: DefChange[], name: string | undefined, unc: Pick<ValueFacts, "uncDigits" | "uncSigma"> | undefined, unit: NameUnit | undefined): DefChange[] {
  if (name === undefined || (!unc?.uncSigma && !unit)) return defs;
  return defs.map((c) => {
    if (!("set" in c) || c.set.kind !== "var" || c.set.name !== name) return c;
    const facts = unc?.uncSigma ? { ...(c.set.facts ?? { exact: false, reliableDigits: null }), ...(unc.uncDigits !== undefined ? { uncDigits: unc.uncDigits } : {}), uncSigma: unc.uncSigma } : c.set.facts;
    return { set: { ...c.set, ...(facts ? { facts } : {}), ...(unit ? { unit } : {}) } };
  });
}

/** G392: the stored variables an input reaches whose entry holds a unit (G371's DefEntry.unit), each once, in the order
 *  met: from `reads` (the names its tree reads) through `namesOf` (the names a stored value or function body holds,
 *  the closure facts.ts nameFacts walks), so a name reached only through a function is named too. Home has no units:
 *  the row says the unit was dropped (session.svelte.ts unitDropped). */
export function unitNamesOf(reads: readonly string[], byName: ReadonlyMap<string, DefEntry>, namesOf: (name: string) => readonly string[]): string[] {
  return reachedVars(reads, byName, namesOf, (e) => e.unit !== undefined);
}

/** G550: the stored variables with σ an input reaches through a stored value or function body (`f(2)` of `f(t):=W·t`
 *  reaches W), not as a name it reads itself: their σ is not carried (the σ body holds the input's own text). */
export function sigmaThrough(reads: readonly string[], byName: ReadonlyMap<string, DefEntry>, namesOf: (name: string) => readonly string[]): string[] {
  return reachedVars(reads.flatMap(namesOf), byName, namesOf, (e) => storedSigma(e) !== undefined);
}

/** The variables of `byName` that `pick` holds, reached from `start` through `namesOf`, each once, in the order met. */
function reachedVars(start: readonly string[], byName: ReadonlyMap<string, DefEntry>, namesOf: (name: string) => readonly string[], pick: (e: DefEntry) => boolean): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const queue = [...start];
  for (let n = queue.shift(); n !== undefined; n = queue.shift()) {
    if (seen.has(n)) continue;
    seen.add(n);
    const e = byName.get(n);
    if (!e || e.kind === "assume" || e.kind === "other") continue;
    if (e.kind === "var" && pick(e)) out.push(n);
    queue.push(...namesOf(n));
  }
  return out;
}
