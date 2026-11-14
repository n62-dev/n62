// SPDX-License-Identifier: GPL-3.0-or-later
// G212: a Home row keeps the stored variables its input read (the engine's HomeResult.uses) as `defsUsed`, the session
// line's `defs`; `uses` stays a CAS row's, the one the history draws under a row (History.svelte), so no screen changes.
// On the real engine in this thread, behind the port and the worker protocol, as libraryValues.engine.test.ts runs it.
import { describe, expect, it } from "vitest";
import { EngineCalc } from "../calc/engine.ts";
import { createRequestHandler } from "../engine/host.ts";
import { giacAvailable, loadNodeGiac } from "../engine/nodeGiac.ts";
import type { Request, Response } from "../engine/protocol.ts";
import { WorkerEngine, type WorkerLike } from "../engine/workerEngine.ts";
import { fakeKv } from "./fakeKv.ts";
import { Session } from "./session.svelte.ts";
import { sessionLine } from "./sessionLine.ts";
import { restoredItem } from "./storedItem.ts";

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

const O = { t: new Date(Date.UTC(2026, 10, 14)), app: "0.0.0" };

describe.skipIf(!giacAvailable())("G212: Home rows list the stored values they read (real Giac)", () => {
  it("a+1 after a:=5 keeps a with its preview and view; sin(1) keeps none; nothing is set on `uses`", { timeout: 30_000 }, async () => {
    const calc = new EngineCalc(new WorkerEngine({ createWorker: () => new InProcessWorker() }));
    const s = new Session(calc, fakeKv());
    await s.submit("a:=5", "a:=5");
    await s.submit("a+1", "a+1");
    await s.submit("\\sin\\left(1\\right)", "sin(1)");
    const [set, read, none] = s.home;
    expect(read?.text).toBe("6");
    expect(read?.defsUsed).toEqual([{ name: "a", preview: "5", view: "home" }]);
    expect(read?.uses).toBeUndefined(); // the history draws `uses`: a Home row's list is not drawn
    expect(set?.defsUsed).toBeUndefined();
    expect(none?.status).toBe("done");
    expect(none?.defsUsed).toBeUndefined();
    expect(JSON.parse(sessionLine(read!, O)!).defs).toEqual([{ name: "a", preview: "5", view: "home" }]);
    expect(JSON.parse(sessionLine(none!, O)!).defs).toBeUndefined();
    expect(restoredItem({ ...read! }, 1).defsUsed).toEqual(read!.defsUsed); // kept across a store round trip
  });
});
