// SPDX-License-Identifier: GPL-3.0-or-later
// G188: every Giac call of an engine, one JSON line each, written before the call, so the line of a call that traps is the log's last;
// replay.ts plays a log again on a fresh engine. A line is ["eval", text], ["pow", n], ["ctxGet"], ["ctxSet", fields], ["parse", text]
// or ["value", text, precisions, tree].
import { closeSync, openSync, writeSync } from "node:fs";
import type { GiacBridge, GiacContext } from "../../../app/src/engine/bridge.ts";
import type { LoadedGiac } from "../../../app/src/engine/host.ts";

export type Call = ["eval", string] | ["pow", number] | ["ctxGet"] | ["ctxSet", Partial<GiacContext>] | ["parse", string] | ["value", string, number[], boolean];

/** The engine `L` with every call written to `path` (truncated first) and counted. */
export function loggedGiac(L: LoadedGiac, path: string): { giac: LoadedGiac["giac"]; bridge: GiacBridge; calls: () => number; close: () => void } {
  const fd = openSync(path, "w");
  let n = 0;
  const log = (c: Call): void => {
    n++;
    writeSync(fd, `${JSON.stringify(c)}\n`);
  };
  const g = L.giac;
  const b = L.bridge;
  return {
    giac: {
      eval: (s) => (log(["eval", s]), g.eval(s)),
      setPowLimit: (p) => (log(["pow", p]), g.setPowLimit(p)),
      messages: () => g.messages(),
      clearMessages: () => g.clearMessages(),
    },
    bridge: {
      ctxGet: () => (log(["ctxGet"]), b.ctxGet()),
      ctxSet: (f) => (log(["ctxSet", f]), b.ctxSet(f)),
      parse: (t) => (log(["parse", t]), b.parse(t)),
      value: (t, p, tree) => (log(["value", t, [...p], tree === true]), b.value(t, p, tree)),
    },
    calls: () => n,
    close: () => closeSync(fd),
  };
}

/** One logged call on `L`. */
export function replayCall(L: LoadedGiac, c: Call): void {
  switch (c[0]) {
    case "eval":
      L.giac.eval(c[1]);
      return;
    case "pow":
      L.giac.setPowLimit(c[1]);
      return;
    case "ctxGet":
      L.bridge.ctxGet();
      return;
    case "ctxSet":
      L.bridge.ctxSet(c[1]);
      return;
    case "parse":
      L.bridge.parse(c[1]);
      return;
    case "value":
      L.bridge.value(c[1], c[2], c[3]);
      return;
  }
}

export const parseLog = (text: string): Call[] =>
  text
    .split("\n")
    .filter((l) => l !== "")
    .map((l) => JSON.parse(l) as Call);

/** What killed an engine call: a wasm trap (a RuntimeError), or a C++ exception that left Giac (a WebAssembly.Exception, which is no Error). */
export const trapText = (e: unknown): string =>
  e instanceof Error ? `${e.constructor.name}: ${e.message}` : e instanceof WebAssembly.Exception ? "WebAssembly.Exception: a C++ exception left Giac" : String(e);
