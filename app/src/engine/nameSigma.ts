// SPDX-License-Identifier: GPL-3.0-or-later
// G371 (night review 2026-11-14, lo-1 and fh-3; r19 "Named values"): a name stored from a result keeps what the result's
// chip carries. The store records, beside its mark facts, the σ of the value (`uncDigits`, `uncSigma`) and, from a unit
// result's chip, its unit (defs.ts NameUnit); a Home input that reads such a name takes its σ as a chip's (R61, G355:
// an independent input of σ, chipFacts.ts chipSigma), at the value Giac holds under the name. A missing fact claims
// nothing: an entry stored before G371 has neither. Synchronous, UI-free. Only erasable TypeScript syntax.
import type { DefChange, DefEntry, NameUnit } from "./defs.ts";
import type { ChipFactsTable } from "./chipFacts.ts";
import type { SigmaInput } from "./constUnc.ts";
import type { ValueFacts } from "./types.ts";
import { isZeroText } from "./constBasis.ts";
import { mapNames } from "./giacPrint.ts";
import { CHIP_PREFIX } from "./ourNames.ts";

/** The free symbol a stored name with σ is in the σ expression (its own name holds its value during the run). */
const SIGMA_PREFIX = "pasn_";

/** The σ a stored variable's entry holds, when it is a nonzero one. */
function storedSigma(e: DefEntry | undefined): string | undefined {
  const u = e?.kind === "var" ? e.facts?.uncSigma : undefined;
  return u !== undefined && !isZeroText(u) ? u : undefined;
}

/** The names of `read` (the stored variables an input read, host.ts usesOf) whose entry holds a nonzero σ, except
 *  `target` (a store to a name its own right side reads: Giac holds the new value by the time σ is taken). */
export function sigmaNamesIn(read: readonly string[], byName: ReadonlyMap<string, DefEntry>, target?: string): string[] {
  return [...new Set(read)].filter((n) => n !== target && storedSigma(byName.get(n)) !== undefined);
}

/** `body` for σ (constUnc.ts sigmaExpr): each of `names` (sigmaNamesIn's) as a free symbol, an independent input with
 *  the value Giac holds under the name and its stored σ. Calls of a name are left alone. */
export function nameSigma(body: string, names: readonly string[], byName: ReadonlyMap<string, DefEntry>): { body: string; inputs: SigmaInput[] } {
  if (!names.length) return { body, inputs: [] };
  const inputs: SigmaInput[] = names.map((n) => ({ name: SIGMA_PREFIX + n, value: n, unc: storedSigma(byName.get(n))!, key: SIGMA_PREFIX + n }));
  return { body: mapNames(body, ({ name, call }) => (!call && names.includes(name) ? SIGMA_PREFIX + name : null), "typed"), inputs };
}

/** The unit a store's right side `rhs` (as it ran, chips by name) carries: a unit result's chip alone, or a stored name
 *  that holds one, alone (in brackets or not); none for anything else (Home has no units: `chip × 2` is a number). */
export function unitOfStore(rhs: string, chips: ChipFactsTable, byName: ReadonlyMap<string, DefEntry>): NameUnit | undefined {
  let t = rhs.trim();
  while (t.startsWith("(") && t.endsWith(")")) t = t.slice(1, -1).trim();
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(t)) return undefined;
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
