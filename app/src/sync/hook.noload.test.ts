// SPDX-License-Identifier: GPL-3.0-or-later
// R182: with no folder chosen (Vitest runs as the web: no native plugin, so folderName answers "unavailable") the
// hook's own ports never import the feed's chunk (sync/feed.ts: the queue and the files), however many rows finish.
import { describe, expect, it, vi } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import { fakeKv } from "../state/fakeKv.ts";
import { Session } from "../state/session.svelte.ts";
import { start } from "./hook.ts";

const imported = vi.hoisted(() => ({ n: 0 }));
vi.mock("./feed.ts", () => {
  imported.n++;
  throw new Error("the feed must not be imported with no folder");
});

describe("no chosen folder (R182)", () => {
  it("sync/feed.ts is never imported: not at the start, not by a finished row, not by a hide", async () => {
    const s = new Session(new FakeCalc(), fakeKv());
    await s.restoreHistory();
    let onHide: (() => void) | undefined;
    const doc = { hidden: false, addEventListener: (_: string, f: () => void) => void (onHide = f) } as unknown as Document;
    const shell = { calc: new FakeCalc(), showMenu: () => {}, clip: undefined } as unknown as Parameters<typeof start>[1];
    start(s, shell, doc, true);
    await s.submit("1+2");
    s.view = "cas";
    await s.submit("x");
    (doc as { hidden: boolean }).hidden = true;
    onHide?.();
    await new Promise((r) => setTimeout(r, 50));
    expect(s.home[0]?.status).toBe("done");
    expect(imported.n).toBe(0);
  });
});
