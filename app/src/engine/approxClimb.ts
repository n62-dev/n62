// SPDX-License-Identifier: GPL-3.0-or-later
// G404 fix round 2: CAS's approx or evalf of a value finite only higher up the agreement check's climb
// (evalf(ln(1-tanh(50))): 1-tanh(50) is 0 at P, so Giac's answer is -infinity). novalue.ts approxRange finds its bare
// value; here it is evaluated as Home evaluates it (homeEval.ts runs the bare input again): decided again with the climb
// (decisions.ts decideTwice), its facts from the climb (doubleElements.ts climbedFacts), and the slot keeps the number
// with its confirmed digits (homeEval.ts confirmedFloat).
// Runs synchronously next to the engine; only erasable TypeScript syntax.
import { complexSafe } from "./complex.ts";
import { decideTwice, nonRealArg, restsOnDecision } from "./decisions.ts";
import { climbedFacts } from "./doubleElements.ts";
import { confirmedFloat, resultFromFacts, type HomeResult } from "./homeEval.ts";
import { defaultHomeSettings } from "./homeDefaults.ts";
import { exactFacts, isAudited, notBuiltin, shapeOfValue, valuePrecision, whyOf, withDigits, type Giac } from "./numeric.ts";

/**
 * The numeric result of the bare value `bare` (decimals exact) at `digits`, the setting's Digits `setDigits` put back:
 * run in `slot` at P and, when it rests on a decision, decided again with the climb as Home decides it (Giac writes
 * ln((tanh(100)-1)^2) as 2*ln(tanh(100)-1) at P, where tanh(100)-1 is 0); its facts from the climb, then `slot` holds its
 * confirmed digits as a float (an assignment stores that). A decision that did not hold is ⚠ "decided", and so is one
 * made on an input whose value Home would not have asked at P (G358: unaudited functions); "undecided" when Home refuses
 * it so. `pastReach` with Giac's text when the climb cannot reach it (1/(1-tanh(5000)), novalue.ts finiteLevel): `slot`
 * keeps the bare value, shown ⚠ with the cap's words. The facts from P when the value is finite there (the asked digits
 * may set a P above the one approxRange asked at), else from the climb. Null when the value is no scalar or neither
 * gives facts.
 */
export function approxClimbed(giac: Giac, slot: string, bare: string, digits: number, setDigits: number, ms: number): HomeResult | { pastReach: string } | "undecided" | null {
  const P = valuePrecision(digits);
  let text = withDigits(giac, P, setDigits, () => giac.eval(`${slot}:=(${bare})`)).trim();
  let decided = false;
  if (restsOnDecision(bare, "typed", text, notBuiltin(giac), nonRealArg(giac, P))) {
    const d = decideTwice(giac, bare, text, digits, setDigits, true);
    if ("undecided" in d && d.refused) return "undecided";
    decided = "undecided" in d || !isAudited(bare, "typed") || complexSafe(bare, "typed") !== bare;
    if (!("undecided" in d) && d.from !== undefined) {
      giac.eval(`${slot}:=${d.from};purge(${d.from})`);
      text = d.text;
    }
  }
  const value = giac.value(slot, []);
  if (shapeOfValue(value)?.kind !== "scalar") return null;
  // finite at P already (evalf(ln(1-tanh(50)),38): -infinity at Digits 38, a number at its P = 48): the check from P, as
  // homeEval.ts reads exactFacts first and climbs only when they find none
  const facts =
    exactFacts(giac, slot, { kind: "scalar" }, digits, defaultHomeSettings.maxExactDigits, text, value) ??
    climbedFacts(giac, slot, text, value, digits, defaultHomeSettings.maxExactDigits, () => false);
  if (facts === "pastReach") return { pastReach: text };
  if (!Array.isArray(facts)) return null;
  const r = resultFromFacts(facts, { kind: "scalar" }, digits, "numeric", true, ms);
  const why = decided ? { ...(whyOf(facts, bare) ?? {}), decided: true } : whyOf(facts, bare);
  const kept = confirmedFloat(r, P);
  if (kept) giac.eval(`${slot}:=${kept.float}`);
  const marked = decided ? { ...r.facts, exact: false, reliableDigits: null, warn: "unchecked" as const } : r.facts;
  return { ...r, facts: why ? { ...marked, why } : marked, ...(kept ? { full: kept.text } : {}), ...(digits !== setDigits ? { digits } : {}) };
}
