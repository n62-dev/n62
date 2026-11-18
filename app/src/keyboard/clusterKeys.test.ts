// SPDX-License-Identifier: GPL-3.0-or-later
// R723 (the owner, 2026-11-17): the cluster's cells. Row 0, col 4 is Help (its own id `help`, R197), Shift Settings; the
// id `menu` is retired (☰ is on the bar, R722). Shift + Select is Copy (what a hold on the row's result copies, R276, R720):
// the picked row, else the last finished row; no row, or an app, is a dead press with no clipboard write. Shift + Deselect is
// Paste (deselectPaste.test.ts); Mode has no key (the bar's chips). Shift + Fmt and Shift + Vars are reserved: no action, no
// legend, a dead press. The real route.press, a stub context (no MathLive, no field).
import { describe, expect, test, vi } from "vitest";

vi.mock("../render/mathlive.svelte.ts", () => ({ mathlive: { load: () => new Promise(() => {}) } }));
vi.mock("../entry/field.ts", () => ({}));
vi.mock("../entry/hwkeys.ts", () => ({}));
// the sheet chunk is "in" (Settings waits for it otherwise, R8)
vi.mock("../views/sheetView.svelte.ts", () => ({ sheetChunk: { C: {}, pad: null, keys: null, palette: null }, loadSheetView: async () => {} }));

const { EntryController } = await import("../entry/controller.ts");
const route = await import("./route.ts");
const { keyboard, OPENS_SHEET, SPECIALS } = await import("./keyboard.ts");

type Row = { input: string; status: "done" | "error" | "pending" };
const done = (input: string): Row => ({ input, status: "done" });

function ctx(items: Row[] = [], app: string | null = null) {
  const log: string[] = [];
  const entry = new EntryController();
  const session = {
    shift: false,
    alpha: false,
    shiftLock: false,
    settings: { entry: "textbook" },
    items,
    taps: { tap() {} },
    clearModifiers() {},
    hasResult: () => false,
    cycleFormat: async () => void log.push("cycleFormat"),
  };
  const shell = { app, sheet: null, sheetPending: null, loading: null, prompt: null, opening: Promise.resolve(), showsEntry: true, nav: () => false, toggleMenu: () => (log.push("toggleMenu"), true) };
  const clip = {
    holdCopy: async (item: Row, part: string) => void log.push(`copy:${item.input}:${part}`),
    copy: async (item?: Row) => void log.push(`copy:${item?.input ?? "?"}`),
    paste: async () => void log.push("paste"),
  };
  const c = {
    session, shell, entry, picked: null as number | null, sheetLoad: null, waiting: [], casKeys: false,
    enter() {}, insertResult() {}, recallRow() {}, goTo() {}, clearKey() {}, openSettings: () => void log.push("settings"), openMode: (at?: string) => void log.push(`mode:${at ?? "angle"}`), openTemplates() {}, openShiftPalette() {}, openFind() {}, openHelp: () => void log.push("help"), openMatrix() {}, openNames: () => void log.push("names"), openStore() {},
    withClip: (run: (x: typeof clip) => void) => run(clip),
    loadClip() {}, dead: () => void log.push("dead"), unfold: () => false,
  };
  const press = (id: string, layer?: "shift" | "alpha" | "primary"): void => {
    const key = keyboard.byId.get(id);
    if (!key) throw new Error(`no key ${id}`);
    route.press(c as never, key, layer);
  };
  return { c, entry, log, press };
}

describe("row 0, col 4 is Help; Shift Settings (R723)", () => {
  test("the key in that cell has the id help, its face Help and its legend Settings; no key has the id menu", () => {
    const k = keyboard.keys.find((x) => x.row === 0 && x.col === 4);
    expect(k?.id).toBe("help");
    expect(k?.label).toEqual({ primary: "$key.help", shift: "$key.settings" });
    expect(keyboard.byId.has("menu")).toBe(false);
  });
  test("its tap opens Help (R197), Shift + it (and a flick up) Settings", () => {
    const { press, log } = ctx();
    press("help");
    press("help", "shift");
    expect(log).toEqual(["help", "settings"]);
  });
});

describe("Shift + Select is Copy (R723)", () => {
  test("the spec: select.shift is the copy special with the Copy legend; it opens no sheet (no ▾); the tap is still Select", () => {
    const s = keyboard.byId.get("select");
    expect(s?.actions.shift).toEqual({ kind: "special", name: "copy" });
    expect(s?.label.shift).toBe("$key.copy");
    expect(s?.actions.primary).toEqual({ kind: "special", name: "selectGrow" });
    expect(SPECIALS).toContain("copy");
    expect(OPENS_SHEET).not.toContain("copy");
  });
  test("with a picked row it copies that row's full value, as a hold on its result does", () => {
    const { c, press, log } = ctx([done("1"), done("2"), done("3")]);
    c.picked = 1;
    press("select", "shift");
    expect(log).toEqual(["copy:2:result"]);
  });
  test("with no pick it copies the last finished row", () => {
    const { press, log } = ctx([done("1"), done("2"), { input: "3", status: "error" }]);
    press("select", "shift");
    expect(log).toEqual(["copy:2:result"]);
  });
  test("with no rows, or none finished, it is a dead press and writes nothing", () => {
    const a = ctx();
    a.press("select", "shift");
    expect(a.log).toEqual(["dead"]);
    const b = ctx([{ input: "1", status: "error" }]);
    b.press("select", "shift");
    expect(b.log).toEqual(["dead"]);
  });
  test("in an app it is a dead press", () => {
    const { press, log } = ctx([done("1")], "function");
    press("select", "shift");
    expect(log).toEqual(["dead"]);
  });
});

describe("Mode has no key (R723); Shift + Fmt and Shift + Vars are reserved", () => {
  test("no key's layer holds mode; Shift + Deselect does not open it", () => {
    const holders = keyboard.keys.flatMap((k) => Object.entries(k.actions).filter(([, a]) => a?.kind === "special" && a.name === "mode").map(([l]) => `${k.id}.${l}`));
    expect(holders).toEqual([]);
    const { press, log } = ctx();
    press("deselect", "shift");
    expect(log.some((l) => l.startsWith("mode"))).toBe(false);
  });
  test("Fmt's tap still cycles the last result's format", () => {
    const { press, log } = ctx();
    press("fmt");
    expect(log).toEqual(["cycleFormat"]);
  });
  for (const id of ["fmt", "vars"])
    test(`Shift + ${id} is dead and changes nothing on the line: no action, no legend`, () => {
      const { press, log, entry } = ctx();
      const before = entry.value;
      press(id, "shift");
      expect(log).toEqual(["dead"]);
      expect(entry.value).toBe(before);
      expect(keyboard.byId.get(id)?.actions.shift).toBeUndefined();
      expect(keyboard.byId.get(id)?.label.shift).toBeUndefined();
    });
  test("Vars' tap still opens Find on the user's names", () => {
    const { press, log } = ctx();
    press("vars");
    expect(log).toEqual(["names"]);
  });
});
