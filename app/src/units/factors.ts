// SPDX-License-Identifier: GPL-3.0-or-later
// The factor table of the unit view (P15, docs/04 4.2): from the Find index, each unit's exact SI factor (`si`) and
// dimension (`dim`), each prefix's power of ten (or of two), each constant's value, uncertainty and dimension. Built
// once when the unit view first evaluates, never in the start chunk. Plain TS.
import type { IndexItem } from "../find/types.ts";
import type { UnitSlot } from "./types.ts";

export interface UnitFactor {
  /** Exact factor to SI base units (p/q, with pi where needed); "a+b" for °C and °F (K = a·x + b); absent when the
   *  index has none (G13 adds them). */
  si?: string;
  /** Dimension key ("kg1m1s-2"); absent when qalc gives no conversion to SI base units. */
  dim?: string;
  /** What a message calls it ("°C", "hp"). */
  symbol: string;
  /** G369: a ratio (%, ‰, ppm, ppb), the index's `ratio`: it drops out of the shown unit beside another unit. */
  ratio?: true;
}

export interface ConstFactor {
  /** Exact decimal text with every digit ("299792458", "6.67430E-11"). */
  value: string;
  /** Standard uncertainty (CODATA); absent when the value is exact. */
  unc?: string;
  /** G81: an inexact constant's basis over `pasl_<leaf>` names and its leaves (the Find item's, G80). */
  basis?: string;
  basisLeaves?: Readonly<Record<string, { value: string; unc: string }>>;
  dim?: string;
  symbol: string;
  /** G801: the index's `ownUnit` as slot tokens (J·s), each a unit of factor exactly 1. */
  own?: UnitSlot;
}

/** G801: an index `ownUnit` ("J*K^-1") as slot tokens: each id with its power, none below a ÷. */
export function ownSlot(text: string): UnitSlot {
  return { tokens: text.split("*").map((p) => { const [unit, power] = p.split("^"); return { unit: unit!, ...(power !== undefined ? { power } : {}) }; }) };
}

export interface FactorTable {
  units: ReadonlyMap<string, UnitFactor>;
  prefixes: ReadonlyMap<string, { si: string; symbol: string }>;
  consts: ReadonlyMap<string, ConstFactor>;
}

/** The symbol a unit's or prefix's chip shows (`\unit{oC}{\mathrm{°C}}` → °C), else the item's first name. A chip with
 *  LaTeX in it (Wh: `W\cdot\,h`) gives the first name instead, never the LaTeX (R62: a result reads "Wh"). */
function symbolOf(it: IndexItem): string {
  const m = /\{\\mathrm\{([^{}]+)\}\}$/.exec(it.insert ?? "");
  const name = it.names[0] ?? it.id.slice(it.id.indexOf(":") + 1);
  // G369: % is \% in LaTeX
  const sym = m ? m[1]!.replaceAll("\\%", "%") : undefined;
  return sym !== undefined && !sym.includes("\\") ? sym : name;
}

/** A Find id without its kind ("unit:m" → "m"). */
export const bare = (id: string): string => id.slice(id.indexOf(":") + 1);

/** G233: the first character of a unit of your own's id (units/userUnits.ts), a character no Find id holds. Kept for good
 *  from the first release: stored rows hold it. Here, not in userUnits.ts: the builder (build.ts) reads it too. */
export const OWN_PREFIX = "@";
export const isOwnId = (id: string): boolean => id.startsWith(OWN_PREFIX);

export function factorTable(items: readonly IndexItem[]): FactorTable {
  const units = new Map<string, UnitFactor>();
  const prefixes = new Map<string, { si: string; symbol: string }>();
  const consts = new Map<string, ConstFactor>();
  for (const it of items) {
    if (it.kind === "unit") units.set(bare(it.id), { ...(it.si ? { si: it.si } : {}), ...(it.dim !== undefined ? { dim: it.dim } : {}), symbol: symbolOf(it), ...(it.ratio ? { ratio: true as const } : {}) });
    else if (it.kind === "pfx" && it.si) prefixes.set(bare(it.id), { si: it.si, symbol: symbolOf(it) });
    else if (it.kind === "const" && it.value)
      consts.set(bare(it.id), {
        value: it.value,
        ...(it.unc ? { unc: it.unc } : {}),
        // G81: basisOf (engine/constBasis.ts) reads them only for an inexact constant with every leaf it names
        basis: it.basis,
        basisLeaves: it.basisLeaves,
        ...(it.dim !== undefined ? { dim: it.dim } : {}),
        symbol: symbolOf(it),
        ...(it.ownUnit !== undefined ? { own: ownSlot(it.ownUnit) } : {}),
      });
  }
  return { units, prefixes, consts };
}
