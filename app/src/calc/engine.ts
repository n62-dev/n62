// SPDX-License-Identifier: GPL-3.0-or-later
// The Calc port on top of gorge's MathEngine (app/src/engine). The only place the views meet it.
import {
  EngineCancelled,
  EngineCrashError,
  EngineLoadError,
  EngineMemoryError,
  type AnalysisRequest,
  type AnalysisResult,
  type CasResult,
  type HomeResult,
  type MathEngine,
  type SolveOutcome,
  type SolveRequest,
  type TableRequest,
} from "../engine/types.ts";
import { WorkerEngine } from "../engine/workerEngine.ts";
import { userNamesOf } from "../engine/defs.ts";
import { mark } from "../marks.ts";
import { CalcCancelled, CalcFailure, type Calc, type CalcSettings, type ChipFactsTable, type ConstTable, type CasOutcome, type HomeOutcome, type Quantity, type UnitError, type UnitRequest, type UserName } from "./port.ts";
import type { IndexItem } from "../find/types.ts";
import type { WordStore } from "../state/wordStore.svelte.ts";

export interface EngineCalcOptions {
  /** The Find index's items, for the unit view's factor table (docs/04 4.2); read on the first units() call. Absent:
   *  Find's own index, loaded by the lazy units/calc.ts (R24c: so the start chunk holds no loader). */
  findIndex?: () => Promise<readonly IndexItem[]>;
}

export class EngineCalc implements Calc {
  /** Read by code that loads later and posts its own requests (R59: calc/library.ts); the views use the port's calls. */
  readonly engine: MathEngine;
  private readonly findIndex: (() => Promise<readonly IndexItem[]>) | undefined;
  constructor(engine: MathEngine = new WorkerEngine(), o: EngineCalcOptions = {}) {
    this.engine = engine;
    this.findIndex = o.findIndex;
  }

  async ready(): Promise<{ safeStart?: { skipped: number } }> {
    const t = await mapCancel(this.engine.ready());
    // measurement builds only (marks.ts): what tools/device_run.py reads as instantiateMs, initMs and replayMs
    mark("engine-timings", { instantiateMs: t.instantiateMs, initMs: t.initMs, replayMs: t.replayMs, readyMs: t.readyMs });
    return t.safeStart ? { safeStart: t.safeStart } : {};
  }

  home(giac: string, s: CalcSettings, chips?: ChipFactsTable, consts?: ConstTable): Promise<HomeOutcome> {
    // an absent table is not sent (WorkerEngine.home); the session sends `consts` only when the input holds one (R40)
    // G211: each outcome says the word its request carried (WordStore.stamp, in the lazy chunk)
    // R930: what passes of the result is calc/portKeys.ts, in the word store's chunk this call waits for anyway
    const r = this.word().then(([w, m]) => w.stamp(this.engine.home(giac, w.home(s), consts, chips && Object.keys(chips).length ? chips : undefined).then(m.passHome)));
    return mapCancel(r);
  }

  cas(giac: string, s: CalcSettings): Promise<CasOutcome> {
    return mapCancel(this.word().then(([w, m]) => w.stamp(this.engine.cas(giac, w.cas(s)).then(m.passCas))));
  }

  solve(req: SolveRequest, s: CalcSettings): Promise<SolveOutcome> {
    return mapCancel(this.word().then(([w]) => this.engine.solve(req, w.home(s))));
  }

  unknowns(equations: string[]): Promise<string[]> {
    return mapCancel(this.engine.unknowns(equations));
  }

  analyze(req: AnalysisRequest, s: CalcSettings): Promise<AnalysisResult> {
    return mapCancel(this.word().then(([w]) => this.engine.analyze(req, w.home(s))));
  }

  table(req: TableRequest, s: CalcSettings): Promise<HomeResult[][]> {
    return mapCancel(this.word().then(([w]) => this.engine.table(req, w.home(s))));
  }

  units(req: UnitRequest, s: CalcSettings): Promise<Quantity | UnitError> {
    // The builder and the factor table load with the unit view, never in the start chunk (docs/04 4.4).
    return mapCancel(Promise.all([import("../units/calc.ts"), this.word()]).then(([m, [w]]) => m.evaluateUnits(this.engine, this.findIndex, req, w.home(s))));
  }

  /** R194: the settings of every request (Home's, CAS's) come from the lazy word store (state/wordStore.svelte.ts, in the
   *  base forms' chunk, whose name the start chunk lists already): the defaults, the digits and angle, and the word size and
   *  sign the short forms shl, bnot… read (engine/wordOps.ts), once it was read. Nothing of the defaults stays in the start chunk. */
  private word(): Promise<[WordStore, Pick<typeof import("./portKeys.ts"), "passHome" | "passCas">]> {
    return import("../state/cycleForms.ts").then((m) => m.wordStore.restore().then(() => [m.wordStore, m]));
  }

  async names(): Promise<UserName[]> {
    return userNamesOf(await mapCancel(this.engine.definitions()));
  }

  async cancel(): Promise<void> {
    await this.engine.cancel();
  }
}

/** `p` with the engine's errors in the port's words (G315): a Cancel is CalcCancelled, every other rejection a CalcFailure
 *  of its kind (the engine's error as its cause). */
async function mapCancel<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    throw calcError(e);
  }
}

const calcError = (e: unknown): CalcCancelled | CalcFailure =>
  e instanceof EngineCancelled
    ? new CalcCancelled()
    : new CalcFailure(e instanceof EngineMemoryError ? "memory" : e instanceof EngineCrashError ? "crashed" : e instanceof EngineLoadError ? "load" : "engine", e);
