// SPDX-License-Identifier: GPL-3.0-or-later
// R278: the three cluster cells that changed. ☰ (r0c4) does what the status line's ☰ does, and is a dead press where the
// view has no menu; Shift + Select is dead (Help is not built, R197); Shift + Deselect is a reserved cell: it changes nothing on
// the line or the screen, a tap or a flick up. The real route.press, a stub context (no MathLive, no field).
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
  };
  const shell = { app: null, sheet: null, sheetPending: null, loading: null, prompt: null, opening: Promise.resolve(), showsEntry: true, toggleMenu: () => (log.push("toggleMenu"), menu) };
  const c = {
    session, shell, entry, picked: null as number | null, sheetLoad: null, waiting: [], casKeys: false,
    enter() {}, insertResult() {}, recallRow() {}, goTo() {}, clearKey() {}, openSettings: () => void log.push("settings"), openMode() {}, openTemplates() {}, openShiftPalette() {}, openFind() {}, openNames() {},
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
  test("Shift + Select is dead: Help is not built", () => {
    const { press, log } = ctx(true);
    press("select", "shift");
    expect(log).toEqual(["dead"]);
  });
  test("Shift + Deselect and a flick up on it are dead and change nothing on the line", () => {
    const { press, log, entry } = ctx(true);
    const before = entry.value;
    press("deselect", "shift"); // a flick up fires the Shift layer: the same press
    expect(log).toEqual(["dead"]);
    expect(entry.value).toBe(before);
    expect(keyboard.byId.get("deselect")?.actions.shift).toBeUndefined(); // reserved: no action, no legend
    expect(keyboard.byId.get("deselect")?.label.shift).toBeUndefined();
  });
});
