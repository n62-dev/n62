// SPDX-License-Identifier: GPL-3.0-or-later
// R314: Memory's delete and Clear all have a one-level Undo (as Clear history has, R98): the entries of the deleted names
// are kept as the session's copy before the purge, and Undo replays them through the definitions path, at their old
// places in the log. Real Giac in this thread behind the port and the worker protocol (as session.homeuses.engine.test.ts).
import { describe, expect, it } from "vitest";
import { EngineCalc } from "../calc/engine.ts";
import { createRequestHandler } from "../engine/host.ts";
import { giacAvailable, loadNodeGiac } from "../engine/nodeGiac.ts";
import type { Request, Response } from "../engine/protocol.ts";
import { WorkerEngine, type WorkerLike } from "../engine/workerEngine.ts";
import { fakeKv } from "../state/fakeKv.ts";
import { Session } from "../state/session.svelte.ts";
import { forget, undoForget } from "./names.svelte.ts";

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

/** A session on the real engine with a:=5, b:=7, c:=9 stored, in that order. */
async function stored() {
  const engine = new WorkerEngine({ createWorker: () => new InProcessWorker() });
  const kv = fakeKv();
  const s = new Session(new EngineCalc(engine), kv);
  for (const x of ["a:=5", "b:=7", "c:=9"]) await s.submit(x, x);
  await s.refreshNames();
  const log = async (): Promise<string[]> => (await engine.definitions()).map((e) => e.name);
  const read = async (n: string): Promise<string | undefined> => {
    await s.submit(n, n);
    return s.home.at(-1)?.text;
  };
  return { s, kv, log, read };
}
const names = (s: Session): string[] => s.userNames.map((u) => u.name).sort();

describe.skipIf(!giacAvailable())("R314: Memory's one-level Undo (real Giac)", () => {
  it("a deleted name comes back with its value, at its old place in the log", { timeout: 60_000 }, async () => {
    const { s, log, read } = await stored();
    expect(await log()).toEqual(["a", "b", "c"]);
    await forget(s, ["b"]);
    expect(names(s)).toEqual(["a", "c"]);
    expect(await log()).toEqual(["a", "c"]);
    expect(s.memoryUndo?.map((r) => r.entry.name)).toEqual(["b"]);
    expect(await undoForget(s)).toEqual({ back: ["b"], taken: [] });
    expect(names(s)).toEqual(["a", "b", "c"]);
    expect(await log()).toEqual(["a", "b", "c"]); // b between a and c again, not at the end
    expect(await read("b")).toBe("7");
    expect(s.memoryUndo).toBeNull();
  });

  it("Clear all, Undo: every name is back", { timeout: 60_000 }, async () => {
    const { s, log, read } = await stored();
    await forget(s, ["c", "b", "a"]);
    expect(names(s)).toEqual([]);
    expect(await log()).toEqual([]);
    expect(await undoForget(s)).toEqual({ back: ["a", "b", "c"], taken: [] });
    expect(await log()).toEqual(["a", "b", "c"]);
    expect([await read("a"), await read("c")]).toEqual(["5", "9"]);
  });

  it("control: a second delete replaces the copy (one level), Undo brings back the last only", { timeout: 60_000 }, async () => {
    const { s } = await stored();
    await forget(s, ["a"]);
    await forget(s, ["b"]);
    expect(await undoForget(s)).toEqual({ back: ["b"], taken: [] });
    expect(names(s)).toEqual(["b", "c"]);
    expect((await undoForget(s)).back).toEqual([]); // the copy went with the Undo
  });

  it("control: the next Enter drops the copy", { timeout: 60_000 }, async () => {
    const { s } = await stored();
    await forget(s, ["a"]);
    expect(s.memoryUndo).not.toBeNull();
    await s.submit("1+1", "1+1");
    expect(s.memoryUndo).toBeNull();
    expect(await undoForget(s)).toEqual({ back: [], taken: [] });
    expect(names(s)).toEqual(["b", "c"]);
  });

  it("control: a backup never holds it (nothing of the copy is written to the store)", { timeout: 60_000 }, async () => {
    const { s, kv } = await stored();
    const before = kv.writes.length;
    await forget(s, ["a"]);
    await new Promise((r) => setTimeout(r, 20));
    expect(kv.writes.slice(before)).toEqual([]);
    expect(JSON.stringify([...kv.data.values()])).not.toContain('"cmds"');
  });

  it("control: a name defined again after its delete is not overwritten by Undo", { timeout: 60_000 }, async () => {
    const { s, read } = await stored();
    await forget(s, ["a"]);
    await s.calc.home("a:=11", s.settings); // a definition that is not an Enter on the line (a Solve store, a library import): the copy stays
    await s.refreshNames();
    expect(await undoForget(s)).toEqual({ back: [], taken: ["a"] });
    expect(await read("a")).toBe("11");
    expect(s.memoryUndo).toBeNull();
  });
});
