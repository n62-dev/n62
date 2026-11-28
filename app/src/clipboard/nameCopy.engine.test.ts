// SPDX-License-Identifier: GPL-3.0-or-later
// R815: a stored name's full value as Copy writes it (clipboard/nameCopy.ts), on the real engine in this thread (as
// views/libraryValues.engine.test.ts runs it). Expected values derived: 1/3 = 0.333… (40 digits); 7+3*i exact; the list as Giac keeps it.
import { describe, expect, it } from "vitest";
import { EngineCalc } from "../calc/engine.ts";
import { createRequestHandler } from "../engine/host.ts";
import { giacAvailable, loadNodeGiac } from "../engine/nodeGiac.ts";
import type { Request, Response } from "../engine/protocol.ts";
import type { DefEntry } from "../engine/defs.ts";
import { WorkerEngine, type WorkerLike } from "../engine/workerEngine.ts";
import type { Session } from "../state/session.svelte.ts";
import { definitionText, nameCopy } from "./nameCopy.ts";

class InProcessWorker implements WorkerLike {
  onmessage: ((ev: { data: Response }) => void) | null = null;
  onerror: ((ev: { message?: string }) => void) | null = null;
  terminated = false;
  private handle = createRequestHandler(
    () => loadNodeGiac(),
    (r) => setTimeout(() => !this.terminated && this.onmessage?.({ data: r }), 0),
  );
  postMessage(msg: Request): void {
    setTimeout(() => void this.handle(msg), 0);
  }
  terminate(): void {
    this.terminated = true;
  }
}

const settings = { digits: 12, angle: "rad", format: "std", fixDecimals: 4 } as const;

describe("R815: definitionText", () => {
  it("writes := as =, keeps a command without it, turns a stand-in into its letter", () => {
    expect(definitionText("f(x):=x^2+1")).toBe("f(x)=x^2+1");
    expect(definitionText("assume(x>0)")).toBe("assume(x>0)");
    expect(definitionText("f(x):=2*i_*x")).toBe("f(x)=2*i*x");
  });
});

describe.skipIf(!giacAvailable())("R815: nameCopy (real Giac)", () => {
  it("copies 1/3 in 40 digits, a complex, a list, a function, and says nothing for a name that is not stored", { timeout: 60_000 }, async () => {
    const calc = new EngineCalc(new WorkerEngine({ createWorker: () => new InProcessWorker() }));
    for (const s of ["A:=1/3", "Z:=1/3+i*2/7", "L:=list[1,2]", "f(x):=x^2+1"]) expect((await calc.home(s, settings)).ok).toBe(true);
    const session = { calc, settings } as unknown as Session;
    const third = "0." + "3".repeat(40);
    expect((await nameCopy(session, "A", {}))?.text).toBe(third);
    expect((await nameCopy(session, "A", { decimalComma: true }))?.text).toBe(third.replace(".", ","));
    expect((await nameCopy(session, "Z", {}))?.text).toBe(`${third}+0.${"285714".repeat(6)}2857*i`); // 2/7 = 0.285714 285714 …, 40 digits
    expect((await nameCopy(session, "L", {}))?.text).toBe("{1,2}");
    expect((await nameCopy(session, "f", {}))?.text).toBe("f(x)=x^2+1");
    expect(await nameCopy(session, "nope", {})).toBeUndefined();
    // a name stored from the unit view (G371): the unit and σ after the value, σ at 2 digits as that row draws it
    const log = await calc.engine.definitions();
    const g = log.find((e) => e.name === "A") as DefEntry;
    const withUnit: DefEntry = { ...g, unit: { text: "m/s²", dim: "L1T-2", slot: {} }, facts: { exact: false, reliableDigits: 12, uncDigits: 3, uncSigma: "0.01" } };
    const spied = { ...calc, engine: { definitions: async () => [withUnit] }, home: calc.home.bind(calc) } as unknown as typeof calc;
    expect((await nameCopy({ calc: spied, settings } as unknown as Session, "A", {}))?.text).toBe(`${third} ± 0.010 m/s²`);
  });
});
