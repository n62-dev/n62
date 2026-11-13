// SPDX-License-Identifier: GPL-3.0-or-later
// R131: the desktop key map (spec/keyboard.yaml `desktop:`) against the keys as the spec stands. Every key and layer has
// a desktop key or a written reason, no two share one, and the table names no key or layer that is not there; a key or
// layer that lands later fails here until its own package gives it a desktop key.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { chordOf, desktop, LAYERS, readDesktop } from "./desktopKeys.ts";
import { keyboard, type Layer } from "./keyboard.ts";
import { HW_KINDS } from "../state/pressCount.ts";
import { shippedDesktop, shippedKeyboard } from "./shipped.ts";

const doc = parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../spec/keyboard.yaml"), "utf8")) as Record<string, unknown>;
const keyEntries = desktop.entries.filter((e) => "key" in e.target);
const entryOf = (id: string, layer: Layer) => keyEntries.find((e) => "key" in e.target && e.target.key === id && e.target.layer === layer);
/** A key's layers: those the spec gives it (a missing layer is reserved or closed, docs/06 3b), a user key's three slots. */
const layersOf = (k: (typeof keyboard.keys)[number]): Layer[] => (k.user ? [...LAYERS] : LAYERS.filter((l) => k.actions[l] !== undefined));

describe("the desktop key map (R131)", () => {
  it("every key and layer has a desktop key or a written reason", () => {
    const missing = keyboard.keys.flatMap((k) => layersOf(k).filter((l) => !entryOf(k.id, l)).map((l) => `${k.id} ${l}`));
    expect(
      missing,
      "these keys and layers have no desktop key: a key or layer brings its desktop key (or { why: … }) in spec/keyboard.yaml `desktop.keys` in the same change (R131, docs/06 3b growth rule 6)",
    ).toEqual([]);
  });
  it("names no key or layer that the spec does not have", () => {
    const stale = keyEntries.flatMap((e) => {
      const t = e.target as { key: string; layer: Layer };
      const k = keyboard.byId.get(t.key);
      return k && layersOf(k).includes(t.layer) ? [] : [`${t.key} ${t.layer}`];
    });
    expect(stale, "desktop.keys names a key or layer that `keys:` does not have (removed, or a reserved layer)").toEqual([]);
  });
  it("its actions are the status line's controls and results mode's fold", () => {
    expect(desktop.entries.filter((e) => "action" in e.target).map((e) => (e.target as { action: string }).action).sort()).toEqual(["apps", "fold", "num", "plot", "switch", "symb"]);
  });
  it("no two share a desktop key: the reader refuses a table where they do", () => {
    const keys = doc["desktop"] as { keys: Record<string, unknown>; actions: Record<string, unknown> };
    expect(() => readDesktop({ ...keys, actions: { ...keys.actions, apps: "Alt+S" } })).toThrow(/Alt\+S is both keys\.sin\.primary and actions\.apps/);
    const all = desktop.entries.flatMap((e) => e.names);
    expect(new Set(all).size).toBe(all.length);
  });
  it("a reason is written out, and a layer has either keys or a reason", () => {
    for (const e of desktop.entries) expect(e.names.length > 0 !== (e.why !== undefined), JSON.stringify(e.target)).toBe(true);
    expect(desktop.entries.filter((e) => e.why).length).toBeGreaterThan(0);
  });
  it("a layer that types one character has that character as its desktop key, unless another key holds it", () => {
    // (the (−) key types `-`, which the − key holds: on an empty line it starts with Ans, R31)
    for (const e of keyEntries) {
      const t = e.target as { key: string; layer: Layer };
      const a = keyboard.byId.get(t.key)?.actions[t.layer];
      if (a?.kind !== "type" || a.text.length !== 1) continue;
      const ch = a.text === " " ? "Space" : a.text;
      expect(e.names.includes(ch) || (desktop.byName.has(ch) && t.key === "neg"), `${t.key} ${t.layer}`).toBe(true);
    }
  });
  it("every name is one a keydown can have (chordOf): a character, Alt or Ctrl with a letter, digit or key name, or a key name", () => {
    const named = /^(Shift\+)?(Enter|Escape|Backspace|Delete|Home|End|Arrow(Up|Down|Left|Right)|F\d{1,2})$/;
    const chord = /^(Ctrl|Alt)\+(Shift\+)?([A-Z0-9]|Backspace|Arrow(Up|Down|Left|Right))$/;
    for (const n of desktop.entries.flatMap((e) => e.names)) expect(n.length === 1 || n === "Space" || named.test(n) || chord.test(n), n).toBe(true);
  });
  it("no desktop name is one of R127's hardware kinds, so hw:<desktop name> never shares a count with them (R131f1)", () => {
    const kinds = new Set<string>(HW_KINDS);
    expect([...desktop.byName.keys()].filter((n) => kinds.has(n))).toEqual([]);
  });
  it("reads a keydown as the table writes it", () => {
    const ev = (key: string, code: string, m: { ctrl?: boolean; meta?: boolean; alt?: boolean; shift?: boolean } = {}) =>
      chordOf({ key, code, ctrlKey: m.ctrl ?? false, metaKey: m.meta ?? false, altKey: m.alt ?? false, shiftKey: m.shift ?? false });
    expect(ev("s", "KeyS", { alt: true })).toBe("Alt+S");
    expect(ev("ß", "KeyS", { alt: true })).toBe("Alt+S"); // a Mac's Option
    expect(ev("!", "Digit1", { alt: true, shift: true })).toBe("Alt+Shift+1");
    expect(ev("z", "KeyZ", { meta: true })).toBe("Ctrl+Z");
    expect(ev(" ", "Space")).toBe("Space");
    expect(ev("Enter", "Enter", { shift: true })).toBe("Shift+Enter");
    expect(ev("{", "Digit7", { ctrl: true, alt: true })).toBeUndefined(); // Windows' AltGr
  });
  it("is left out of the start chunk's copy and is its own chunk's whole content", () => {
    expect(shippedKeyboard(doc)).not.toHaveProperty("desktop");
    expect(shippedDesktop(doc)).toEqual({ desktop: doc["desktop"] });
  });
});
