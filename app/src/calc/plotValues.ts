// SPDX-License-Identifier: GPL-3.0-or-later
// R361: the Plot's read of the stored names Function definitions use, behind the Calc port, posted by the Function
// app's chunk itself (as calc/matrices.ts does, so the start chunk carries none of it): by definition's Giac text, the
// names its tree reads (R361f1), each with its kind and a variable's value, σ and unit (engine/plotValues.ts). An
// engine without a worker (the fake engine) has none.
import type { MathEngine } from "../engine/types.ts";
import type { WorkerEngine } from "../engine/workerEngine.ts";
import type { PlotValue } from "../engine/plotValues.ts";
import type { CalcSettings } from "./port.ts";

export type { PlotValue } from "../engine/plotValues.ts";

/** By text of `texts`, in that order, the names it reads as the engine holds them; none for each when `engine` has no
 *  worker. Rejects when the call fails (a Cancel, a crash). */
export async function readPlotValues(engine: MathEngine | undefined, texts: readonly string[], s: CalcSettings): Promise<PlotValue[][]> {
  if (!engine || !("call" in engine)) return texts.map(() => []);
  if (texts.length === 0) return [];
  // Home's settings as EngineCalc sends them (the word once set), so the host sees Home's own mode key: no mode change.
  const store = await import("../state/cycleForms.ts").then((m) => m.wordStore.restore().then(() => m.wordStore));
  const r = await (engine as WorkerEngine).call({ type: "plotValues", texts: [...texts], settings: store.home(s) });
  if (r.type !== "plotValues") throw new Error(`unexpected ${r.type}`);
  return r.result;
}
