// SPDX-License-Identifier: GPL-3.0-or-later
// R782: the start chunk's front of Android back's layers (backLayerFront.ts) with a mocked backLayer.ts: a layer opened
// before the code is in (the import settles after the opening tick) is pushed once it is, in the order it was opened; one
// released before is never pushed; and back pressed before the push has a history entry to pop, so it does not leave the
// app. (A mock whose factory waits cannot be used: vitest hands a second import() the real module while it waits.)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Front = typeof import("./backLayerFront.ts");

/** What the mocked openLayer did: it runs `close` at once (so a test reads the push order) and logs the open and the release. */
const log = vi.hoisted((): string[] => []);
vi.mock("./backLayer.ts", () => ({ openLayer: (close: () => void) => (close(), log.push("open"), () => log.push("release")) }));

/** A fresh front: its `code` is unset, so a layer opened now is opened before the code is in. */
async function freshFront(): Promise<{ front: Front; log: string[] }> {
  vi.resetModules();
  log.length = 0;
  return { front: await import("./backLayerFront.ts"), log };
}
/** Let the front's import settle (the layers opened before are pushed in its then). */
const loaded = async (front: Front): Promise<void> => {
  await front.loadBackLayer();
  await new Promise((r) => setTimeout(r));
};

describe("backLayerFront", () => {
  const pushState = vi.fn();
  beforeEach(() => {
    pushState.mockClear();
    vi.stubGlobal("history", { pushState });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pushes a layer opened before the code is in once it is, in the order they were opened", async () => {
    const { front, log } = await freshFront();
    const closed: string[] = [];
    // (the mock's openLayer calls `close` at once, so `closed` is the order the real layers were pushed in)
    front.openLayer(() => closed.push("fold"));
    front.openLayer(() => closed.push("sheet"));
    expect(log).toEqual([]); // nothing is pushed in the opening tick: the code is not in
    await loaded(front);
    expect(closed).toEqual(["fold", "sheet"]);
    expect(log).toEqual(["open", "open"]);
  });

  it("never pushes a layer released before the code is in", async () => {
    const { front, log } = await freshFront();
    const closed: string[] = [];
    const off = front.openLayer(() => closed.push("fold"));
    front.openLayer(() => closed.push("sheet"));
    off();
    await loaded(front);
    expect(closed).toEqual(["sheet"]);
    expect(log).toEqual(["open"]); // and no release of the one that never had an entry
  });

  it("puts one guard entry on the history at the first layer, so back before the push does not leave the app", async () => {
    const { front } = await freshFront();
    front.openLayer(() => {});
    expect(pushState).toHaveBeenCalledTimes(1); // at once, not when the code is in
    front.openLayer(() => {});
    expect(pushState).toHaveBeenCalledTimes(1);
    await loaded(front);
    front.openLayer(() => {}); // the code is in: the real module's, no guard
    expect(pushState).toHaveBeenCalledTimes(1);
  });

  it("a layer released after the code is in releases the real layer", async () => {
    const { front, log } = await freshFront();
    await loaded(front);
    const off = front.openLayer(() => {});
    off();
    expect(log).toEqual(["open", "release"]);
    expect(pushState).not.toHaveBeenCalled();
  });
});
