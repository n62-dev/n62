// SPDX-License-Identifier: GPL-3.0-or-later
// R258: a named value of more than one letter from a library goes on the line as one name. The worked example of the
// format for your AI (aiFormat.md) defines g0:=980665/100000; Vars' insert of g0, read with the session's names as
// Home reads it, gives 9.80665 (derived from the definition), not g·0 = 0. On the real engine in this thread, as
// libraryJobs.engine.test.ts runs it.
import { describe, expect, it } from "vitest";
import { EngineCalc } from "../calc/engine.ts";
import { jobs } from "../calc/library.ts";
import { createRequestHandler } from "../engine/host.ts";
import { giacAvailable, loadNodeGiac } from "../engine/nodeGiac.ts";
import type { Request, Response } from "../engine/protocol.ts";
import { WorkerEngine, type WorkerLike } from "../engine/workerEngine.ts";
import { liveItem } from "../find/names.svelte.ts";
import { giacOfEntry } from "../input/entry.ts";
import { aiFormat, formatExample } from "./libraryJobs.ts";

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

const settings = { digits: 12, angle: "rad", format: "std" } as const;

describe.skipIf(!giacAvailable())("R258: a stored value of more than one letter (real Giac)", () => {
  it("the worked example's g0, inserted by Vars and read with the session's names, is 9.80665 in Home (derived)", { timeout: 30_000 }, async () => {
    const port = new EngineCalc(new WorkerEngine({ createWorker: () => new InProcessWorker() }));
    const calc = Object.assign(port, jobs(port.engine));
    const r = (await calc.importLibrary(formatExample(aiFormat()), false)).result;
    expect(r.ok).toBe(true);
    const names = await calc.names();
    const g0 = names.find((u) => u.name === "g0");
    expect(g0?.kind).toBe("var");
    const insert = liveItem(g0!).insert ?? "";
    const p = giacOfEntry(insert, "home", { names });
    expect(p.giac).toBe("g0");
    expect((await calc.home(p.giac, settings)).display).toBe("9.80665");
    // the same name in a product: 2·g0
    const two = giacOfEntry(`2${insert}`, "home", { names });
    expect((await calc.home(two.giac, settings)).display).toBe("19.6133");
  });
});
