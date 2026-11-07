// SPDX-License-Identifier: GPL-3.0-or-later
// G188: the main thread's side of the view sweep's engine worker (viewworker.ts), as run.ts's Runner is the point sweep's: one worker,
// a deadline per call, a fresh worker after a crash (an exception out of the host, an error or exit of the thread) or a call past its
// deadline. Each engine writes its own call log, `<logDir>/engine-<k>.log`; the log of an engine that crashed or hung is kept, the
// others are deleted when their engine ends. `context` holds the calls a fresh engine replays before the next one (the stored x).
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { Worker } from "node:worker_threads";
import type { ViewHost, ViewJob, ViewMethod, ViewReply, ViewWorkerData } from "./viewworker.ts";

/** What went wrong with one call: the engine trapped (`crash`) or did not answer before the deadline (`hang`). */
export interface Failed {
  failed: "crash" | "hang";
  detail: string;
  /** The kept call log of the engine that failed, and the calls it had made (the failing one included). */
  log: string | null;
  calls: number;
  heap: number;
}
export type Answer<T> = { ok: true; value: T } | ({ ok: false } & Failed);
type Args<M extends ViewMethod> = Parameters<ViewHost[M]>;
type Ret<M extends ViewMethod> = ReturnType<ViewHost[M]>;

export interface ViewEngineOptions {
  /** Where the call logs go; null: none (a stand-in host). */
  logDir: string | null;
  /** The per-call deadline, ms, by method. */
  deadlineMs: (method: ViewMethod) => number;
  /** A stand-in host module and its argument (tests): viewworker.ts's workerData.host, hostArg. */
  host?: string;
  hostArg?: unknown;
}

export class ViewEngine {
  private w: Worker | null = null;
  private id = 0;
  private engine = 0;
  private log: string | null = null;
  private last = { calls: 0, heap: 0 };
  /** Calls a fresh engine makes first (set by the sweep: `x:=…` while x is stored, Home's mode before the plot evaluator). */
  context: { method: ViewMethod; args: unknown[] }[] = [];
  /** Engines ended by a crash or a hang. */
  restarts = 0;
  /** The largest heap an engine reported, bytes. */
  maxHeap = 0;
  private readonly o: ViewEngineOptions;
  constructor(o: ViewEngineOptions) {
    this.o = o;
    if (o.logDir) {
      rmSync(o.logDir, { recursive: true, force: true });
      mkdirSync(o.logDir, { recursive: true });
    }
  }

  /** A fresh engine with the context replayed, or how the replay failed (that engine is ended). */
  private async start(): Promise<Worker | Failed> {
    this.engine++;
    this.log = this.o.logDir ? resolve(this.o.logDir, `engine-${this.engine}.log`) : null;
    const data: ViewWorkerData = this.o.host ? { host: this.o.host, hostArg: this.o.hostArg } : { log: this.log ?? "/dev/null" };
    const w = new Worker(new URL("./viewworker.ts", import.meta.url), { workerData: data });
    await new Promise<void>((res, rej) => {
      w.once("error", rej);
      w.once("message", () => {
        w.off("error", rej);
        res();
      });
    });
    this.w = w;
    this.last = { calls: 0, heap: 0 };
    for (const c of this.context) {
      const r = await this.post(w, c.method, c.args);
      if (!("ok" in r && r.ok)) return this.end(w, c.method, r);
    }
    return w;
  }

  private async end(w: Worker, method: ViewMethod, r: { id: number; lost: string } | { id: number; timeout: true } | ViewReply): Promise<Failed> {
    const failed: Failed["failed"] = "timeout" in r ? "hang" : "crash";
    const detail = "timeout" in r ? `no answer within ${this.o.deadlineMs(method)} ms` : "lost" in r ? r.lost : r.ok ? "" : r.error;
    const out: Failed = { failed, detail, log: this.log, calls: this.last.calls, heap: this.last.heap };
    this.w = null;
    this.restarts++;
    await w.terminate();
    return out;
  }

  private post(w: Worker, method: ViewMethod, args: unknown[]): Promise<ViewReply | { id: number; lost: string } | { id: number; timeout: true }> {
    const job: ViewJob = { id: ++this.id, method, args };
    return new Promise((res) => {
      const done = (r: ViewReply | { id: number; lost: string } | { id: number; timeout: true }): void => {
        clearTimeout(t);
        w.off("message", on);
        w.off("error", onErr);
        w.off("exit", onExit);
        res(r);
      };
      const on = (m: ViewReply): void => {
        if (m.id !== job.id) return;
        this.last = { calls: m.calls, heap: m.heap };
        this.maxHeap = Math.max(this.maxHeap, m.heap);
        done(m);
      };
      const onErr = (e: Error): void => done({ id: job.id, lost: `worker error: ${e.message}` });
      const onExit = (code: number): void => done({ id: job.id, lost: `worker exit ${code}` });
      const t = setTimeout(() => done({ id: job.id, timeout: true }), this.o.deadlineMs(method));
      w.on("message", on);
      w.on("error", onErr);
      w.once("exit", onExit);
      w.postMessage(job);
    });
  }

  /** One host call; a crash or a hang ends this engine (its log kept) and the next call starts a fresh one. */
  async call<M extends ViewMethod>(method: M, ...args: Args<M>): Promise<Answer<Ret<M>>> {
    const w = this.w ?? (await this.start());
    if (!(w instanceof Worker)) return { ok: false, ...w, detail: `${w.detail} (replaying the context on a fresh engine)` };
    const r = await this.post(w, method, args);
    if ("ok" in r && r.ok) return { ok: true, value: r.value as Ret<M> };
    return { ok: false, ...(await this.end(w, method, r)) };
  }

  /** Ends the engine; its log is deleted (it neither crashed nor hung). */
  async close(): Promise<void> {
    await this.w?.terminate();
    this.w = null;
    if (this.log) rmSync(this.log, { force: true });
  }
}
