// SPDX-License-Identifier: GPL-3.0-or-later
// R41: every key and layer of spec/keyboard.yaml has a spoken name in the i18n table (TalkBack reads the button's
// aria-label and aria-description, never the glyphs "sin⁻¹" or "ᴇ"). English only.
import { describe, expect, it } from "vitest";
import { enKeyNames } from "../i18n/enKeyNames.ts";
import { UnitPad } from "../units/pad.ts";
import { fakeKv } from "../state/fakeKv.ts";
import { UserKeys } from "./userKeys.svelte.ts";
import { keyboard, withDecimalMark, type Key, type Layer } from "./keyboard.ts";
import { hasLayer, keyLabels, layerName } from "./keyNames.ts";

const LETTER = /^[A-Z]$/;
const layers = (k: Key): Layer[] => (["primary", "shift", "alpha"] as const).filter((l) => hasLayer(k, l));

describe("key names (R41)", () => {
  it("every key has a name for its tap, and for each Shift and Alpha layer it has", () => {
    for (const k of keyboard.keys)
      for (const l of layers(k)) {
        const n = layerName(k, l, false);
        expect(n, `${k.id} ${l}`).toBeTruthy();
        // a spoken name is words, not the glyph on the key (a letter, a digit and x are their own name)
        if (!/^[A-Za-z0-9]$/.test(n ?? "")) expect(n, `${k.id} ${l}`).not.toBe(k.label[l]);
      }
  });

  it("the table holds an entry for every key and layer, and nothing else", () => {
    const want = new Set<string>(["layer.shift", "layer.alpha"]);
    for (const k of keyboard.keys)
      for (const l of layers(k)) {
        if (l === "primary") want.add(k.id);
        else if (l === "shift") want.add(`${k.id}.shift`);
        else if (!LETTER.test(k.label.alpha ?? "")) want.add(`${k.id}.alpha`);
      }
    expect(Object.keys(enKeyNames).sort()).toEqual([...want].sort());
  });

  it("names the examples of the package", () => {
    const k = (id: string) => keyboard.byId.get(id) as Key;
    expect(layerName(k("sin"), "primary", false)).toBe("sine");
    expect(layerName(k("sin"), "shift", false)).toBe("arc sine");
    expect(layerName(k("div"), "shift", false)).toBe("x to the minus one");
    expect(layerName(k("emark"), "primary", false)).toBe("E for the exponent");
    expect(layerName(k("shift"), "primary", false)).toBe("Shift");
    // R863: Settings (Shift Help) at row 0, col 4; Copy and Paste on Shift + Select and Shift + Deselect; Shift + Vars is Chars (R725)
    expect(keyLabels(k("help"), false, false, false)).toEqual({ label: "Settings", description: "Shift: Help" });
    expect(keyLabels(k("help"), true, false, false)).toEqual({ label: "Help", description: "" });
    expect(keyLabels(k("select"), false, false, false)).toEqual({ label: "Select", description: "Shift: Copy" });
    expect(keyLabels(k("deselect"), false, false, false)).toEqual({ label: "Deselect", description: "Shift: Paste" });
    expect(keyLabels(k("vars"), false, false, false)).toEqual({ label: "Variables", description: "Shift: Characters. Alpha: A" });
    expect(keyLabels(k("vars"), true, false, false).label).toBe("Characters"); // R725
  });

  it("the label is the layer a tap gives now, the description the other layers", () => {
    const sin = keyboard.byId.get("sin") as Key;
    expect(keyLabels(sin, false, false, false)).toEqual({ label: "sine", description: "Shift: arc sine. Alpha: G" });
    expect(keyLabels(sin, true, false, false)).toEqual({ label: "arc sine", description: "Alpha: G" });
    expect(keyLabels(sin, false, true, false)).toEqual({ label: "G", description: "Shift: arc sine" });
    const shift = keyboard.byId.get("shift") as Key;
    expect(keyLabels(shift, false, false, false)).toEqual({ label: "Shift", description: "" });
  });

  it("an Alpha letter follows the case the view types (R58)", () => {
    const sin = keyboard.byId.get("sin") as Key;
    expect(keyLabels(sin, false, true, true).label).toBe("g");
    expect(keyLabels(sin, true, true, false).label).toBe("g");
    expect(keyLabels(sin, false, false, true).description).toBe("Shift: arc sine. Alpha: g");
  });

  it("a key whose face the app changed (a user key, the decimal comma) is named by its own face, in words where it has no letter", () => {
    // R709: the decimal comma's two faces, "," and ";", are said in words
    expect(keyLabels(withDecimalMark(keyboard.byId.get("dot") as Key), false, false, false)).toEqual({ label: "Decimal comma", description: "Shift: Equals" });
    expect(keyLabels(withDecimalMark(keyboard.byId.get("comma") as Key), false, false, false).label).toBe("Semicolon");
    const u1 = keyboard.byId.get("u1") as Key;
    expect(keyLabels(u1, false, false, false)).toEqual({ label: "Free key 1, empty: tap to set it", description: "" });
    const set: Key = { ...u1, label: { primary: "kN" }, actions: { primary: { kind: "type", text: "kN" } } };
    expect(keyLabels(set, false, false, false)).toEqual({ label: "kN", description: "" });
  });

  it("R709: the unit pad's operator and control cells take the main pad's names, ° is the degree sign, a unit its symbol", () => {
    const pad = new UnitPad();
    const cell = (id: string): Key => pad.key(keyboard.byId.get(id) as Key, null) as Key;
    expect(keyLabels(cell("div"), false, false, false)).toEqual({ label: "Divide", description: "Shift: x⁻¹" }); // (R864: no marker read out)
    expect(keyLabels(cell("sq"), false, false, false)).toEqual({ label: "x²", description: "Shift: √x" });
    expect(keyLabels(cell("pow"), false, false, false)).toEqual({ label: "x³", description: "Shift: x⁴" });
    expect(keyLabels(cell("mul"), false, false, false).label).toBe("Multiply");
    expect(keyLabels(cell("bksp"), false, false, false).label).toBe("Backspace");
    expect(keyLabels(cell("frac"), false, false, false)).toEqual({ label: "Degree sign", description: "Shift: rad" });
    expect(keyLabels(cell("d9"), false, false, false)).toEqual({ label: "m", description: "Shift: ft. Alpha: in" });
    expect(keyLabels(cell("paren"), false, true, false).label).toBe("Ton of refrigeration, TR");
    // an empty user cell ("+"): the free key's own name
    const empty = new UnitPad({}).key(keyboard.byId.get("u1") as Key, null) as Key;
    expect(keyLabels(empty, false, false, false).label).toBe("Free key 1, empty: tap to set it");
  });

  it("R821: a free key announces and describes its Alpha layer only while the switch is on", () => {
    const u1 = keyboard.byId.get("u1") as Key;
    const userKeys = new UserKeys(fakeKv());
    userKeys.set("u1", "alpha", { label: "tanh", action: { insert: "\\tanh\\left(#0\\right)" } });
    expect(hasLayer(userKeys.resolve(u1), "alpha")).toBe(false);
    expect(keyLabels(userKeys.resolve(u1), false, true, false).description).not.toContain("Alpha");
    userKeys.setAlphaLayer(true);
    const on = userKeys.resolve(u1);
    expect(hasLayer(on, "alpha")).toBe(true);
    expect(keyLabels(on, false, false, false).description).toContain("Alpha: tanh");
    expect(keyLabels(on, false, true, false).label).toBe("tanh");
  });
});
