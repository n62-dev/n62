// SPDX-License-Identifier: GPL-3.0-or-later
// G61: the sweep's host in a worker thread, as the app keeps one engine worker. It answers {id, giac, angle, digits} with the Home
// result's shown facts. The main thread kills it when a deadline passes (a hang is a finding) and starts a new one.
import { parentPort } from "node:worker_threads";
import { EngineHost } from "../../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings, pasdegCommand } from "../../../app/src/engine/homeEval.ts";
import { shownOf } from "./shown.ts";

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
  // G797: a list or matrix sends its entries, each with its value and its own mark (shown.ts)
  const shown = shownOf(host.home(job.giac, settings).result, job.digits);
  parentPort!.postMessage({ id: job.id, shown });
});
