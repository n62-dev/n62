// SPDX-License-Identifier: GPL-3.0-or-later
// G217: Copy as Python, σ through uncertainties. N62's σ always includes the second-order term (GUM 5.1.2 with its note,
// units/evaluate.ts); uncertainties propagates to first order. The two agree on a formula affine in its uncertain inputs,
// and N62 sets `why` only when the second-order share of σ² passes 0.1, so a row with no `why` can still differ by
// about 5 %: the note goes on every row whose formula is not affine, read from the tree (never from `why`). Lazy: reached
// only through clipboard/python.ts.
import type { Json } from "../input/emit.ts";
import { unitText } from "../i18n/enUnits.ts";

/** The note on a row whose formula is not affine in its uncertain inputs. */
export const SIGMA_NOTE = "(N62's σ includes the second-order term; uncertainties is first-order)";

/** An uncertain input of a unit row's tree: the parser's `pasupm(value, σ[, key])` (G18, R115, R271). */
export const isUncertain = (e: Json): boolean => Array.isArray(e) && e[0] === "Call" && e[1] === "pasupm";

/**
 * How `e` (a unit row's tree, whose heads uSer allows) depends on its uncertain inputs: 0 not at all, 1 affinely, 2
 * otherwise. A product is affine when one factor at most holds one, a quotient when its denominator holds none, a
 * power only when its exponent is 1 and holds none.
 * A head not listed here counts as not affine whenever it holds an input: the note is then never missing.
 */
export function affinity(e: Json): 0 | 1 | 2 {
  if (isUncertain(e)) return 1;
  if (!Array.isArray(e)) return 0;
  const parts = (e.slice(1) as Json[]).map(affinity);
  const most = Math.max(0, ...parts) as 0 | 1 | 2;
  if (most !== 1) return most;
  switch (e[0]) {
    case "Add":
    case "Subtract":
    case "Negate":
    case "Delimiter":
      return 1;
    case "Multiply":
      return parts.filter((p) => p > 0).length > 1 ? 2 : 1;
    case "Divide":
    case "Rational":
      return parts[1] === 0 ? 1 : 2;
    case "Power": {
      const ex = e[2] as Json;
      const one = typeof ex === "object" && !Array.isArray(ex) && "num" in ex && ex.num === "1";
      return parts[1] === 0 && one ? 1 : 2;
    }
    default:
      return 2;
  }
}

/** The text after N62's answer on a σ row: N62's ⚠ reason for a `why` of `jump` or `singular` (order2 is what the
 *  note says), then the note when the formula is not affine; "" when neither. */
export function sigmaTail(why: string | null | undefined, affine: boolean): string {
  const reason = why === "jump" ? unitText("units.why.jump") : why === "singular" ? unitText("units.why.singular") : undefined;
  return `${reason ? ` ⚠ ${reason}` : ""}${affine ? "" : ` ${SIGMA_NOTE}`}`;
}

/** A chip's value or σ as a Python number (a float in a σ row): a decimal or a quotient of whole numbers, else undefined. */
export function floatText(text: string): string | undefined {
  const v = text.trim();
  return /^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(v) || /^-?\d+\/\d+$/.test(v) ? v : undefined;
}
