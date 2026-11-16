// SPDX-License-Identifier: GPL-3.0-or-later
// R361: the Plot's read of the stored names a Function definition uses, behind the Calc port, posted by the Function
// app's chunk itself (as calc/matrices.ts does, so the start chunk carries none of it): each name's kind and a
// variable's value, σ and unit (engine/plotValues.ts). An engine without a worker (the fake engine) has none.
import type { MathEngine } from "../engine/types.ts";
import type { WorkerEngine } from "../engine/workerEngine.ts";
import type { PlotValue } from "../engine/plotValues.ts";
import type { CalcSettings } from "./port.ts";

export type { PlotValue } from "../engine/plotValues.ts";

/** `names` as the engine holds them, in that order; none when `engine` has no worker. Rejects when the call fails (a
 *  Cancel, a crash). */
export async function readPlotValues(engine: MathEngine | undefined, names: readonly string[], s: CalcSettings): Promise<PlotValue[]> {
  if (!engine || !("call" in engine) || names.length === 0) return [];
  // Home's settings as EngineCalc sends them (the word once set), so the host sees Home's own mode key: no mode change.
  const store = await import("../state/cycleForms.ts").then((m) => m.wordStore.restore().then(() => m.wordStore));
  const r = await (engine as WorkerEngine).call({ type: "plotValues", names: [...names], settings: store.home(s) });
  if (r.type !== "plotValues") throw new Error(`unexpected ${r.type}`);
  return r.result;
}
