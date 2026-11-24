// SPDX-License-Identifier: GPL-3.0-or-later
// G61: the sweep's host in a worker thread, as the app keeps one engine worker. It answers {id, giac, angle, digits} with the Home
// result's shown facts. The main thread kills it when a deadline passes (a hang is a finding) and starts a new one.
import { parentPort } from "node:worker_threads";
import { EngineHost } from "../../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings, pasdegCommand, precisionFacts, type HomeResult } from "../../../app/src/engine/homeEval.ts";
import { markOf } from "../../../app/src/engine/format.ts";
import type { Shown } from "./judge.ts";

export interface Job {
  id: number;
  giac: string;
  angle: "rad" | "deg";
  digits: number;
}

const { giac, bridge } = await loadNodeGiac();
giac.eval(pasdegCommand("rad"));
const host = new EngineHost(giac, bridge);
parentPort!.postMessage({ ready: true });
parentPort!.on("message", (job: Job) => {
  const settings = { ...defaultHomeSettings, angle: job.angle, digits: job.digits, workDigits: Math.max(30, job.digits + 10) };
  const r = host.home(job.giac, settings).result;
  const markOfIt = (x: HomeResult): Pick<Shown, "mark" | "n"> => {
    const m = x.ok && x.value ? markOf(precisionFacts(x), { format: "STD", digits: job.digits }) : null;
    return m ? { mark: m.mark, ...(m.n !== undefined ? { n: m.n } : {}) } : {};
  };
  // G797: a list or matrix sends its entries, each with its value and its own mark (the matrix grid marks each cell)
  const items = r.ok && r.items ? r.items.map((it): Shown => ({ ok: it.ok, display: it.display, ...(it.value ? { value: it.value } : {}), ...markOfIt(it) })) : undefined;
  const shown: Shown = { ok: r.ok, display: r.display, ...(r.error ? { error: r.error } : {}), ...(r.value && !r.items ? { value: r.value } : {}), ...markOfIt(r), ...(items ? { items, ...(r.shape ? { shape: r.shape } : {}) } : {}) };
  parentPort!.postMessage({ id: job.id, shown });
});
