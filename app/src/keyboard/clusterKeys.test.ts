// SPDX-License-Identifier: GPL-3.0-or-later
// R278: the three cluster cells that changed. ☰ (r0c4) does what the status line's ☰ does, and is a dead press where the
// view has no menu; Shift + Select is Help (R197: the help sheet of the function at the cursor); Shift + Deselect is Mode
// (R322, owner 2026-11-14: it opens the Mode sheet on Angle, as Shift + Fmt did), and Shift + Fmt is now the reserved cell:
// it changes nothing on the line or the screen, a tap or a flick up. The real route.press, a stub context (no MathLive, no field).
import { describe, expect, test, vi } from "vitest";

vi.mock("../render/mathlive.svelte.ts", () => ({ mathlive: { load: () => new Promise(() => {}) } }));
vi.mock("../entry/field.ts", () => ({}));
vi.mock("../entry/hwkeys.ts", () => ({}));
// the sheet chunk is "in" (☰ and Settings wait for it otherwise, R8)
vi.mock("../views/sheetView.svelte.ts", () => ({ sheetChunk: { C: {}, pad: null, keys: null, palette: null }, loadSheetView: async () => {} }));

const { EntryController } = await import("../entry/controller.ts");
const route = await import("./route.ts");
const { keyboard } = await import("./keyboard.ts");

function ctx(menu: boolean) {
  const log: string[] = [];
  const entry = new EntryController();
  const session = {
    shift: false,
    alpha: false,
    shiftLock: false,
    settings: { entry: "textbook" },
    items: [],
    taps: { tap() {} },
    clearModifiers() {},
    hasResult: () => false,
    cycleFormat: async () => void log.push("cycleFormat"),
  };
  const shell = { app: null, sheet: null, sheetPending: null, loading: null, prompt: null, opening: Promise.resolve(), showsEntry: true, toggleMenu: () => (log.push("toggleMenu"), menu) };
  const c = {
    session, shell, entry, picked: null as number | null, sheetLoad: null, waiting: [], casKeys: false,
    enter() {}, insertResult() {}, recallRow() {}, goTo() {}, clearKey() {}, openSettings: () => void log.push("settings"), openMode: (at?: string) => void log.push(`mode:${at ?? "angle"}`), openTemplates() {}, openShiftPalette() {}, openFind() {}, openHelp: () => void log.push("help"), openMatrix() {}, openNames() {}, openStore() {},
    withClip: (run: (x: never) => void) => run({} as never),
    loadClip() {}, dead: () => void log.push("dead"), unfold: () => false,
  };
  const press = (id: string, layer?: "shift" | "alpha" | "primary"): void => {
    const key = keyboard.byId.get(id);
    if (!key) throw new Error(`no key ${id}`);
    route.press(c as never, key, layer);
  };
  return { c, entry, log, press };
}

describe("the cluster's ☰, Select and Deselect (R278)", () => {
  test("☰ toggles the view's menu, like the status line's ☰", () => {
    const { press, log } = ctx(true);
    press("menu");
    expect(log).toEqual(["toggleMenu"]);
  });
  test("☰ in a view with no menu is a dead press", () => {
    const { press, log } = ctx(false);
    press("menu");
    expect(log).toEqual(["toggleMenu", "dead"]);
  });
  test("Shift + ☰ opens Settings", () => {
    const { press, log } = ctx(true);
    press("menu", "shift");
    expect(log).toEqual(["settings"]);
  });
  test("Shift + Select (and a flick up on it) opens Help (R197); the tap is still Select", () => {
    const { press, log } = ctx(true);
    press("select", "shift");
    expect(log).toEqual(["help"]);
    expect(keyboard.byId.get("select")?.actions.primary).toEqual({ kind: "special", name: "selectGrow" });
  });
  test("Shift + Deselect (and a flick up on it) opens the Mode sheet on Angle (R322); the tap is still Deselect (R279)", () => {
    const { press, log } = ctx(true);
    press("deselect", "shift"); // a flick up fires the Shift layer: the same press
    expect(log).toEqual(["mode:angle"]);
    expect(keyboard.byId.get("deselect")?.actions.shift).toEqual({ kind: "special", name: "mode" });
    expect(keyboard.byId.get("deselect")?.label.shift).toBe("$key.mode");
    expect(keyboard.byId.get("deselect")?.actions.primary).toEqual({ kind: "special", name: "selectShrink" });
  });
});

describe("Fmt (R322): the tap cycles the format, Shift + Fmt is reserved", () => {
  test("Fmt's tap still cycles the last result's format", () => {
    const { press, log } = ctx(true);
    press("fmt");
    expect(log).toEqual(["cycleFormat"]);
  });
  test("Shift + Fmt and a flick up on it are dead and change nothing on the line: no action, no legend", () => {
    const { press, log, entry } = ctx(true);
    const before = entry.value;
    press("fmt", "shift");
    expect(log).toEqual(["dead"]);
    expect(entry.value).toBe(before);
    expect(keyboard.byId.get("fmt")?.actions.shift).toBeUndefined();
    expect(keyboard.byId.get("fmt")?.label.shift).toBeUndefined();
  });
});
