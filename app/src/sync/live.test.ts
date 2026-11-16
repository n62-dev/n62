// SPDX-License-Identifier: GPL-3.0-or-later
// R128: the app's side of the sync folder: the silent restore's one history line after its reload, and no folder on
// the web (Vitest runs as the web: no native plugin), where nothing is written.
import { describe, expect, it } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import { dataText } from "../i18n/enData.ts";
import { fakeKv } from "../state/fakeKv.ts";
import { Session } from "../state/session.svelte.ts";
import { onStart, syncJob } from "./live.ts";

function kept(): Pick<Storage, "getItem" | "setItem" | "removeItem"> & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
}

describe("the sync folder in the app (R128)", () => {
  it("a silent restore's line is said once, as one history line in each view, after its reload", async () => {
    const session = new Session(new FakeCalc(), fakeKv());
    const said: string[] = [];
    const shell = { calc: new FakeCalc(), showMenu: () => {}, clip: { say: (m: string) => void said.push(m) } } as unknown as Parameters<typeof onStart>[1];
    const k = kept();
    k.setItem("n62.syncRestored", "Restored the backup from Tab-1234");
    await onStart(session, shell, k);
    expect([...session.home, ...session.cas].filter((i) => i.status === "note").map((i) => i.text)).toEqual(["Restored the backup from Tab-1234", "Restored the backup from Tab-1234"]);
    expect(k.map.size).toBe(0);
    await onStart(session, shell, k);
    expect([...session.home, ...session.cas].filter((i) => i.status === "note")).toHaveLength(2);
    expect(said).toEqual([]); // no folder: nothing offered, nothing said
  });
  it("Write now with no folder says so and writes nothing", async () => {
    const session = new Session(new FakeCalc(), fakeKv());
    const shell = { calc: new FakeCalc(), showMenu: () => {}, clip: undefined } as unknown as Parameters<typeof onStart>[1];
    expect(await syncJob("now", session, shell)).toBe(dataText("sync.unavailable"));
  });
});
