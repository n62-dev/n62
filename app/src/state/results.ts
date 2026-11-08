// SPDX-License-Identifier: GPL-3.0-or-later
// G86: the one rule that turns an engine result into what a history item keeps of it (docs/04 2.8): the chip text
// `full`, whether it is exact (`fullExact`), the text drawn when it differs (`drawn`), the value and its facts, and the
// chip a finished item gives. Pure TypeScript, no runes: the session (state/session.svelte.ts) and the golden runner
// (goldenRun.ts, run by Node) both call it, so the gate checks the app's own rule. Only erasable TypeScript syntax.
import type { ChipFactsTable } from "../engine/chipFacts.ts";
import type { ComplexValue } from "../engine/format.ts";
import type { ValueFacts } from "../engine/types.ts";
import { RATIONAL } from "../engine/giacPrint.ts";
import type { Chip, ChipTable } from "../input/chips.ts";
import type { Rational, ResultFacts } from "./displayMode.ts";

/** A chip carries at most this much text (docs/04 2.8); a longer result is inserted as it is drawn. */
export const FULL_LIMIT = 2048;
/** A numeric list or matrix keeps its elements in the history (to re-format it); beyond this the item shows no mark. */
export const ITEMS_LIMIT = 400;
/** Rows a view's history keeps (in memory and stored); the oldest go first. */
export const HISTORY_LIMIT = 200;

/** A plain integer or fraction text as a Rational; undefined for anything else (or a zero denominator). */
export function rationalOf(text: string | undefined): Rational | undefined {
  const m = text === undefined ? null : RATIONAL.exec(text.trim());
  if (!m || m[1] === undefined || (m[2] !== undefined && BigInt(m[2]) === 0n)) return undefined;
  return { n: m[1], d: m[2] ?? "1" };
}

/** What the rule reads of a result's facts: its ValueFacts, and a list's or matrix's elements. */
export interface FactsSource {
  facts: ValueFacts;
  items?: readonly { value?: ComplexValue; facts: ValueFacts }[];
  shape?: [number, number];
  digits?: number;
  /** G109: a list of Giac's list type (drawn and copied with braces). */
  braces?: true;
}
/** A Home result as the rule reads it (HomeOutcome of the port, HomeResult of the engine). */
export interface HomeIn extends FactsSource {
  ok: boolean;
  display: string;
  approximate: boolean;
  value?: ComplexValue;
  exact?: string;
  full: string;
}
/** A CAS result as the rule reads it (CasOutcome of the port, CasResult of the engine). */
export interface CasIn {
  ok: boolean;
  text: string;
  full?: string;
  approximate?: boolean;
  facts: ValueFacts;
  numeric?: HomeIn;
}

/** What a history item keeps of a result; a field that is absent is not set on the item. */
export interface ItemResult {
  approximate: boolean;
  value?: ComplexValue;
  facts?: ResultFacts;
  rational?: Rational;
  /** The chip value (docs/04 2.8): the exact text, or the confirmed decimal (R65). */
  full?: string;
  fullExact?: boolean;
  /** The text drawn when it differs from `full` (G46f1); Copy gives it. */
  drawn?: string;
}

/** What chipOf reads of a history item. */
export interface ChipSource {
  status: string;
  full?: string;
  fullExact?: boolean;
  facts?: ValueFacts;
}

/** The chip a finished result gives when it is tapped, picked or read as Ans (docs/04 2.8); undefined: insert it as
 *  drawn. */
export function chipOf(item: ChipSource): Chip | undefined {
  if (item.status !== "done" || item.full === undefined) return undefined;
  if (item.fullExact === true) return { value: item.full, exact: true };
  // R65 (deep check D1): a chip that is not exact carries the facts it was shown with, so the next line keeps them
  const f = item.facts;
  return { value: item.full, exact: false, ...(f ? { reliableDigits: f.reliableDigits } : {}), ...(f?.warn ? { warn: f.warn } : {}) };
}

/** The chips an input holds by name (`pasr_<k>`), as the engine takes them (G49): the value and the facts. */
export function chipFactsOf(named: ChipTable): ChipFactsTable {
  const out: Record<string, ChipFactsTable[string]> = {};
  for (const [k, c] of Object.entries(named))
    out[k] = { value: c.value, reliableDigits: c.reliableDigits ?? null, exact: c.exact, ...(c.warn ? { warn: c.warn } : {}), ...(c.unc !== undefined ? { unc: c.unc } : {}) };
  return out;
}

/** R63f1: Home's number of a unit row with its ± σ and unit after it (units/row.ts UnitRow: `latex` drawn, `text` for
 *  Copy as shown and the row's data-text). Both are read back unchecked, so one that is not a string adds nothing.
 *  `comma`: the decimal comma's rewrite (displayMode.ts commaResult), in comma mode. */
export function withUnit(
  r: { text: string; latex: string },
  u: { text?: unknown; latex?: unknown },
  comma?: (s: string, latex: boolean) => string,
): { text: string; latex: string } {
  const add = (s: unknown, latex: boolean): string => (typeof s !== "string" ? "" : comma ? comma(s, latex) : s);
  return { text: r.text + add(u.text, false), latex: r.latex + add(u.latex, true) };
}
