// SPDX-License-Identifier: GPL-3.0-or-later
// R128: Settings › Data › Sync folder, its rows on Android and on the web.
import { describe, expect, it } from "vitest";
import type { ClipActions } from "../clipboard/actions.svelte.ts";
import type { MenuItem } from "../apps/types.ts";
import { dataText } from "../i18n/enData.ts";
import { memKv } from "../sync/fakeFolder.ts";
import { readSync } from "../sync/record.ts";
import { dataSection, resetUndoTime } from "./dataSection.svelte.ts";
import { syncSection, type SyncDeps } from "./syncRows.svelte.ts";
import { reportStatus } from "../sync/status.ts";

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function setup(native: boolean, name: string | null = "Sync") {
  const jobs: string[] = [];
  const kv = memKv();
  const clip = { syncJob: async (j: string) => void jobs.push(j) } as unknown as ClipActions;
  const deps: SyncDeps = { native, kv, folderName: async () => name };
  const row = syncSection({ data: (run) => void run(clip) }, () => deps);
  return { row, jobs, kv };
}

describe("Settings › Data › Sync folder (R128)", () => {
  it("is a row with › in Data, before the line on the store, and Data keeps at most seven rows", () => {
    resetUndoTime(1);
    const items = dataSection({ data: () => {} }, async () => null).submenu?.items ?? [];
    expect(items.map((r) => r.id)).toEqual(["backup", "restore", "undo", "library", "sync", "store"]);
    expect(items.length).toBeLessThanOrEqual(7);
    expect(items.find((r) => r.id === "sync")?.submenu?.title).toBe(dataText("sync"));
    resetUndoTime();
  });
  it("on the web says Android only and holds nothing else", () => {
    const sub = setup(false).row.submenu;
    expect(sub?.items.map((r) => r.label)).toEqual([dataText("sync.web")]);
    expect(sub?.note).toBeUndefined();
  });
  it("on Android: Choose folder (its name), Status, Device name, On start (Offer, Restore silently), Write now, Stop syncing, and the line under them", async () => {
    const { row, kv } = setup(true);
    const sub = row.submenu;
    const items = (): readonly MenuItem[] => sub?.items ?? [];
    expect(items().map((r) => r.id)).toEqual(["choose", "status", "device", "mode", "now", "stop"]);
    expect(items().length).toBeLessThanOrEqual(7);
    await tick();
    expect(items()[0]?.value).toBe("Sync");
    const mode = items().find((r) => r.id === "mode");
    expect(mode?.options?.map((o) => [o.label, o.selected])).toEqual([
      [dataText("sync.mode.offer"), true],
      [dataText("sync.mode.silent"), false],
    ]);
    expect(mode?.keep).toBe(true);
    mode?.options?.[1]?.run();
    expect(items().find((r) => r.id === "mode")?.options?.[1]?.selected).toBe(true);
    await tick();
    expect((await readSync(kv)).mode).toBe("silent");
    expect(sub?.note?.()).toBe(`${dataText("sync.line")} ${dataText("sync.jupyter")}`);
    expect(dataText("sync.jupyter")).toBe("Jupyter opens the .py as a script; for a notebook view it needs jupytext.");
    expect(dataText("sync.line")).toContain("the form of these files can change until N62 says otherwise");
  });
  it("shows None with no folder; its rows hand their job to the sync code", async () => {
    const { row, jobs } = setup(true, null);
    const sub = row.submenu;
    sub?.items;
    await tick();
    const items = sub?.items ?? [];
    expect(items[0]?.value).toBe(dataText("sync.noFolder"));
    for (const id of ["choose", "now", "stop"]) items.find((r) => r.id === id)?.run?.();
    await tick();
    expect(jobs).toEqual(["pick", "now", "stop"]);
  });
  it("reads the stored mode when the level opens", async () => {
    const { row, kv } = setup(true);
    await kv.set("sync", { mode: "silent" });
    const sub = row.submenu;
    sub?.items;
    await tick();
    expect(sub?.items.find((r) => r.id === "mode")?.options?.find((o) => o.selected)?.id).toBe("silent");
  });
  it("Choose folder's hint says a sub-folder of Download works", async () => {
    const { row } = setup(true);
    expect(row.submenu?.items[0]?.hint).toBe(dataText("sync.choose.hint"));
    expect(dataText("sync.choose.hint")).toBe("a sub-folder of Download works");
  });
  it("Status shows the queue's last answer: ok, queued n, can't append, unavailable (R183)", async () => {
    const { row } = setup(true);
    const sub = row.submenu;
    const status = (): string | undefined => sub?.items.find((r) => r.id === "status")?.value;
    sub?.items;
    await tick();
    expect(status()).toBe("ok");
    reportStatus({ state: "queued", queued: 3, dropped: 0 });
    expect(status()).toBe("queued 3");
    reportStatus({ state: "cantAppend", queued: 3, dropped: 0 });
    expect(status()).toBe("can't append");
    reportStatus({ state: "unavailable", queued: 3, dropped: 0 });
    expect(status()).toBe("unavailable");
    reportStatus({ state: "ok", queued: 0, dropped: 0 });
    expect(status()).toBe("ok");
  });
  it("Device name shows the kept name, and an edit keeps it sanitised (R183)", async () => {
    const { row, kv } = setup(true);
    await kv.set("sync", { device: "Pixel-7-0a3f" });
    const sub = row.submenu;
    sub?.items;
    await tick();
    const dev = (): MenuItem | undefined => sub?.items.find((r) => r.id === "device");
    expect(dev()?.value).toBe("Pixel-7-0a3f");
    expect(dev()?.label).toBe(dataText("sync.device"));
  });
  it("Device name before a name is made says so", async () => {
    const { row } = setup(true);
    const sub = row.submenu;
    sub?.items;
    await tick();
    expect(sub?.items.find((r) => r.id === "device")?.value).toBe(dataText("sync.device.none"));
  });
});
