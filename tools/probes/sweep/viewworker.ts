// SPDX-License-Identifier: GPL-3.0-or-later
// G188: the view sweep's engine in a worker thread, as the point sweep's (worker.ts): it answers {id, method, args} with the engine host's
// method on those arguments. An exception out of the host is the engine's death (a wasm trap; the host turns syntax errors into results
// itself): the reply says so and the main thread (viewhost.ts) ends this worker and starts a fresh one. Every Giac call is written to the
// call log (calllog.ts) before it runs. workerData.host names a stand-in host module (tests) instead of Giac.
import { parentPort, workerData } from "node:worker_threads";
import { pasdegCommand } from "../../../app/src/engine/homeEval.ts";
import { EngineHost } from "../../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../../app/src/engine/nodeGiac.ts";
import { loggedGiac } from "./calllog.ts";

export type ViewMethod = "eval" | "home" | "cas" | "table" | "analyze" | "solve";
/** The host methods the view sweep calls. */
export type ViewHost = Pick<EngineHost, ViewMethod>;
export interface ViewWorkerData {
  /** A module whose `createHost(hostArg)` returns a stand-in host (tests); absent: Giac with its call log. */
  host?: string;
  hostArg?: unknown;
  /** The call log's path (Giac only). */
  log?: string;
}
export interface ViewJob {
  id: number;
  method: ViewMethod;
  args: unknown[];
}
export type ViewReply = { id: number; calls: number; heap: number } & ({ ok: true; value: unknown } | { ok: false; error: string });

const data = workerData as ViewWorkerData;
let host: ViewHost;
let calls = (): number => 0;
let heap = (): number => 0;
if (data.host) {
  const m = (await import(data.host)) as { createHost: (arg: unknown) => ViewHost & { calls?: () => number } };
  host = m.createHost(data.hostArg);
  calls = () => (host as { calls?: () => number }).calls?.() ?? 0;
} else {
  const L = await loadNodeGiac();
  const logged = loggedGiac(L, data.log ?? "/dev/null");
  logged.giac.eval(pasdegCommand("rad"));
  host = new EngineHost(logged.giac, logged.bridge);
  calls = logged.calls;
  heap = L.heapBytes;
}
parentPort!.postMessage({ ready: true });
parentPort!.on("message", (job: ViewJob) => {
  let reply: ViewReply;
  try {
    const value = (host[job.method] as (...a: unknown[]) => unknown).apply(host, job.args);
    reply = { id: job.id, ok: true, value, calls: calls(), heap: heap() };
  } catch (e) {
    reply = { id: job.id, ok: false, error: e instanceof Error ? `${e.constructor.name}: ${e.message}` : String(e), calls: calls(), heap: heap() };
  }
  parentPort!.postMessage(reply);
});
