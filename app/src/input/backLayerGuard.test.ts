// SPDX-License-Identifier: GPL-3.0-or-later
// R782f1: the guard entry of the start chunk's front (backLayerFront.ts) goes to the real backLayer.ts when it loads: a
// layer that waited replaces it, and with every waiting layer released it is taken back, so back with nothing open leaves
// the app at once. A stub history keeps a stack and fires popstate on go, as the platform does (asynchronously).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Front = typeof import("./backLayerFront.ts");

/** The history as a stack of states; `go` moves the index and fires popstate in a later task. */
function stubHistory(): { stack: unknown[]; index: () => number } {
  const stack: unknown[] = [null];
  let i = 0;
  const win = new EventTarget();
  vi.stubGlobal("window", win);
  vi.stubGlobal("history", {
    pushState: (s: unknown) => {
      stack.splice(i + 1);
      stack.push(s);
      i++;
    },
    replaceState: (s: unknown) => void (stack[i] = s),
    go: (n: number) => {
      i = Math.max(0, i + n);
      setTimeout(() => win.dispatchEvent(new Event("popstate")));
    },
  });
  return { stack, index: () => i };
}
const tick = (): Promise<void> => new Promise((r) => setTimeout(r));
async function fresh(): Promise<Front> {
  vi.resetModules();
  return import("./backLayerFront.ts");
}
const loaded = async (front: Front): Promise<void> => {
  await front.loadBackLayer();
  await tick();
  await tick();
};

describe("backLayerFront hands its guard entry to backLayer", () => {
  let h: ReturnType<typeof stubHistory>;
  beforeEach(() => {
    h = stubHistory();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("a layer opened and released before the load leaves the history at its start", async () => {
    const front = await fresh();
    front.openLayer(() => {})();
    expect(h.index()).toBe(1); // the guard
    await loaded(front);
    expect(h.index()).toBe(0);
  });

  it("a layer opened before the load takes the guard's place, and its release leaves the history at its start", async () => {
    const front = await fresh();
    const off = front.openLayer(() => {});
    await loaded(front);
    expect(h.index()).toBe(1); // one entry, not two
    expect(h.stack[1]).toEqual({ n62Layer: 0 });
    off();
    await tick();
    await tick();
    expect(h.index()).toBe(0);
  });

  it("back after the load closes the layer and leaves no entry", async () => {
    const front = await fresh();
    let closed = 0;
    front.openLayer(() => closed++);
    await loaded(front);
    history.go(-1);
    await tick();
    expect(closed).toBe(1);
    expect(h.index()).toBe(0);
  });

  it("back before the load closes the newest waiting layer and keeps a guard for the rest", async () => {
    const front = await fresh();
    const closed: string[] = [];
    front.openLayer(() => closed.push("fold"));
    front.openLayer(() => closed.push("sheet"));
    history.go(-1);
    await tick();
    expect(closed).toEqual(["sheet"]);
    expect(h.index()).toBe(1); // the guard again, under the fold
    await loaded(front);
    expect(h.index()).toBe(1);
    history.go(-1);
    await tick();
    expect(closed).toEqual(["sheet", "fold"]);
    expect(h.index()).toBe(0);
  });

  it("back before the load with every layer released only uses the guard up", async () => {
    const front = await fresh();
    front.openLayer(() => {})();
    history.go(-1);
    await tick();
    await loaded(front);
    expect(h.index()).toBe(0); // the load takes nothing back that is gone
  });
});
