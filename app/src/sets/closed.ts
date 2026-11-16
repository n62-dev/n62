// SPDX-License-Identifier: GPL-3.0-or-later
// G276: a set's step as one closed expression over the set's inputs. A step built on another step is never given the
// other's result as a chip: R61 makes a chip an independent input, so two operands sharing an input would lose their
// correlation and σ would be wrong either way (L = 2 ± 0.01: L² then ·L gives σ 0.089 for the true 0.12). Each step it
// reads is written out in full instead, and each input once, as the unit view's keyed `pasupm(value,sigma,pasr_<i>)`,
// one input however often it appears (units/build.ts uncertainValues). No change to the builder: a request in, the
// builder and the injected evaluator as for the unit view. UI-free, no user string; only erasable TypeScript syntax.
import { mapNames, names, unbracket } from "../engine/giacPrint.ts";
import { CHIP_PREFIX } from "../engine/ourNames.ts";
import { buildJob } from "../units/build.ts";
import type { FactorTable } from "../units/factors.ts";
import { isUnitError, type Quantity, type UnitError, type UnitJob, type UnitRequest } from "../units/types.ts";
import { isSetError, stepOrder, type FormulaSet, type SetError } from "./model.ts";

/** The longest closed text sent to the engine: a step that reads the one before twice doubles it, so an untrusted set of
 *  forty such steps would otherwise build a text of 2⁴⁰ characters. */
export const MAX_CLOSED = 100_000;

/** A refusal of the builder or the evaluator for the step asked for (the closed text has no other step to blame);
 *  `input` names the input a °C, °F or level unit of the refusal came from. */
export type StepError = UnitError & { step: string; input?: string };

/** The evaluator of a job: the worker's (Calc.units) or, in tests, EngineHost.units. */
export type Evaluate = (job: UnitJob) => Quantity | UnitError | Promise<Quantity | UnitError>;

/**
 * The unit view's request for step `stepName` of `set`: the step's text with each step it reads replaced by that step's
 * own closed text in brackets, and each input by `(pasupm(value,sigma,pasr_<i>)*pasu<j>)` (`i` its place in the set's
 * inputs from 1, so one key per input), `(value*pasu<j>)` without σ, without `*pasu<j>` when it has no unit. Only the
 * inputs the closed text reads get a slot, in the set's order (the builder refuses a slot not in the formula). The end
 * slot is the asked step's own; the steps it reads keep theirs for when they are asked. stepOrder's refusals come back.
 */
export function closedRequest(set: FormulaSet, stepName: string): UnitRequest | SetError {
  const order = stepOrder(set);
  if (isSetError(order)) return order;
  const byName = new Map(set.steps.map((s) => [s.name, s]));
  const asked = byName.get(stepName);
  if (!asked) return { error: "nostep", step: stepName };
  // the steps the asked one reads, at any depth (stepOrder refused a call of one and every cycle)
  const needed = new Set([stepName]);
  for (const todo = [stepName]; todo.length; ) {
    for (const n of names(byName.get(todo.pop()!)!.expr, "typed")) {
      if (!n.call && byName.has(n.name) && !needed.has(n.name)) {
        needed.add(n.name);
        todo.push(n.name);
      }
    }
  }
  // each needed step over the inputs alone, in stepOrder's order, so a step's own reads are closed before it
  const closed = new Map<string, string>();
  for (const name of order) {
    if (!needed.has(name)) continue;
    const expr = byName.get(name)!.expr;
    // the text's length before it is built: the expr, and for each read of a step that step's text in brackets in place of its name
    let length = expr.length;
    for (const n of names(expr, "typed")) if (!n.call && closed.has(n.name)) length += closed.get(n.name)!.length + 2 - n.name.length;
    if (length > MAX_CLOSED) return { error: "long", step: stepName };
    const text = mapNames(expr, (n) => (!n.call && closed.has(n.name) ? `(${closed.get(n.name)!})` : null), "typed");
    if (text.length > MAX_CLOSED) return { error: "long", step: stepName };
    closed.set(name, text);
  }
  const over = closed.get(stepName)!;
  const read = new Set([...names(over, "typed")].filter((n) => !n.call).map((n) => n.name));
  const slots: UnitRequest["slots"] = [];
  const written = new Map<string, string>();
  set.inputs.forEach((x, k) => {
    if (!read.has(x.name)) return;
    const value = x.sigma === undefined ? x.value : `pasupm(${x.value},${x.sigma},${CHIP_PREFIX}${k + 1})`;
    if (x.slot) slots.push(x.slot);
    written.set(x.name, x.slot ? `(${value}*pasu${slots.length})` : `(${value})`);
  });
  // unbracketed: the builder takes a °C, °F or level value only when it is the whole formula
  const formula = unbracket(mapNames(over, (n) => (n.call ? null : written.get(n.name) ?? null), "typed"), "typed");
  return { formula, slots, ...(asked.end ? { end: asked.end } : {}) };
}

/** The input read by `req` whose unit the builder's refusal names (`unit`, a symbol): the °C, °F or level unit it takes
 *  only alone. */
function inputOf(set: FormulaSet, req: UnitRequest, why: UnitError, table: FactorTable): string | undefined {
  if (why.error !== "temperature" && why.error !== "logarithmic" && why.error !== "minus") return undefined;
  const named = (x: FormulaSet["inputs"][number]): boolean => x.slot !== undefined && req.slots.includes(x.slot) && x.slot.tokens.some((t) => table.units.get(t.unit)?.symbol === why.unit);
  return set.inputs.find(named)?.name;
}

/**
 * Step `stepName` of `set` run as the unit view runs a formula: closedRequest, the builder with `table` (Find's factors),
 * then `evaluate`. A refusal of the builder (no job runs) or of the evaluator comes back with the step named, the
 * builder's °C, °F or level refusal with the input too.
 */
export async function runStep(set: FormulaSet, stepName: string, table: FactorTable, evaluate: Evaluate): Promise<Quantity | StepError | SetError> {
  const req = closedRequest(set, stepName);
  if (isSetError(req)) return req;
  const job = buildJob(req, table);
  if (isUnitError(job)) {
    const input = inputOf(set, req, job, table);
    return { ...job, step: stepName, ...(input !== undefined ? { input } : {}) };
  }
  const q = await evaluate(job);
  return isUnitError(q) ? { ...q, step: stepName } : q;
}
