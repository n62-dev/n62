// SPDX-License-Identifier: GPL-3.0-or-later
// G188: replays a view sweep call log (calllog.ts; the crash finding names it) on a fresh engine, to see whether the crash is the same
// every time, and cuts a crashing log down by halving (ddmin) to a short sequence that still crashes.
//   node tools/probes/sweep/replay.ts <log> [--runs N] [--to K] [--stack]   # N replays of the log's first K calls (default all), each on a fresh engine:
//                                                                # the call that traps (1-based), its text, the heap then and every 5,000 calls;
//                                                                # --stack: the trap's wasm frames (names with a --profiling-funcs build, GIAC_OUT)
//   node tools/probes/sweep/replay.ts --shrink <state.json> [--log <log> --to K] [--minutes M]   # the halving, resumable: the first call
//       starts it from <log> (calls 1..K); each call runs trials for at most M minutes (default 8), saves the state and says DONE or MORE;
//       run it under `tools/devlock.sh slice <name> …`, one slice per call
// A trial keeps a candidate when its replay traps (any exception out of a Giac call); a replay past the deadline (--deadline S, default
// 480 s) does not count as a crash. Giac's clocks (`timeout`, set by the CAS view and Solve) make a replay depend on the machine's speed.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";
import { loadNodeGiac } from "../../../app/src/engine/nodeGiac.ts";
import { parseLog, replayCall, trapText, type Call } from "./calllog.ts";

/** Calls of the log by index ranges [from, to), 0-based. */
type Ranges = [number, number][];
interface TrialData {
  log: string;
  ranges: Ranges;
}
export type Trial = { crashed: false; calls: number; heap: number; hang?: true } | { crashed: true; at: number; call: Call; error: string; heap: number; calls: number; stack?: string };
const mb = (b: number): string => `${(b / 2 ** 20).toFixed(0)} MB`;

/** One replay of `ranges` of `log` on a fresh engine in a worker thread. */
export function trial(log: string, ranges: Ranges, deadlineS: number, progress?: (n: number, heap: number) => void): Promise<Trial> {
  const w = new Worker(new URL(import.meta.url), { workerData: { log, ranges } satisfies TrialData });
  const n = ranges.reduce((s, [a, b]) => s + b - a, 0);
  return new Promise((res) => {
    const done = (t: Trial): void => {
      clearTimeout(timer);
      void w.terminate();
      res(t);
    };
    const timer = setTimeout(() => done({ crashed: false, calls: n, heap: 0, hang: true }), deadlineS * 1000);
    w.on("message", (m: Trial | { progress: number; heap: number }) => ("progress" in m ? progress?.(m.progress, m.heap) : done(m)));
    w.on("error", (e: Error) => done({ crashed: true, at: 0, call: ["eval", ""], error: `worker error: ${e.message}`, heap: 0, calls: n }));
    w.on("exit", (code) => done({ crashed: true, at: 0, call: ["eval", ""], error: `worker exit ${code}`, heap: 0, calls: n }));
  });
}

interface ShrinkState {
  log: string;
  /** The current candidate (ranges of the log), the granularity and the next chunk to drop. */
  keep: Ranges;
  n: number;
  next: number;
  trials: number;
  /** The last crash of the current candidate. */
  crash: Trial | null;
  done: boolean;
}

const size = (r: Ranges): number => r.reduce((s, [a, b]) => s + b - a, 0);
/** The candidate without its chunk `i` of `n` (chunks by call count). */
function without(r: Ranges, n: number, i: number): Ranges {
  const len = size(r);
  const lo = Math.floor((len * i) / n);
  const hi = Math.floor((len * (i + 1)) / n);
  const out: Ranges = [];
  let at = 0;
  for (const [a, b] of r) {
    const parts: [number, number][] = [
      [a, Math.min(b, a + Math.max(0, lo - at))],
      [a + Math.max(0, hi - at), b],
    ];
    for (const [x, y] of parts) if (y > x) out.push([x, y]);
    at += b - a;
  }
  return out;
}

async function shrink(statePath: string, args: string[], minutes: number, deadlineS: number): Promise<void> {
  const opt = (name: string): string | undefined => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  let st: ShrinkState;
  if (existsSync(statePath)) st = JSON.parse(readFileSync(statePath, "utf8")) as ShrinkState;
  else {
    const log = opt("--log");
    if (!log) throw new Error("--shrink: no state yet, give --log <log> [--to K]");
    const to = Number(opt("--to") ?? parseLog(readFileSync(log, "utf8")).length);
    st = { log, keep: [[0, to]], n: 2, next: 0, trials: 0, crash: null, done: false };
  }
  const t0 = performance.now();
  const save = (): void => writeFileSync(statePath, `${JSON.stringify(st)}\n`);
  while (!st.done && performance.now() - t0 < minutes * 60_000) {
    const len = size(st.keep);
    if (st.n > len) {
      st.done = true;
      break;
    }
    const cand = without(st.keep, st.n, st.next);
    const t = await trial(st.log, cand, deadlineS);
    st.trials++;
    console.log(`trial ${st.trials}: ${size(cand)} of ${len} calls (drop chunk ${st.next + 1}/${st.n}): ${t.crashed ? `CRASH at ${t.at} (${t.error}), heap ${mb(t.heap)}` : t.hang ? "past the deadline" : `no crash, heap ${mb(t.heap)}`}`);
    if (t.crashed && t.at > 0) {
      // keep the dropped version, cut to the crashing call, and go on at a coarser granularity
      st.keep = prefix(cand, t.at);
      st.crash = t;
      st.n = Math.max(2, st.n - 1);
      st.next = 0;
    } else if (++st.next >= st.n) {
      if (st.n >= len) st.done = true;
      st.n = Math.min(len, st.n * 2);
      st.next = 0;
    }
    save();
  }
  save();
  const calls = parseLog(readFileSync(st.log, "utf8"));
  console.log(`SHRINK ${st.done ? "DONE" : "MORE"}: ${size(st.keep)} calls after ${st.trials} trials (granularity ${st.n}); ${st.crash?.crashed ? `last crash at call ${st.crash.at}: ${st.crash.error}, heap ${mb(st.crash.heap)}` : "no crash yet"}; state ${statePath}`);
  if (st.done && size(st.keep) <= 200) for (const [a, b] of st.keep) for (let i = a; i < b; i++) console.log(`  ${i + 1}: ${JSON.stringify(calls[i])}`);
}

/** The first `k` calls of a candidate. */
function prefix(r: Ranges, k: number): Ranges {
  const out: Ranges = [];
  let left = k;
  for (const [a, b] of r) {
    if (left <= 0) break;
    const take = Math.min(left, b - a);
    out.push([a, a + take]);
    left -= take;
  }
  return out;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const opt = (name: string): string | undefined => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const deadlineS = Number(opt("--deadline") ?? 480);
  const st = opt("--shrink");
  if (st) return shrink(st, args, Number(opt("--minutes") ?? 8), deadlineS);
  const log = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1]!.startsWith("--")));
  if (!log) throw new Error("usage: replay.ts <log> [--runs N] [--to K] | --shrink <state.json> …");
  const total = parseLog(readFileSync(log, "utf8")).length;
  const to = Number(opt("--to") ?? total);
  for (let run = 1; run <= Number(opt("--runs") ?? 1); run++) {
    const t0 = performance.now();
    const steps: string[] = [];
    const t = await trial(log, [[0, to]], deadlineS, (n, heap) => steps.push(`${n}: ${mb(heap)}`));
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    console.log(
      `REPLAY ${run}: ${t.crashed ? `CRASH at call ${t.at} of ${t.calls} (${t.error}), heap ${mb(t.heap)}; the call: ${JSON.stringify(t.call).slice(0, 300)}` : t.hang ? `past ${deadlineS} s` : `no crash in ${t.calls} calls, heap ${mb(t.heap)}`}; ${secs} s; heap by calls ${steps.join(", ") || "-"}`,
    );
    if (t.crashed && t.stack && args.includes("--stack")) console.log(`  stack: ${t.stack}`);
  }
}

if (!isMainThread) {
  Error.stackTraceLimit = 200;
  const d = workerData as TrialData;
  const all = parseLog(readFileSync(d.log, "utf8"));
  const calls = d.ranges.flatMap(([a, b]) => all.slice(a, b));
  const L = await loadNodeGiac();
  let i = 0;
  try {
    for (; i < calls.length; i++) {
      replayCall(L, calls[i]!);
      if ((i + 1) % 5000 === 0) parentPort!.postMessage({ progress: i + 1, heap: L.heapBytes() });
    }
    parentPort!.postMessage({ crashed: false, calls: calls.length, heap: L.heapBytes() } satisfies Trial);
  } catch (e) {
    const error = trapText(e);
    // the wasm frames by name (a build linked with --profiling-funcs; the release build has numbers only)
    const stack = e instanceof Error ? (e.stack ?? "").split("\n").slice(1, 200).map((l) => l.trim().replace(/^at /, "").replace(/ \(wasm:\/\/.*$/, "")).join(" < ") : undefined;
    parentPort!.postMessage({ crashed: true, at: i + 1, call: calls[i]!, error, heap: L.heapBytes(), calls: calls.length, ...(stack ? { stack } : {}) } satisfies Trial);
  }
} else {
  await main();
}
