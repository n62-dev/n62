// SPDX-License-Identifier: GPL-3.0-or-later
// R361 (owner, 2026-11-16; decisions.md "R258"): what the Function app's Plot needs to draw a definition that reads a
// stored name (`A·x²` after 3 ▶ A): each name's kind from the definitions log (host.ts byName) and, for a variable, its
// value as bridge-3's numeric parts (re, im of evalf at P digits), with the σ and unit G371 keeps in its entry. Never
// from Giac's print of the name (P20: no text read of a value's kind). The drawing is a picture (D7): Num, trace and
// the readouts stay the engine's. Runs in the worker in Home's mode (host.ts plotValues); the client is
// calc/plotValues.ts. Only erasable TypeScript syntax.
import type { DefEntry, DefKind } from "./defs.ts";
import type { DecimalValue } from "./format.ts";
import { isZeroText } from "./constBasis.ts";
import { isName } from "./giacPrintStart.ts";
import { partValue, type Giac } from "./numeric.ts";

/** One name a definition reads, as the Plot draws it. */
export interface PlotValue {
  readonly name: string;
  /** The log's kind of the name; "none" when the log holds no entry for it (a free name). */
  readonly kind: DefKind | "none";
  /** A variable whose value is one number: its real and imaginary parts (bridge-3's at[P], as doubles). Absent for any
   *  other value (a list, a matrix, an expression with a free name). */
  readonly re?: number;
  readonly im?: number;
  /** G371: the nonzero σ its entry holds, as stored (Giac's decimal text). */
  readonly sigma?: string;
  /** G371: the unit its value is in (NameUnit.text, as shown). */
  readonly unit?: string;
}

/** A value kind whose single evalf is a number to draw with. */
const NUMBER_KINDS: ReadonlySet<string> = new Set(["integer", "rational", "float", "complex", "symbolic"]);

const toNumber = (v: DecimalValue): number => (v.digits === "" ? 0 : Number(`${v.neg ? "-" : ""}0.${v.digits}e${v.exp + 1}`));

/** The names of `names` as the log holds them, each read once, in that order; a variable's value read at `prec` digits. */
export function readPlotValues(giac: Giac, names: readonly string[], byName: ReadonlyMap<string, DefEntry>, prec: number): PlotValue[] {
  const out: PlotValue[] = [];
  for (const name of new Set(names)) {
    if (!isName(name, true)) continue;
    const e = byName.get(name);
    if (!e) {
      out.push({ name, kind: "none" });
      continue;
    }
    if (e.kind !== "var") {
      out.push({ name, kind: e.kind });
      continue;
    }
    const sigma = e.facts?.uncSigma !== undefined && !isZeroText(e.facts.uncSigma) ? e.facts.uncSigma : undefined;
    const own = { name, kind: e.kind, ...(sigma ? { sigma } : {}), ...(e.unit ? { unit: e.unit.text } : {}) };
    const v = giac.value(name, [prec]);
    const at = NUMBER_KINDS.has(v.kind) ? v.at?.[String(prec)] : undefined;
    const parts = at?.length === 1 ? at[0]!.map((t) => partValue(t, 17)) : undefined;
    out.push(parts?.[0] && parts[1] ? { ...own, re: toNumber(parts[0]), im: toNumber(parts[1]) } : own);
  }
  return out;
}
