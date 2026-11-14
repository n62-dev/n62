// SPDX-License-Identifier: GPL-3.0-or-later
// R188: the matrix sheet's reads behind the Calc port, posted by the matrix sheet's chunk itself (as calc/library.ts
// does, so the start chunk carries none of it): which stored names hold a matrix, and a matrix's elements, through the
// bridge (engine/matrixRead.ts). An engine without a worker (the fake engine) has none: no matrix is listed.
import type { MatrixRead } from "../engine/matrixRead.ts";
import type { MathEngine } from "../engine/types.ts";
import type { WorkerEngine } from "../engine/workerEngine.ts";
import type { CalcSettings } from "./port.ts";

export type { Candidate, ElementTex, MatrixCell, MatrixRead } from "../engine/matrixRead.ts";

/** The names of `names` that hold a matrix, in that order (`cells`: with their elements; R189 `check`: the grid's store
 *  to check, engine/matrixRead.ts checkStore); none when `engine` has no worker. Rejects when the call fails (a Cancel,
 *  a crash). */
export async function readMatrices(engine: MathEngine | undefined, names: readonly string[], s: CalcSettings, cells: boolean | "typed", check?: string): Promise<MatrixRead[]> {
  if (!engine || !("call" in engine) || names.length === 0) return [];
  // Home's settings as EngineCalc sends them (the word once set), so the host sees Home's own mode key: no mode change.
  // The store loads with the base forms' chunk (as in calc/engine.ts), not in the start chunk.
  const store = await import("../state/cycleForms.ts").then((m) => m.wordStore.restore().then(() => m.wordStore));
  const settings = store.home(s);
  const r = await (engine as WorkerEngine).call({ type: "matrices", names: [...names], settings, cells, ...(check === undefined ? {} : { check }) });
  if (r.type !== "matrices") throw new Error(`unexpected ${r.type}`);
  return r.result;
}
