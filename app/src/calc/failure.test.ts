// SPDX-License-Identifier: GPL-3.0-or-later
// G315: the Calc port speaks its own errors. EngineCalc turns the engine's error classes into a CalcFailure with its kind
// (and a Cancel into CalcCancelled), so the session reads the port and never engine/types.ts.
import { describe, expect, it } from "vitest";
import { EngineCalc } from "./engine.ts";
import { CalcCancelled, CalcFailure, type CalcSettings } from "./port.ts";
import { EngineCancelled, EngineCrashError, EngineLoadError, EngineMemoryError, type MathEngine } from "../engine/types.ts";

/** A MathEngine whose every call rejects with `e` (only the calls the port makes here). */
const rejecting = (e: unknown): MathEngine =>
  ({
    ready: () => Promise.reject(e),
    home: () => Promise.reject(e),
    cas: () => Promise.reject(e),
    unknowns: () => Promise.reject(e),
    definitions: () => Promise.reject(e),
  }) as unknown as MathEngine;

const S: CalcSettings = { digits: 12, angle: "rad", format: "std" };

describe("EngineCalc rejects with the port's own errors (G315)", () => {
  const cases: [string, unknown, CalcFailure["kind"]][] = [
    ["out of memory", new EngineMemoryError("oom"), "memory"],
    ["a crash", new EngineCrashError("Maximum call stack size exceeded"), "crashed"],
    ["a failed load", new EngineLoadError("no wasm"), "load"],
    ["any other error", new RangeError("x"), "engine"],
    ["a thrown string", "RuntimeError: unreachable", "engine"],
  ];
  for (const [name, e, kind] of cases)
    it(`${name} is a CalcFailure of kind "${kind}" from every call`, async () => {
      const c = new EngineCalc(rejecting(e));
      for (const call of [() => c.ready(), () => c.home("1+1", S), () => c.cas("1+1", S), () => c.unknowns(["x=1"]), () => c.names()]) {
        const got = await (call() as Promise<unknown>).then(() => null, (x: unknown) => x);
        expect(got).toBeInstanceOf(CalcFailure);
        expect((got as CalcFailure).kind).toBe(kind);
      }
    });

  it("a Cancel is CalcCancelled, as before", async () => {
    const c = new EngineCalc(rejecting(new EngineCancelled()));
    await expect(c.home("1+1", S)).rejects.toBeInstanceOf(CalcCancelled);
    await expect(c.unknowns(["x=1"])).rejects.toBeInstanceOf(CalcCancelled);
  });
});
