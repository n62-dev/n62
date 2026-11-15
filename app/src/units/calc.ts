// SPDX-License-Identifier: GPL-3.0-or-later
// Calc.units() behind the lazy import (G16): the factor table is built from the Find index once per index source, on
// the first call; the request is built into a job here, on the main thread, and only a job reaches the engine. The app's
// index source is Find's own (loaded here, so nothing of it is in the start chunk; R24c); tests pass theirs to EngineCalc.
// G233: the units of your own (`own`) are rows added to Find's table for the call (userUnits.ts mergedTable). G234: without
// `own` they are read from the stamped store (`units.own`, ownUnits.ts), once, with the first call.
import type { HomeSettings, MathEngine } from "../engine/types.ts";
import type { IndexItem } from "../find/types.ts";
import { loadIndex } from "../find/finder.ts";
import { buildJob } from "./build.ts";
import { factorTable, type FactorTable } from "./factors.ts";
import type { Quantity, UnitError, UnitRequest } from "./types.ts";
import { ownUnits } from "./ownUnits.ts";
import { mergedTable, type UnitDef } from "./userUnits.ts";

type IndexSource = () => Promise<readonly IndexItem[]>;

/** The app's Find index (docs/04 4.2): the same fetch as Find's (finder.ts imported here, not dynamically: the builder
 *  then holds no preload list for it, 0.3 kB raw). */
const appIndex: IndexSource = () => loadIndex(true).then((ix) => ix.items);

const tables = new WeakMap<IndexSource, Promise<FactorTable>>();

export async function evaluateUnits(engine: MathEngine, from: IndexSource | undefined, req: UnitRequest, s: HomeSettings, own?: readonly UnitDef[]): Promise<Quantity | UnitError> {
  const load = from ?? appIndex;
  let pending = tables.get(load);
  if (!pending) tables.set(load, (pending = load().then(factorTable)));
  let table: FactorTable;
  try {
    table = await pending;
  } catch (e) {
    tables.delete(load); // the next call tries again
    return { error: "engine", detail: `the Find index did not load: ${e instanceof Error ? e.message : String(e)}` };
  }
  let defs: readonly UnitDef[] | undefined = own;
  if (defs === undefined) {
    await ownUnits.restore();
    defs = ownUnits.list();
  }
  const job = buildJob(req, mergedTable(table, defs));
  return "error" in job ? job : engine.units(job, s);
}
