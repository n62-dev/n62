// SPDX-License-Identifier: GPL-3.0-or-later
// R61 (r17 section 2, docs/04 4.3 "The way back"): the chip a unit result gives. It carries the number in the unit
// shown (not SI: the label and the value agree), with the facts Home's chip rule gives it (state/results.ts, R65: exact
// when an exact text exists and no σ or inexact constant went in, whatever the mark), σ in the same unit, and the unit
// as its label and slot. Home has no units (P8): the unit never reaches the arithmetic. Pure; only erasable TypeScript.
import { isZeroText } from "../engine/constBasis.ts";
import type { Chip } from "../input/chips.ts";
import { chipOf, FULL_LIMIT } from "../state/results.ts";
import { homeItem } from "../state/resultItem.ts";
import { isUnitError, type Quantity, type UnitError } from "./types.ts";

/** The chip of a unit result; undefined for a refusal, or a value or σ with no chip text (as Home's: insert as drawn). */
export function quantityChip(q: Quantity | UnitError): Chip | undefined {
  if (isUnitError(q)) return undefined;
  // a σ (an uncertain input or a constant with one, G18) or a value flagged inexact (G49) went in
  const inexact = q.unc !== undefined || q.value.facts.inexact === true;
  const item = homeItem(q.value, inexact);
  const chip = chipOf({ status: "done", ...item });
  if (!chip) return undefined;
  // R271f1: the value's facts (so the chip's) already hold a σ chip's limit (evaluate.ts done); σ itself goes in with
  // its confirmed digits only (its `full`, evaluate.ts uncertainty), and with its facts, which the unit view gives σ
  // again (view.ts request)
  const limit = q.unc?.chip;
  const sigma = q.unc?.value.full;
  if (q.unc && (!q.unc.value.ok || !sigma || sigma.length > FULL_LIMIT)) return undefined;
  if (sigma !== undefined && !isZeroText(sigma)) Object.assign(chip, { unc: sigma }, limit ? { uncFacts: limit } : {});
  // the loader keeps a unit text of up to 40 characters (input/chips.ts validChips)
  // G782: a pure number in a unit (%, rev: dimension key "") keeps it too: Home and CAS take a ratio's pure number
  // (input/ratioChip.ts) and say any other unit was dropped
  if (q.unit !== "" && q.unit.length <= 40 && q.dimension !== null && q.shownSlot) chip.unit = { text: q.unit, dim: q.dimension, slot: q.shownSlot };
  return chip;
}

/** R353: the chip Store ▶ in the unit view stores: `chip` when it carries the unit and the σ the result shows (`unit`, as
 *  Quantity.unit; `unc`, σ's text when there is one), else undefined, so the bare number is never stored in its place
 *  (quantityChip leaves the unit out for no shown slot or a unit text over 40 characters; a σ of 0 is dropped there). */
export function storeChip(chip: Chip | undefined, unit: string, unc?: { text: string }): Chip | undefined {
  // (G782: a ratio chip's unit has no dimension key, which a stored name's unit needs, G371: not stored, as before G782)
  if (!chip || (unit !== "" && !chip.unit?.dim)) return undefined;
  return unc && !isZeroText(unc.text) && chip.unc === undefined ? undefined : chip;
}

