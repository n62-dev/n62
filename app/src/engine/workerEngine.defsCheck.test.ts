// SPDX-License-Identifier: GPL-3.0-or-later
// R782: the stored log's check is a lazy chunk (defsCheck.ts). When that chunk fails to load, the stored log is never
// written over: the engine starts with an empty log and leaves the store alone.
import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "./protocol.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { WorkerEngine, type WorkerLike } from "./workerEngine.ts";

vi.mock("./defsCheck.ts", () => {
  throw new Error("Failed to fetch dynamically imported module");
});

const two = { ok: true, display: "2", path: "exact", approximate: false, exactMs: 1, totalMs: 1, facts: { exact: true, reliableDigits: null }, full: "2" } as const;

/** A worker that starts, takes definitions and answers Home with a definition of A (so the engine has one to keep). */
class Stub implements WorkerLike {
  onmessage: ((ev: { data: Response }) => void) | null = null;
  onerror: ((ev: { message?: string }) => void) | null = null;
  postMessage(msg: Request): void {
    setTimeout(() => {
      if (msg.type === "init") this.onmessage?.({ data: { id: msg.id, type: "ready", instantiateMs: 1, initMs: 1, replayMs: 0 } });
      else if (msg.type === "define") this.onmessage?.({ data: { id: msg.id, type: "defined", replayMs: 1, defs: [] } });
      else if (msg.type === "home") {
        const defs = [{ set: { name: "A", kind: "var" as const, cmds: ["A:=5"], preview: "5", view: "home" as const, time: 1 } }];
        this.onmessage?.({ data: { id: msg.id, type: "home", result: two, defs } });
      }
    }, 0);
  }
  terminate(): void {}
}

describe("WorkerEngine: the stored log's check chunk fails to load (R782)", () => {
  it("the engine starts, and a definition does not overwrite the stored log", async () => {
    const stored = [{ name: "K", kind: "var", cmds: ["K:=1"], preview: "1", view: "home", time: 1 }];
    const saves: unknown[] = [];
    const store = { load: () => Promise.resolve(stored), save: (log: unknown) => void saves.push(log) };
    const e = new WorkerEngine({ baseUrl: "/", createWorker: () => new Stub(), defs: store });
    expect((await e.home("A:=5", defaultHomeSettings)).display).toBe("2");
    await e.defsWritten();
    expect(saves).toEqual([]);
    e.dispose();
  });
});
