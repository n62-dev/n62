// SPDX-License-Identifier: GPL-3.0-or-later
// G318: an engine that cannot start stops after two tries and says so (stand-in workers).
import { describe, expect, it } from "vitest";
import type { Request, Response } from "./protocol.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { deadEngine, startFailure } from "./dead.ts";
import { EngineCrashError, EngineLoadError, EngineMemoryError } from "./types.ts";
import { WorkerEngine, type WorkerLike } from "./workerEngine.ts";

/** How a start fails: a fatal reply to init (with `dead` as host.ts would mark it), or a worker error event. */
type Fail = { fatal: string; dead?: "memory" | "crash" } | { error?: string };

const two = { ok: true, display: "2", path: "exact", approximate: false, exactMs: 1, totalMs: 1, facts: { exact: true, reliableDigits: null }, full: "2" } as const;

/** Fails its init as `fail` says (null: starts), answers define and Home ("2") once started. */
class StartWorker implements WorkerLike {
  onmessage: ((ev: { data: Response }) => void) | null = null;
  onerror: ((ev: { message?: string }) => void) | null = null;
  terminated = false;
  constructor(private readonly fail: Fail | null) {}
  postMessage(msg: Request): void {
    setTimeout(() => {
      if (this.terminated) return;
      const f = this.fail;
      if (msg.type === "init" && f) {
        if ("fatal" in f) this.onmessage?.({ data: { id: msg.id, type: "fatal", message: f.fatal, ...(f.dead ? { dead: f.dead } : {}) } });
        else this.onerror?.(f.error === undefined ? {} : { message: f.error });
      } else if (msg.type === "init") this.onmessage?.({ data: { id: msg.id, type: "ready", instantiateMs: 1, initMs: 1, replayMs: 0 } });
      else if (msg.type === "define") this.onmessage?.({ data: { id: msg.id, type: "defined", replayMs: 1, defs: [] } });
      else if (msg.type === "home") this.onmessage?.({ data: { id: msg.id, type: "home", result: two, defs: [] } });
    }, 0);
  }
  terminate(): void {
    this.terminated = true;
  }
}

/** An engine whose workers fail their start as `fail` says until `heal()`. Bounded: from the 41st worker on they start,
 *  so a restart loop ends the test with a wrong count and a ready engine instead of hanging it. */
function failing(fail: Fail | ((n: number) => Fail | null)) {
  const workers: StartWorker[] = [];
  let healed = false;
  const engine = new WorkerEngine({
    baseUrl: "/",
    createWorker: () => {
      const n = workers.length;
      const f = healed || n >= 40 ? null : typeof fail === "function" ? fail(n) : fail;
      workers.push(new StartWorker(f));
      return workers.at(-1)!;
    },
  });
  return { engine, workers, heal: () => void (healed = true) };
}

/** ready()'s outcome, or "pending" when it has not settled after the timers have run a while. */
async function outcome(p: Promise<unknown>): Promise<unknown> {
  const pending = new Promise((r) => setTimeout(() => r("pending"), 200));
  return Promise.race([p.then((v) => ({ value: v }), (e: unknown) => e), pending]);
}

describe("WorkerEngine: an engine that cannot start (G318)", () => {
  it("every init answers fatal marked memory: at most 3 workers, and ready() rejects with EngineMemoryError", async () => {
    const { engine, workers } = failing({ fatal: "out of memory", dead: "memory" });
    expect(await outcome(engine.ready())).toBeInstanceOf(EngineMemoryError);
    expect(workers.length).toBeLessThanOrEqual(3);
    engine.dispose();
  });

  it("every worker fires onerror before ready: at most 3 workers, and ready() rejects with EngineMemoryError", async () => {
    const { engine, workers } = failing({ error: "out of memory" });
    expect(await outcome(engine.ready())).toBeInstanceOf(EngineMemoryError);
    expect(workers.length).toBeLessThanOrEqual(3);
    engine.dispose();
  });

  it("every init answers fatal marked crash: at most 3 workers, and ready() rejects with EngineCrashError", async () => {
    const { engine, workers } = failing({ fatal: "Maximum call stack size exceeded", dead: "crash" });
    expect(await outcome(engine.ready())).toBeInstanceOf(EngineCrashError);
    expect(workers.length).toBeLessThanOrEqual(3);
    engine.dispose();
  });

  it("a wasm file that is not there (the dev engine's text, 2026-11-10; deadEngine says memory) is a load error", async () => {
    const text = "Aborted(Error: ENOENT: no such file or directory, open '…/giac.wasm')";
    expect(deadEngine(new Error(text))).toBe("memory"); // the running engine's class stays as it was
    const { engine, workers } = failing({ fatal: text, dead: "memory" });
    expect(await outcome(engine.ready())).toBeInstanceOf(EngineLoadError);
    expect(workers.length).toBeLessThanOrEqual(3);
    engine.dispose();
  });

  it("a wasm fetch that failed is a load error", async () => {
    const { engine, workers } = failing({ fatal: "Aborted(both async and sync fetching of the wasm failed)", dead: "memory" });
    expect(await outcome(engine.ready())).toBeInstanceOf(EngineLoadError);
    expect(workers.length).toBeLessThanOrEqual(3);
    engine.dispose();
  });

  it("a wasm memory that cannot be allocated (Chrome's RangeError; deadEngine says null) is a memory error, after one worker", async () => {
    const text = "WebAssembly.Memory(): could not allocate memory";
    expect(deadEngine(new RangeError(text))).toBeNull();
    const { engine, workers } = failing({ fatal: text });
    expect(await outcome(engine.ready())).toBeInstanceOf(EngineMemoryError);
    expect(workers).toHaveLength(1);
    engine.dispose();
  });

  it("a worker error with no message before ready (a worker script that is gone) is a load error, at most 3 workers", async () => {
    const { engine, workers } = failing({});
    expect(await outcome(engine.ready())).toBeInstanceOf(EngineLoadError);
    expect(workers.length).toBeLessThanOrEqual(3);
    engine.dispose();
  });

  it("after it stopped, every later call rejects with the failure and no worker is started", async () => {
    const { engine, workers } = failing({ fatal: "out of memory", dead: "memory" });
    await outcome(engine.ready());
    const made = workers.length;
    expect(await outcome(engine.home("1+1", defaultHomeSettings))).toBeInstanceOf(EngineMemoryError);
    expect(await outcome(engine.ready())).toBeInstanceOf(EngineMemoryError);
    expect(workers).toHaveLength(made);
    engine.dispose();
  });

  it("a Cancel after it stopped starts one fresh attempt: one that works answers, one that fails stops again at once", async () => {
    const a = failing({ error: "" });
    expect(await outcome(a.engine.ready())).toBeInstanceOf(EngineLoadError);
    const made = a.workers.length;
    a.heal();
    await a.engine.cancel();
    expect(a.workers).toHaveLength(made + 1);
    expect((await a.engine.home("1+1", defaultHomeSettings)).display).toBe("2");
    a.engine.dispose();

    const b = failing({ error: "" });
    expect(await outcome(b.engine.ready())).toBeInstanceOf(EngineLoadError);
    const before = b.workers.length;
    expect(await outcome(b.engine.cancel())).toBeInstanceOf(EngineLoadError);
    expect(b.workers).toHaveLength(before + 1);
    b.engine.dispose();
  });
});

describe("startFailure (G318): what stopped a start, by its text", () => {
  it("memory when the text names memory, else load", () => {
    expect(startFailure("Aborted(Error: ENOENT: no such file or directory, open '…/giac.wasm')")).toBe("load");
    expect(startFailure("Aborted(both async and sync fetching of the wasm failed)")).toBe("load");
    expect(startFailure("WebAssembly.Memory(): could not allocate memory")).toBe("memory");
    expect(startFailure("out of memory")).toBe("memory");
    expect(startFailure("Cannot enlarge memory arrays to size 1073807360 bytes")).toBe("memory");
    expect(startFailure("Aborted(OOM)")).toBe("memory");
    expect(startFailure("")).toBe("load");
    expect(startFailure(undefined)).toBe("load");
  });
});

describe("WorkerEngine start-up controls (G318; pass before it too)", () => {
  it("a plain fatal reply to init rejects ready() after one worker", async () => {
    const { engine, workers } = failing({ fatal: "boom" });
    expect(await outcome(engine.ready())).toBeInstanceOf(Error);
    expect(workers).toHaveLength(1);
    engine.dispose();
  });

  it("a crash after ready restarts the worker, and the next call answers", async () => {
    const { engine, workers } = failing(() => null);
    await engine.ready();
    workers[0]!.onerror?.({ message: "out of memory" });
    expect((await engine.home("1+1", defaultHomeSettings)).display).toBe("2");
    expect(workers).toHaveLength(2);
    engine.dispose();
  });

  it("a Cancel during the start is not counted: a slow start cancelled, then one failure, then a start that works", async () => {
    // worker 0 never answers init (the Cancel stops it), worker 1 fails, worker 2 starts
    const { engine, workers } = failing((n) => (n === 0 ? { fatal: "never" } : n === 1 ? { error: "out of memory" } : null));
    void engine.cancel(); // before worker 0's init answers
    expect(await outcome(engine.ready())).toHaveProperty("value");
    expect(workers).toHaveLength(3);
    expect((await engine.home("1+1", defaultHomeSettings)).display).toBe("2");
    engine.dispose();
  });
});
