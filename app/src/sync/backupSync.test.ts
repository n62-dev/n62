// SPDX-License-Identifier: GPL-3.0-or-later
// R128: the backup through the sync folder, the folder port stubbed by a map: the names, the writes on leave, the
// start's offer and the silent restore.
import { describe, expect, it } from "vitest";
import { validName, type FolderFile, type ReadResult, type WriteResult } from "../clipboard/folder.ts";
import { BACKUP_KEYS, LEFT_OUT, makeBackup } from "../state/backup.ts";
import { countsText } from "../state/countsFile.ts";
import { DATA_VERSION } from "../state/storage.ts";
import type { RawRecord } from "../state/storageRaw.ts";
import type { TapCounts } from "../state/taps.svelte.ts";
import { SyncFolder, type FolderPort, type OtherBackup, type StartUi, type SyncHost } from "./backupSync.ts";
import { deviceSlug, newDeviceName } from "./device.ts";
import { memKv } from "./fakeFolder.ts";
import { leaveNotice } from "./live.ts";
import { readSync, SYNC_KEY } from "./record.ts";

interface Folder extends FolderPort {
  files: Map<string, { text: string; modified: number }>;
  writes: string[];
  reads: string[];
  chosen: boolean;
}
function folder(model = "Pixel 7"): Folder {
  const f: Folder = {
    files: new Map(),
    writes: [],
    reads: [],
    chosen: true,
    name: async () => (f.chosen ? { name: "Sync" } : "unavailable"),
    list: async (): Promise<FolderFile[] | "unavailable"> =>
      f.chosen ? [...f.files].map(([name, v]) => ({ name, size: new TextEncoder().encode(v.text).length, modified: v.modified })) : "unavailable",
    read: async (name): Promise<ReadResult> => {
      f.reads.push(name);
      if (!f.chosen) return "unavailable";
      const v = f.files.get(name);
      return v ? { text: v.text } : "missing";
    },
    write: async (name, text): Promise<WriteResult> => {
      if (!f.chosen) return "unavailable";
      if (!validName(name)) return "failed";
      f.writes.push(name);
      f.files.set(name, { text, modified: Date.now() });
      return "written";
    },
    model: async () => model,
  };
  return f;
}

const rec = (value: unknown): RawRecord => ({ "@n62": DATA_VERSION, value });
const counts = (presses: number): TapCounts => ({ shift: 1, alpha: 0, presses, presets: 0, keys: presses ? { "k:sin": presses } : {}, since: "2026-11-01" });
const LIB = "// n62 library 1\nf(x):=x^2\n";

function host(dir: Folder, store: Map<string, RawRecord> = new Map([["settings", rec({ digits: 12 })]]), more: Partial<SyncHost> = {}): SyncHost & { store: Map<string, RawRecord>; kv: ReturnType<typeof memKv> } {
  let n = 0;
  return {
    folder: dir,
    kv: memKv(),
    store,
    raw: async (k) => store.get(k),
    counts: () => counts(3),
    library: async () => LIB,
    now: () => new Date(Date.UTC(2026, 10, 9, 12, 0, n++)), // this device's leaves: 2026-11-09 12:00, a second apart
    random: () => 0.0425,
    ...more,
  } as SyncHost & { store: Map<string, RawRecord>; kv: ReturnType<typeof memKv> };
}

/** Another device's backup file, made at `made`. */
async function other(made: string, digits = 9): Promise<string> {
  return JSON.stringify(await makeBackup(async (k) => (k === "settings" ? rec({ digits }) : undefined), new Date(made)));
}
const OTHER = "n62-SM-A546B-77aa-backup.json";

function ui(): StartUi & { shown: string[] } {
  const shown: string[] = [];
  return {
    shown,
    offer: (f: OtherBackup) => void shown.push(`offer ${f.device} ${f.made}`),
    apply: async (f: OtherBackup) => void shown.push(`apply ${f.device} ${f.made}`),
    refused: (f: OtherBackup, why: string) => void shown.push(`refused ${f.device}: ${why}`),
  };
}

describe("the device name (R128)", () => {
  it("is the model and four hex digits, made once, kept per install, and passes validName", async () => {
    const dir = folder("Pixel 7/Pro: \u0007");
    const h = host(dir);
    await new SyncFolder(h).leave();
    const name = (await readSync(h.kv)).device;
    expect(name).toBe("Pixel-7-Pro-0ae1");
    expect(validName(`n62-${name}-backup.json`)).toBe(true);
    await new SyncFolder({ ...h, random: () => 0.9 }).leave(); // a new page: the kept name, not a new one
    expect((await readSync(h.kv)).device).toBe("Pixel-7-Pro-0ae1");
    expect(newDeviceName("é".repeat(80), () => 0.5)).toMatch(/^é+-8000$/);
    expect(new TextEncoder().encode(newDeviceName("é".repeat(80), () => 0.5)).length).toBeLessThanOrEqual(64);
    expect(newDeviceName(undefined, () => 0)).toBe("device-0000");
    expect(deviceSlug("Pixel-7-Pro-0ae1")).toBe("Pixel-7-Pro-0ae1");
  });
  it("is never a name a file in the folder already starts with", async () => {
    const dir = folder("Pixel 7");
    dir.files.set("n62-Pixel-7-0ae1-backup.json", { text: await other("2026-11-01T00:00:00Z"), modified: 1 });
    let r = 0;
    const h = host(dir, undefined, { random: () => [0.0425, 0.5][r++] ?? 0.5 });
    await new SyncFolder(h).onStart(ui());
    expect((await readSync(h.kv)).device).toBe("Pixel-7-8000");
  });
});

describe("writes on leave (R128)", () => {
  it("writes the backup as Save makes it, the library and the counts, each named n62-<device>-", async () => {
    const dir = folder();
    const h = host(dir);
    expect(await new SyncFolder(h).leave()).toEqual({ written: 3 });
    expect(dir.writes.sort()).toEqual(["n62-Pixel-7-0ae1-backup.json", "n62-Pixel-7-0ae1-counts.json", "n62-Pixel-7-0ae1-library.txt"]);
    const b = JSON.parse(dir.files.get("n62-Pixel-7-0ae1-backup.json")?.text ?? "");
    expect(b).toEqual(await makeBackup(h.raw, new Date(b.made)));
    expect(dir.files.get("n62-Pixel-7-0ae1-counts.json")?.text).toBe(countsText(counts(3)));
    expect(dir.files.get("n62-Pixel-7-0ae1-library.txt")?.text).toBe(LIB);
  });
  it("leaves out the library and the counts while there are none", async () => {
    const dir = folder();
    expect(await new SyncFolder(host(dir, undefined, { counts: () => counts(0), library: async () => undefined })).leave()).toEqual({ written: 1 });
    expect(dir.writes).toEqual(["n62-Pixel-7-0ae1-backup.json"]);
  });
  it("writes once per leave, and only what changed since the last write", async () => {
    const dir = folder();
    const h = host(dir);
    const s = new SyncFolder(h);
    const [a, b] = await Promise.all([s.leave(), s.leave()]); // the hide and the pagehide of one leave
    expect(a).toBe(b);
    expect(dir.writes).toHaveLength(3);
    expect(await s.leave()).toBe("unchanged"); // a new `made`, the same data
    expect(dir.writes).toHaveLength(3);
    h.store.set("view", rec("cas"));
    expect(await s.leave()).toEqual({ written: 1 });
    expect(dir.writes.at(-1)).toBe("n62-Pixel-7-0ae1-backup.json");
  });
  it("after a restart, compares with its own file in the folder before it writes", async () => {
    const dir = folder();
    const h = host(dir);
    await new SyncFolder(h).leave();
    dir.writes.length = 0;
    expect(await new SyncFolder(h).leave()).toBe("unchanged");
    expect(dir.writes).toEqual([]);
  });
  it("never changes another device's files or a name it did not write", async () => {
    const dir = folder();
    const theirs: [string, string][] = [
      [OTHER, await other("2026-11-01T00:00:00Z")],
      ["n62-SM-A546B-77aa-library.txt", "// n62 library 1\ng(x):=1\n"],
      ["n62-SM-A546B-77aa-counts.json", countsText(counts(9))],
      ["library.txt", "mine, by hand"],
    ];
    for (const [n, t] of theirs) dir.files.set(n, { text: t, modified: 1 });
    await new SyncFolder(host(dir)).leave();
    for (const [n, t] of theirs) expect(dir.files.get(n)?.text, n).toBe(t);
    expect(dir.writes.every((n) => n.startsWith("n62-Pixel-7-0ae1-"))).toBe(true);
  });
  it("writes nothing, and makes no name, while no folder is chosen", async () => {
    const dir = folder();
    dir.chosen = false;
    const h = host(dir);
    expect(await new SyncFolder(h).leave()).toBe("unavailable");
    expect(dir.writes).toEqual([]);
    expect(h.kv.data.has(SYNC_KEY)).toBe(false);
  });
});

describe("on start (R128)", () => {
  it("offers the newest other backup by its made, once; Not now asks again only for a newer file", async () => {
    const dir = folder();
    dir.files.set(OTHER, { text: await other("2026-11-10T08:00:00Z"), modified: 9 });
    dir.files.set("n62-Tab-1234-backup.json", { text: await other("2026-11-12T08:00:00Z"), modified: 1 }); // newer, older mtime
    const h = host(dir);
    const u = ui();
    expect(await new SyncFolder(h).onStart(u)).toBe("offered");
    expect(u.shown).toEqual(["offer Tab-1234 2026-11-12T08:00:00.000Z"]);
    expect(await new SyncFolder(h).onStart(u)).toBe("none"); // Not now: the same file is not offered again
    dir.files.set(OTHER, { text: await other("2026-11-13T08:00:00Z"), modified: 9 });
    expect(await new SyncFolder(h).onStart(u)).toBe("offered");
    expect(u.shown.at(-1)).toBe("offer SM-A546B-77aa 2026-11-13T08:00:00.000Z");
  });
  it("never offers this device's own backup, and nothing without a folder", async () => {
    const dir = folder();
    const h = host(dir);
    await new SyncFolder(h).leave();
    expect(await new SyncFolder(h).onStart(ui())).toBe("none");
    dir.chosen = false;
    dir.files.set(OTHER, { text: await other("2026-11-13T08:00:00Z"), modified: 9 });
    expect(await new SyncFolder(h).onStart(ui())).toBe("none");
  });
  it("Restore silently: applies the file only while its own backup in the folder holds its state, else offers", async () => {
    const dir = folder();
    const h = host(dir);
    await h.kv.set(SYNC_KEY, { mode: "silent" });
    dir.files.set(OTHER, { text: await other("2026-11-10T08:00:00Z"), modified: 9 });
    const u = ui();
    expect(await new SyncFolder(h).onStart(u)).toBe("offered"); // no own file yet: the state is in no folder
    await new SyncFolder(h).leave();
    h.store.set("view", rec("cas")); // changed since the last leave
    dir.files.set(OTHER, { text: await other("2026-11-11T08:00:00Z"), modified: 9 });
    expect(await new SyncFolder(h).onStart(u)).toBe("offered");
    await new SyncFolder(h).leave(); // the leave wrote it
    dir.files.set(OTHER, { text: await other("2026-11-12T08:00:00Z"), modified: 9 });
    expect(await new SyncFolder(h).onStart(u)).toBe("applied");
    expect(u.shown).toEqual(["offer SM-A546B-77aa 2026-11-10T08:00:00.000Z", "offer SM-A546B-77aa 2026-11-11T08:00:00.000Z", "apply SM-A546B-77aa 2026-11-12T08:00:00.000Z"]);
  });
  it("a file the check refuses is never applied, and says why, once", async () => {
    const dir = folder();
    const h = host(dir);
    await h.kv.set(SYNC_KEY, { mode: "silent" });
    await new SyncFolder(h).leave();
    const bad = JSON.parse(await other("2026-11-12T08:00:00Z"));
    bad.parts.settings.value.digits = 99;
    dir.files.set(OTHER, { text: JSON.stringify(bad), modified: 9 });
    const u = ui();
    expect(await new SyncFolder(h).onStart(u)).toBe("refused");
    expect(u.shown).toHaveLength(1);
    expect(u.shown[0]).toMatch(/^refused SM-A546B-77aa: .*Settings/);
    expect(await new SyncFolder(h).onStart(u)).toBe("none");
  });
});

describe("on start, against this device's own file (R128f1)", () => {
  for (const mode of ["silent", "offer"] as const) {
    it(`${mode}: another device's file made before this device's own leave is marked read, never offered or applied`, async () => {
      const dir = folder();
      const h = host(dir);
      await h.kv.set(SYNC_KEY, { mode });
      dir.files.set(OTHER, { text: await other("2026-11-09T10:00:00Z"), modified: 9 }); // A left at 10:00
      await new SyncFolder(h).leave(); // B leaves at 12:00, then is closed
      const u = ui();
      expect(await new SyncFolder(h).onStart(u)).toBe("none");
      expect(u.shown).toEqual([]);
      expect((await readSync(h.kv)).read).toEqual({ name: OTHER, made: "2026-11-09T10:00:00.000Z" });
      dir.files.set(OTHER, { text: await other("2026-11-09T13:00:00Z"), modified: 9 }); // A's later work: as before
      expect(await new SyncFolder(h).onStart(u)).toBe(mode === "silent" ? "applied" : "offered");
      expect(u.shown).toEqual([`${mode === "silent" ? "apply" : "offer"} SM-A546B-77aa 2026-11-09T13:00:00.000Z`]);
    });
  }
  it("a file that holds this device's own parts is marked read and shows nothing", async () => {
    const dir = folder();
    const h = host(dir);
    await h.kv.set(SYNC_KEY, { mode: "silent" });
    await new SyncFolder(h).leave();
    // A restored B's backup and left: B's parts, a later made
    const mine = JSON.parse(dir.files.get("n62-Pixel-7-0ae1-backup.json")?.text ?? "");
    dir.files.set(OTHER, { text: JSON.stringify({ ...mine, made: "2026-11-10T08:00:00.000Z" }), modified: 9 });
    const u = ui();
    expect(await new SyncFolder(h).onStart(u)).toBe("none");
    expect(u.shown).toEqual([]);
    expect((await readSync(h.kv)).read?.made).toBe("2026-11-10T08:00:00.000Z");
    await h.kv.set(SYNC_KEY, { mode: "offer" });
    dir.files.set(OTHER, { text: JSON.stringify({ ...mine, made: "2026-11-11T08:00:00.000Z" }), modified: 9 });
    expect(await new SyncFolder(h).onStart(u)).toBe("none");
    expect(u.shown).toEqual([]);
  });
});

describe("Write now's notice (R128f1)", () => {
  it("says one file in the singular, more in the plural", () => {
    expect(leaveNotice({ written: 1 })).toBe("Written to the sync folder: 1 file");
    expect(leaveNotice({ written: 3 })).toBe("Written to the sync folder: 3 files");
    expect(leaveNotice("unchanged")).toBe("Nothing changed since the last write");
  });
});

describe("the page's own record (R128)", () => {
  it("is per install: left out of a backup, never in one", async () => {
    expect(LEFT_OUT).toContain(SYNC_KEY);
    expect(BACKUP_KEYS).not.toContain(SYNC_KEY);
    const dir = folder();
    const h = host(dir);
    h.store.set(SYNC_KEY, rec({ mode: "silent", device: "x-0000" }));
    await new SyncFolder(h).leave();
    expect(Object.keys(JSON.parse(dir.files.get("n62-Pixel-7-0ae1-backup.json")?.text ?? "").parts)).not.toContain(SYNC_KEY);
  });
});
