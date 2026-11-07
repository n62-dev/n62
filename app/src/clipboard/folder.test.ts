// SPDX-License-Identifier: GPL-3.0-or-later
// A65: the sync folder's port with @capacitor/core mocked (never a device in unit tests; the device check is in the report).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { folderList, folderName, folderRead, folderWrite, forgetFolder, pickFolder, validName } from "./folder.ts";

const cap = vi.hoisted(() => ({
  native: false,
  available: new Set<string>(),
  files: { pickFolder: vi.fn(), folder: vi.fn(), forget: vi.fn(), write: vi.fn(), read: vi.fn(), list: vi.fn() },
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => cap.native, isPluginAvailable: (n: string) => cap.available.has(n) },
  registerPlugin: (n: string) => (n === "N62Files" ? cap.files : {}),
}));

const NONE = { result: "unavailable" };
function native(): void {
  cap.native = true;
  cap.available = new Set(["N62Files"]);
}

beforeEach(() => {
  cap.native = false;
  cap.available = new Set();
  for (const f of Object.values(cap.files)) f.mockReset();
});

describe("on the web (no native plugin)", () => {
  it("every call is unavailable and the plugin is never called", async () => {
    expect(await pickFolder()).toBe("unavailable");
    expect(await folderName()).toBe("unavailable");
    expect(await folderWrite("n62-test.txt", "x")).toBe("unavailable");
    expect(await folderRead("n62-test.txt")).toBe("unavailable");
    expect(await folderList()).toBe("unavailable");
    await forgetFolder();
    for (const f of Object.values(cap.files)) expect(f).not.toHaveBeenCalled();
  });

  it("native but an APK without N62Files is unavailable too", async () => {
    cap.native = true;
    expect(await folderWrite("a.txt", "x")).toBe("unavailable");
    expect(cap.files.write).not.toHaveBeenCalled();
  });
});

describe("no folder chosen (the plugin answers unavailable)", () => {
  it("each call resolves unavailable, never throws", async () => {
    native();
    cap.files.folder.mockResolvedValue(NONE);
    cap.files.write.mockResolvedValue(NONE);
    cap.files.read.mockResolvedValue(NONE);
    cap.files.list.mockResolvedValue(NONE);
    expect(await folderName()).toBe("unavailable");
    expect(await folderWrite("n62-test.txt", "x")).toBe("unavailable");
    expect(await folderRead("n62-test.txt")).toBe("unavailable");
    expect(await folderList()).toBe("unavailable");
  });

  it("an APK from before A65 (method UNIMPLEMENTED) is unavailable, not failed", async () => {
    native();
    const unimplemented = Object.assign(new Error("not implemented"), { code: "UNIMPLEMENTED" });
    cap.files.write.mockRejectedValue(unimplemented);
    cap.files.read.mockRejectedValue(unimplemented);
    cap.files.pickFolder.mockRejectedValue(unimplemented);
    expect(await folderWrite("a.txt", "x")).toBe("unavailable");
    expect(await folderRead("a.txt")).toBe("unavailable");
    expect(await pickFolder()).toBe("unavailable");
  });
});

describe("pickFolder", () => {
  it("returns the picked folder's name", async () => {
    native();
    cap.files.pickFolder.mockResolvedValue({ result: "picked", name: "Sync" });
    expect(await pickFolder()).toEqual({ name: "Sync" });
  });
  it("cancelled when the user backs out of the picker", async () => {
    native();
    cap.files.pickFolder.mockResolvedValue({ result: "cancelled" });
    expect(await pickFolder()).toBe("cancelled");
  });
  it("unavailable when the picker gave no persistable grant", async () => {
    native();
    cap.files.pickFolder.mockResolvedValue(NONE);
    expect(await pickFolder()).toBe("unavailable");
  });
});

describe("with a folder", () => {
  it("folderName gives the kept folder's name", async () => {
    native();
    cap.files.folder.mockResolvedValue({ result: "ok", name: "Sync" });
    expect(await folderName()).toEqual({ name: "Sync" });
  });

  it("folderWrite passes name and text through and reports written", async () => {
    native();
    cap.files.write.mockResolvedValue({ result: "written" });
    expect(await folderWrite("n62-backup-2026-11-07.json", '{"a":"∑"}')).toBe("written");
    expect(cap.files.write).toHaveBeenCalledWith({ name: "n62-backup-2026-11-07.json", text: '{"a":"∑"}' });
  });

  it("folderWrite is failed on an I/O rejection", async () => {
    native();
    cap.files.write.mockRejectedValue(new Error("disk full"));
    expect(await folderWrite("a.txt", "x")).toBe("failed");
  });

  it("folderRead returns the text, or missing", async () => {
    native();
    cap.files.read.mockResolvedValueOnce({ result: "ok", text: "hello\n" }).mockResolvedValueOnce({ result: "missing" });
    expect(await folderRead("n62-test.txt")).toEqual({ text: "hello\n" });
    expect(await folderRead("other.txt")).toBe("missing");
    expect(cap.files.read).toHaveBeenNthCalledWith(1, { name: "n62-test.txt" });
  });

  it("folderRead is failed on a rejection (I/O, too large) or an answer without text", async () => {
    native();
    cap.files.read.mockRejectedValueOnce(new Error("file over 4194304 bytes")).mockResolvedValueOnce({ result: "ok" });
    expect(await folderRead("big.json")).toBe("failed");
    expect(await folderRead("odd.json")).toBe("failed");
  });

  it("folderList returns the files with numbers, dropping malformed rows", async () => {
    native();
    cap.files.list.mockResolvedValue({
      result: "ok",
      files: [{ name: "n62-test.txt", size: 6, modified: 1762500000000 }, { size: 3 }, { name: "b.json", size: "12", modified: null }],
    });
    expect(await folderList()).toEqual([
      { name: "n62-test.txt", size: 6, modified: 1762500000000 },
      { name: "b.json", size: 12, modified: 0 },
    ]);
  });

  it("folderList is unavailable when the plugin rejects", async () => {
    native();
    cap.files.list.mockRejectedValue(new Error("boom"));
    expect(await folderList()).toBe("unavailable");
  });

  it("forgetFolder calls the plugin and swallows a rejection", async () => {
    native();
    cap.files.forget.mockRejectedValue(new Error("boom"));
    await expect(forgetFolder()).resolves.toBeUndefined();
    expect(cap.files.forget).toHaveBeenCalledOnce();
  });
});

describe("file names (the rule of FolderNames.java)", () => {
  it.each(["n62-test.txt", ".hidden", "Ünïcødé ∑.txt", "a".repeat(255), "é".repeat(127)])("accepts %s", (n) => {
    expect(validName(n)).toBe(true);
  });
  it.each(["", ".", "..", "a/b", "../x", "a\\b", "a\0b", "a".repeat(256), "é".repeat(128)])("refuses %j", (n) => {
    expect(validName(n)).toBe(false);
  });
  it("a bad name never reaches the plugin", async () => {
    native();
    expect(await folderWrite("../escape.txt", "x")).toBe("failed");
    expect(await folderRead("a/b")).toBe("failed");
    expect(cap.files.write).not.toHaveBeenCalled();
    expect(cap.files.read).not.toHaveBeenCalled();
  });
});
