// SPDX-License-Identifier: GPL-3.0-or-later
// R361 (owner, 2026-11-16; decisions.md "R258"): the Plot draws a definition that reads a stored real value (`A·x²` after
// 3 ▶ A) at the value the engine gave for it (engine/plotValues.ts, bridge-3's parts): a value with σ at its central
// value, a value with a unit at its number, each named in a note under the board; any other value (complex, a list, a
// matrix, an expression with a free name) or a name with none is not drawn, and the note says why. The drawing is a
// picture (D7): Num, trace and the readouts stay the engine's. User functions (`f(x)` from Home) stay undrawn, silent.
import type { PlotValue } from "../../engine/plotValues.ts";
import type { NameValues } from "../../input/emit-js.ts";
import { numText } from "../../i18n/enNum.ts";
import { shownWithUncertainty } from "../../units/uncertainty.ts";

/** A name drawn at `value` (σ and unit as its entry holds them), or not drawn and why. */
export type NameRead = { value: number; sigma?: string; unit?: string } | { why: "notReal" | "noValue" };

/** How the Plot draws the name the engine read as `v` (absent: the engine gave nothing for it). */
export function nameRead(v: PlotValue | undefined): NameRead {
  if (!v || v.kind !== "var") return { why: "noValue" };
  if (v.re === undefined || v.im !== 0 || !Number.isFinite(v.re)) return { why: "notReal" };
  return { value: v.re, ...(v.sigma ? { sigma: v.sigma } : {}), ...(v.unit ? { unit: v.unit } : {}) };
}

/** R361f1: the names a slot reads as the Plot asks of them, from the engine's answer for its Giac text; a stored user
 *  function is left out (undrawn, silent). */
export function usesOf(answer: readonly PlotValue[]): string[] {
  return answer.filter((v) => v.kind !== "fn").map((v) => v.name);
}

/** The values to compile with: each name read as a real. */
export function drawValues(reads: ReadonlyMap<string, NameRead>): NameValues {
  const out = new Map<string, number>();
  for (const [n, r] of reads) if ("value" in r) out.set(n, r.value);
  return out;
}

/** The note line for name `name` of slot `slot` (`drawn`: the slot has a curve), or none when it says nothing. `mark`
 *  writes a number with the decimal mark of the settings; `num` writes the drawn-at value as the app shows a number
 *  (R361f1: its digits and decimal mark, app.svelte.ts fmtX). */
export function noteOf(slot: string, name: string, r: NameRead, drawn: boolean, mark: (s: string) => string, num: (s: string) => string): string | undefined {
  if ("why" in r) return numText("plot.storedNot", { slot, name, why: numText(r.why === "notReal" ? "plot.whyNotReal" : "plot.whyNoValue") });
  if (!drawn || (!r.sigma && !r.unit)) return undefined;
  const value = num(String(r.value));
  if (!r.sigma) return numText("plot.storedUnit", { slot, name, unit: r.unit ?? "", value });
  const shown = mark(shownWithUncertainty(String(r.value), r.sigma, String(r.value)) ?? `${r.value} ± ${r.sigma}`);
  return r.unit ? numText("plot.storedSigmaUnit", { slot, name, shown, unit: r.unit, value }) : numText("plot.storedSigma", { slot, name, shown, value });
}
