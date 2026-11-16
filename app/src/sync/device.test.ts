// SPDX-License-Identifier: GPL-3.0-or-later
// R183: the device name's edit (sync/device.ts renameDevice): kept, sanitised as R128's name is, and the name G218's
// files carry.
import { describe, expect, it } from "vitest";
import { LEFT_OUT } from "../state/backup.ts";
import { deviceName, deviceSlug, renameDevice } from "./device.ts";
import { filesFor, syncBase, syncFilesState } from "./files.ts";
import { memKv } from "./fakeFolder.ts";
import { readSync, SYNC_KEY } from "./record.ts";
import type { HistoryItem } from "../state/session.svelte.ts";

const model = async (): Promise<string | undefined> => "Pixel 7";

describe("the device name's edit (R183)", () => {
  it("the page's record, which holds the name, stays out of a backup", () => {
    expect(LEFT_OUT).toContain(SYNC_KEY);
  });
  it("an edited name is kept: the next read gives it, not a new one", async () => {
    const kv = memKv();
    const made = await deviceName(kv, model, () => 0.5);
    expect(made).toBe("Pixel-7-8000");
    expect(await renameDevice(kv, "Kitchen tablet")).toBe("Kitchen-tablet");
    expect(await deviceName(kv, model, () => 0.1)).toBe("Kitchen-tablet");
    expect((await readSync(kv)).device).toBe("Kitchen-tablet");
  });
  it("is sanitised as R128's name is, and keeps the page's other fields", async () => {
    const kv = memKv();
    await kv.set(SYNC_KEY, { mode: "silent" });
    expect(await renameDevice(kv, " a/b:c*d ")).toBe("a-b-c-d");
    expect(await renameDevice(kv, "é".repeat(100))).toBe(deviceSlug("é".repeat(100)));
    expect(new TextEncoder().encode((await readSync(kv)).device ?? "").length).toBeLessThanOrEqual(64);
    expect((await readSync(kv)).mode).toBe("silent");
  });
  it("a blank edit keeps the old name", async () => {
    const kv = memKv();
    await renameDevice(kv, "Desk");
    expect(await renameDevice(kv, "  ")).toBe("Desk");
    expect((await readSync(kv)).device).toBe("Desk");
  });
  it("a name another device's files carry is refused, the old name stays (R183f1)", async () => {
    const kv = memKv();
    await deviceName(kv, model, () => 0.5); // Pixel-7-8000
    const taken = ["n62-Pixel-7-77aa-backup.json", "n62-Pixel-7-8000-backup.json", "n62-Pixel-7-77aa-counts.json"];
    expect(await renameDevice(kv, "Pixel-7-77aa", taken)).toBe("Pixel-7-8000"); // device B renamed to A's name
    expect(await renameDevice(kv, "Pixel 7", taken)).toBe("Pixel-7-8000"); // typed as the model, a prefix of A's files
    expect((await readSync(kv)).device).toBe("Pixel-7-8000");
  });
  it("this device's own current name and a free name still work with a folder (R183f1)", async () => {
    const kv = memKv();
    await deviceName(kv, model, () => 0.5);
    const taken = ["n62-Pixel-7-77aa-backup.json", "n62-Pixel-7-8000-backup.json"];
    expect(await renameDevice(kv, "Pixel-7-8000", taken)).toBe("Pixel-7-8000");
    expect(await renameDevice(kv, "Kitchen tablet", taken)).toBe("Kitchen-tablet");
    expect(await renameDevice(kv, "  ", taken)).toBe("Kitchen-tablet");
    expect((await readSync(kv)).device).toBe("Kitchen-tablet");
    expect(await renameDevice(kv, "Kitchen tablet", [...taken, "n62-Kitchen-tablet-backup.json"])).toBe("Kitchen-tablet"); // its own
  });
  it("the files the sync writes carry the edited name (G218)", async () => {
    const kv = memKv();
    const name = await renameDevice(kv, "My phone");
    const now = new Date(2026, 10, 16, 12, 0, 0);
    const row = { uid: "u1", status: "done", latex: "1+1", result: { latex: "2", plain: "2" } } as unknown as HistoryItem;
    const r = filesFor(row, syncFilesState("0.1.0", now), name, now);
    expect(r.files.length).toBeGreaterThan(0);
    for (const f of r.files) expect(f.file.startsWith("n62-My-phone-")).toBe(true);
    expect(syncBase(name, now)).toBe("n62-My-phone-2026-11-16");
  });
});
