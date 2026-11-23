// SPDX-License-Identifier: GPL-3.0-or-later
// R723 (the owner, 2026-11-17): the cluster's cells. Row 0, col 4 (its own id `help`, R197) is Settings, Shift Help (R863, the
// owner 2026-11-22); the
// id `menu` is retired (☰ is on the bar, R722). Shift + Select is Copy (what a hold on the row's result copies, R276, R720):
// the picked row, else the last finished row; no row, or an app, is a dead press with no clipboard write. Shift + Deselect is
// Paste (deselectPaste.test.ts); Mode has no key (the bar's chips). Shift + Fmt is reserved (Shift + Vars is Chars, R725): no action, no
// legend, a dead press. The real route.press, a stub context (no MathLive, no field).
import { describe, expect, test, vi } from "vitest";
import { targetRow } from "../state/pickRows.ts";

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
    formKey: async (k: string) => void log.push(k),
    formRow: (_k: string, at: number | null) => targetRow(items, items[at ?? -1]), // (the forms code not in: the row only, G785)
  };
  const shell = { app, sheet: null, sheetPending: null, loading: null, prompt: null, opening: Promise.resolve(), showsEntry: true, nav: () => false, toggleMenu: () => (log.push("toggleMenu"), true) };
  // ClipActions.keyCopy (clipboard/actions.test.ts holds its rule): here it says what it was given, and calls the dead press when it has nothing to copy
  const clip = {
    keyCopy: (dead: () => void, row?: Row): void => {
      log.push(`keyCopy:${row?.input ?? "none"}`);
      if (!(app === null && (row ? row.status === "done" : items.some((r) => r.status === "done")))) dead();
    },
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

describe("row 0, col 4 is Settings; Shift Help (R863, after R723)", () => {
  test("the key in that cell has the id help, its face ⚙ and its legend Help; no key has the id menu", () => {
    const k = keyboard.keys.find((x) => x.row === 0 && x.col === 4);
    expect(k?.id).toBe("help");
    expect(k?.label).toEqual({ primary: "$key.gear", shift: "$key.help" });
    expect(k?.actions.primary).toEqual({ kind: "special", name: "settings" });
    expect(k?.actions.shift).toEqual({ kind: "special", name: "help" });
    expect(keyboard.byId.has("menu")).toBe(false);
  });
  test("its tap opens Settings, Shift + it (and a flick up) Help (R197)", () => {
    const { press, log } = ctx();
    press("help");
    press("help", "shift");
    expect(log).toEqual(["settings", "help"]);
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
    expect(log).toEqual(["keyCopy:2"]);
  });
  test("with no pick it asks for the last finished row", () => {
    const { press, log } = ctx([done("1"), done("2"), { input: "3", status: "error" }]);
    press("select", "shift");
    expect(log).toEqual(["keyCopy:none"]);
  });
  test("with no rows, or none finished, it is a dead press and writes nothing", () => {
    const a = ctx();
    a.press("select", "shift");
    expect(a.log).toEqual(["keyCopy:none", "dead"]);
    const b = ctx([{ input: "1", status: "error" }]);
    b.press("select", "shift");
    expect(b.log).toEqual(["keyCopy:none", "dead"]);
  });
  test("in an app it is a dead press", () => {
    const { press, log } = ctx([done("1")], "function");
    press("select", "shift");
    expect(log).toEqual(["keyCopy:none", "dead"]);
  });
});

describe("Mode has no key (R723); Shift + Fmt is reserved (Shift + Vars is Chars, R725)", () => {
  test("no key's layer holds mode; Shift + Deselect does not open it", () => {
    const holders = keyboard.keys.flatMap((k) => Object.entries(k.actions).filter(([, a]) => a?.kind === "special" && a.name === "mode").map(([l]) => `${k.id}.${l}`));
    expect(holders).toEqual([]);
    const { press, log } = ctx();
    press("deselect", "shift");
    expect(log.some((l) => l.startsWith("mode"))).toBe(false);
  });
  test("Fmt's tap still cycles the last result's format; with no row to take it is a dead press (deadPress)", () => {
    const { press, log } = ctx([done("1")]);
    press("fmt");
    expect(log).toEqual(["cycleFormat"]);
    const none = ctx();
    none.press("fmt");
    expect(none.log).toEqual(["dead"]);
  });
  for (const id of ["fmt"])
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
