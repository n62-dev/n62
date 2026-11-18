// SPDX-License-Identifier: GPL-3.0-or-later
// R723 (the owner, 2026-11-17): Shift + Deselect is Paste (R329 had it on Shift + Vars, now reserved for Chars, R725). It
// takes ☰ → Paste's path (the clipboard as one number onto the entry line, clipboard/actions.svelte.ts paste), the keys
// pressed meanwhile wait for it (holdKeys), and where no entry line shows it is a dead press (R127). It opens no sheet (no
// ▾). Deselect's tap stays Deselect (R279). The real route.press, a stub context (no MathLive).
import { describe, expect, test, vi } from "vitest";

vi.mock("../render/mathlive.svelte.ts", () => ({ mathlive: { load: () => new Promise(() => {}) } }));
vi.mock("../entry/field.ts", () => ({}));
vi.mock("../entry/hwkeys.ts", () => ({}));
vi.mock("../views/sheetView.svelte.ts", () => ({ sheetChunk: { C: {}, pad: null, keys: null, palette: null }, loadSheetView: async () => {} }));

const { EntryController } = await import("../entry/controller.ts");
const route = await import("./route.ts");
const { actionFor, keyboard, labelFor, OPENS_SHEET, SPECIALS } = await import("./keyboard.ts");
const { opensSheet } = await import("./opens.ts");
const { desktop } = await import("./desktopKeys.ts");
const { layerName, keyLabels } = await import("./keyNames.ts");
const { en } = await import("../i18n/en.ts");
const { enKeyNames } = await import("../i18n/enKeyNames.ts");

const k = (id: string) => {
  const key = keyboard.byId.get(id);
  if (!key) throw new Error(`no key ${id}`);
  return key;
};

/** `app`: the place (null: Home); `entryShown`: the view shows an entry line (Plot does not). */
function ctx(app: string | null = null, entryShown = true) {
  const log: string[] = [];
  let done: (ok: boolean) => void = () => {};
  const entry = new EntryController();
  const session = {
    shift: false, alpha: false, shiftLock: false, settings: { entry: "textbook" }, items: [], taps: { tap() {} },
    clearModifiers() {}, hasResult: () => false,
  };
  const shell = { app, sheet: null, sheetPending: null, loading: null, prompt: null, opening: Promise.resolve(), showsEntry: entryShown, nav: () => false };
  const clip = {
    paste: (text?: string) => {
      log.push(`paste:${text ?? "clipboard"}`);
      return new Promise<boolean>((r) => (done = r));
    },
  };
  const c = {
    session, shell, entry, picked: null as number | null, sheetLoad: null as Promise<void> | null, waiting: [] as unknown[], casKeys: false,
    enter() {}, insertResult() {}, recallRow() {}, goTo() {}, clearKey() {}, openSettings() {}, openMode() {}, openTemplates() {}, openShiftPalette() {},
    openFind: () => void log.push("find"), openHelp() {}, openMatrix() {}, openNames: (memory: boolean) => void log.push(memory ? "memory" : "names"), openStore() {},
    withClip: (run: (x: typeof clip) => void | Promise<void>) => void run(clip),
    loadClip() {}, dead: () => void log.push("dead"), unfold: () => false,
  };
  const press = (id: string, layer?: "shift" | "alpha" | "primary"): void => route.press(c as never, k(id), layer);
  return { c, log, press, finish: (ok = true) => done(ok) };
}

describe("R723: Shift + Deselect is Paste", () => {
  test("the spec: deselect.shift is the paste special with the Paste legend; the tap is unchanged", () => {
    expect(actionFor(k("deselect"), true, false)).toEqual({ kind: "special", name: "paste" });
    expect(k("deselect").label.shift).toBe("$key.paste");
    expect(labelFor(k("deselect"), true, false)).toBe("$key.paste");
    expect(en["key.paste" as keyof typeof en]).toBe("Paste");
    expect(actionFor(k("deselect"), false, false)).toEqual({ kind: "special", name: "selectShrink" });
  });

  test("paste is a special that opens no sheet: no ▾ on its legend", () => {
    expect(SPECIALS).toContain("paste");
    expect(OPENS_SHEET).not.toContain("paste");
    expect(opensSheet({ kind: "special", name: "paste" } as never)).toBe(false);
  });

  test("TalkBack names the layer", () => {
    expect(enKeyNames).toHaveProperty("deselect.shift", "Paste");
    expect(layerName(k("deselect"), "shift", false)).toBe("Paste");
    expect(keyLabels(k("deselect"), false, false, false).description).toBe("Shift: Paste");
  });

  test("a hardware keyboard: Alt + Shift + V; Vars keeps Alt + V", () => {
    expect(desktop.byName.get("Alt+Shift+V")).toEqual({ key: "deselect", layer: "shift" });
    expect(desktop.byName.get("Alt+V")).toEqual({ key: "vars", layer: "primary" });
  });

  test("in Home it pastes the clipboard (☰ → Paste's path), and a key pressed meanwhile waits for it (holdKeys)", async () => {
    const { c, log, press, finish } = ctx();
    press("deselect", "shift");
    expect(log).toEqual(["paste:clipboard"]);
    expect(c.sheetLoad).not.toBeNull(); // the hold
    press("div");
    expect(c.waiting).toHaveLength(1); // ÷ waits for the paste
    finish();
    await vi.waitFor(() => expect(c.sheetLoad).toBeNull());
  });

  test("in an app view with an entry line (Solve Symb) it pastes as well", () => {
    const { log, press } = ctx("solve", true);
    press("deselect", "shift");
    expect(log).toEqual(["paste:clipboard"]);
  });

  test("where no entry line shows (Plot) it is a dead press and reads no clipboard", () => {
    const { c, log, press } = ctx("function", false);
    press("deselect", "shift");
    expect(log).toEqual(["dead"]);
    expect(c.sheetLoad).toBeNull();
  });

  test("controls: Vars' tap opens Find on the user's names; Shift + a b/c, 7 and Fmt are reserved (Shift + 1 is R327's, Shift + Vars R725's)", () => {
    const { log, press } = ctx();
    press("vars");
    expect(log).toEqual(["names"]);
    for (const id of ["frac", "d7", "fmt"]) {
      expect(k(id).actions.shift, id).toBeUndefined();
      expect(k(id).label.shift, id).toBeUndefined();
    }
  });
});
