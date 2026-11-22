// SPDX-License-Identifier: GPL-3.0-or-later
// R128: the app's side of the sync folder: the silent restore's one history line after its reload, and no folder on
// the web (Vitest runs as the web: no native plugin), where nothing is written. R855: Choose folder runs the start's look
// at once, the folder plugin and the store stubbed (vi.mock) by maps.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FolderFile, PickResult, ReadResult } from "../clipboard/folder.ts";
import { makeBackup } from "../state/backup.ts";
import { DATA_VERSION } from "../state/storage.ts";
import { FakeCalc } from "../calc/fake.ts";
import { dataText } from "../i18n/enData.ts";
import { fakeKv } from "../state/fakeKv.ts";
import { Session } from "../state/session.svelte.ts";
import { start } from "./hook.ts";
import { memKv } from "./fakeFolder.ts";
import { onStart, syncJob } from "./live.ts";

/** The plugin's folder (a map; `chosen` false: no folder, as on the web) and the store live.ts reads. */
const fake = vi.hoisted(() => ({
  files: new Map<string, string>(),
  chosen: false,
  pick: "cancelled" as unknown,
  kv: undefined as unknown,
}));
vi.mock("../clipboard/folder.ts", async (orig) => ({
  ...(await orig<typeof import("../clipboard/folder.ts")>()),
  pickFolder: async (): Promise<PickResult> => {
    const r = fake.pick as PickResult;
    if (typeof r === "object") fake.chosen = true;
    return r;
  },
  folderName: async () => (fake.chosen ? { name: "Sync" } : "unavailable"),
  folderList: async (): Promise<FolderFile[] | "unavailable"> =>
    fake.chosen ? [...fake.files].map(([name, text]) => ({ name, size: text.length, modified: 1 })) : "unavailable",
  folderRead: async (name: string): Promise<ReadResult> => {
    if (!fake.chosen) return "unavailable";
    const t = fake.files.get(name);
    return t === undefined ? "missing" : { text: t };
  },
  folderWrite: async (name: string, text: string) => (fake.chosen ? (fake.files.set(name, text), "written" as const) : ("unavailable" as const)),
  folderModel: async () => "Pixel 7",
}));
vi.mock("../state/storage.ts", async (orig) => {
  const m = await orig<typeof import("../state/storage.ts")>();
  const kv: import("../state/storage.ts").Kv = { get: (k) => (fake.kv as typeof kv).get(k), set: (k, v) => (fake.kv as typeof kv).set(k, v) };
  return { ...m, idbKv: kv };
});
vi.mock("../state/storageRaw.ts", async (orig) => ({ ...(await orig<typeof import("../state/storageRaw.ts")>()), kvGetRaw: async () => undefined }));

beforeEach(() => {
  fake.files.clear();
  fake.chosen = false;
  fake.pick = "cancelled";
  fake.kv = memKv();
});

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
  it("the hook (main.ts's one import) listens for a hide on Android only", () => {
    const listened: string[] = [];
    const doc = { hidden: false, addEventListener: (type: string) => void listened.push(type) } as unknown as Document;
    const session = new Session(new FakeCalc(), fakeKv());
    const shell = { calc: new FakeCalc(), showMenu: () => {}, clip: undefined } as unknown as Parameters<typeof onStart>[1];
    start(session, shell, doc, false);
    expect(listened).toEqual([]);
    start(session, shell, doc, true);
    expect(listened).toEqual(["visibilitychange"]);
  });
});

/** Another device's backup file, made at `made`. */
const other = async (made: string): Promise<string> =>
  JSON.stringify(await makeBackup(async (k) => (k === "settings" ? { "@n62": DATA_VERSION, value: { digits: 9 } } : undefined), new Date(made)));
const OTHER = "n62-SM-A546B-77aa-backup.json";

/** A shell that records the sheets shown and the notices said, in order. */
function shown(): { shell: Parameters<typeof syncJob>[2]; log: string[] } {
  const log: string[] = [];
  const shell = {
    calc: new FakeCalc(),
    showMenu: (title: string, items: { label: string }[]) => void log.push(`sheet ${title}: ${items[0]?.label ?? ""}`),
    clip: { say: (m: string) => void log.push(`say ${m}`) },
  } as unknown as Parameters<typeof syncJob>[2];
  return { shell, log };
}

describe("Choose folder looks at the other devices' backups at once (R855)", () => {
  it("offers another device's newer backup after the pick, once, after the chosen notice; the start's line stays", async () => {
    fake.files.set(OTHER, await other("2026-11-20T08:00:00Z"));
    fake.pick = { name: "Sync" };
    const session = new Session(new FakeCalc(), fakeKv());
    const { shell, log } = shown();
    const k = kept();
    k.setItem("n62.syncRestored", "Restored the backup from Tab-1234");
    await syncJob("pick", session, shell, k);
    const offer = dataText("sync.offer", { device: "SM-A546B-77aa", made: "" }).split(",")[0] as string;
    expect(log).toHaveLength(2);
    expect(log[0]).toBe(`say ${dataText("sync.chosen", { name: "Sync" })}`);
    expect(log[1]).toContain(`sheet ${dataText("sync")}: ${offer}`);
    expect(k.getItem("n62.syncRestored")).toBe("Restored the backup from Tab-1234"); // kept for the next start
    await syncJob("pick", session, shell, k); // the same folder again: the same one offer, not a second
    expect(log).toEqual([log[0], log[1], log[0]]);
  });
  it("a cancelled pick looks at nothing", async () => {
    fake.chosen = true; // a folder kept from before
    fake.files.set(OTHER, await other("2026-11-20T08:00:00Z"));
    fake.pick = "cancelled";
    const { shell, log } = shown();
    await syncJob("pick", new Session(new FakeCalc(), fakeKv()), shell, kept());
    expect(log).toEqual([`say ${dataText("sync.cancelled")}`]);
  });
  it("a folder with only this device's file: the chosen notice alone", async () => {
    fake.chosen = true;
    const session = new Session(new FakeCalc(), fakeKv());
    const { shell, log } = shown();
    expect(await syncJob("now", session, shell)).toBe(dataText("sync.writtenOne"));
    log.length = 0;
    expect([...fake.files.keys()]).toEqual([expect.stringMatching(/^n62-Pixel-7-[0-9a-f]{4}-backup\.json$/)]);
    fake.pick = { name: "Sync" };
    await syncJob("pick", session, shell, kept());
    expect(log).toEqual([`say ${dataText("sync.chosen", { name: "Sync" })}`]);
  });
});
