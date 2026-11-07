// SPDX-License-Identifier: GPL-3.0-or-later
// G188: a stand-in engine host for the view sweep's tests (viewsweep-crash.test.ts), loaded in the sweep's worker thread
// (tools/probes/sweep/viewworker.ts, workerData.host). It refuses every value (so no comparison differs), traps like a wasm engine on
// its `trapAt`-th call or on a call whose arguments hold `trapOn`, and never answers a call whose arguments hold `hangOn`. Home shows
// the x it stores (`x:=…`), so a test sees what a fresh engine was given.
import type { ViewHost } from "../../tools/probes/sweep/viewworker.ts";

export interface StandInArg {
  trapAt?: number;
  trapOn?: string;
  hangOn?: string;
}

const refusal = { ok: false, display: "", path: "float-error", approximate: false, exactMs: 0, totalMs: 0, error: "engine" };

export function createHost(arg: StandInArg | null): ViewHost & { calls: () => number } {
  const o = arg ?? {};
  let n = 0;
  let x: string | null = null;
  const step = (args: unknown[]): void => {
    n++;
    const text = JSON.stringify(args);
    if (o.trapAt !== undefined && n === o.trapAt) throw new WebAssembly.RuntimeError("memory access out of bounds");
    if (o.trapOn !== undefined && text.includes(o.trapOn)) throw new WebAssembly.RuntimeError("memory access out of bounds");
    if (o.hangOn !== undefined && text.includes(o.hangOn)) for (;;);
  };
  const host = {
    eval: (input: string) => (step([input]), { output: input === "about(x)" ? "x" : "undef", ok: true, engineMs: 0, defs: [] }),
    home: (typed: string) => {
      step([typed]);
      const m = /^x:=(.*)$/.exec(typed);
      if (m) x = m[1]!;
      if (typed === "purge(x)") x = null;
      return { result: { ...refusal, display: x === null ? "" : `x=${x}` }, defs: [] };
    },
    cas: (typed: string) => (step([typed]), { result: { ok: false, display: "" }, defs: [] }),
    table: (req: { fns: string[]; xs: string[] }) => (step([req]), req.xs.map(() => req.fns.map(() => refusal))),
    analyze: (req: unknown) => (step([req]), { ok: false, warn: false, info: "", method: "none", error: "engine", ms: 0 }),
    solve: (req: unknown) => (step([req]), { ok: false, warn: false, roots: [] }),
    calls: () => n,
  };
  return host as unknown as ViewHost & { calls: () => number };
}
