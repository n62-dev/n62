// SPDX-License-Identifier: GPL-3.0-or-later
// R327 (the owner, 2026-11-15): Shift + 1 opens the uncertainty sheet of a result with σ, a reserved cell filled (docs/06
// 3b). Its legend is σ, its TalkBack name "Uncertainty sheet", a free desktop chord presses it; the lock records the fill
// (a reserved line turned live, no move). Controls: the tap and Alpha + 1 are unchanged, a b/c, 7 and Fmt stay reserved.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { enKeyNames } from "../i18n/enKeyNames.ts";
import { desktop } from "./desktopKeys.ts";
import { actionFor, keyboard, labelFor, type Key } from "./keyboard.ts";
import { keyLabels, layerName } from "./keyNames.ts";
import { applyMoves, compareLayout, layerPins, parseLock } from "./layoutLock.ts";
import { opensSheet } from "./opens.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (p: string): string => readFileSync(join(root, p), "utf8");
const k = (id: string): Key => keyboard.byId.get(id) as Key;

describe("R327: Shift + 1 is the uncertainty sheet", () => {
  it("Shift + 1 is `special uncertainty`, a sheet key (▾), with the legend σ", () => {
    expect(actionFor(k("d1"), true, false)).toEqual({ kind: "special", name: "uncertainty" });
    expect(labelFor(k("d1"), true, false)).toBe("σ");
    expect(opensSheet(actionFor(k("d1"), true, false))).toBe(true);
  });

  it("TalkBack names it", () => {
    expect(enKeyNames["d1.shift" as keyof typeof enKeyNames]).toBe("Uncertainty sheet");
    expect(layerName(k("d1"), "shift", false)).toBe("Uncertainty sheet");
    expect(keyLabels(k("d1"), false, false, false)).toMatchObject({ label: "1", description: expect.stringContaining("Shift: Uncertainty sheet") });
  });

  it("a hardware keyboard presses it with Alt + Shift + K, a chord no other key or action holds", () => {
    expect(desktop.byName.get("Alt+Shift+K")).toEqual({ key: "d1", layer: "shift" });
  });

  it("the shipped lock with Shift + 1 still reserved fails for that line alone; the lock records the fill", () => {
    const text = read("spec/layout-lock.yaml");
    const lock = parseLock(text);
    expect(lock.pins["layers"]?.["d1.shift"]).toBe("special uncertainty");
    expect(lock.moves.some((m) => m.entry === "layers/d1.shift")).toBe(false); // a fill, not a move
    const before = parseLock(text.replace('"d1.shift": "special uncertainty"', '"d1.shift": "reserved"'));
    const layers = { layers: layerPins(keyboard) };
    // (the lock's own moves applied, R863's swap at row 0, col 4 among them)
    const only = (pins: Record<string, Record<string, string>>) => ({ pins: { layers: applyMoves({ pins, moves: lock.moves }, "").pins["layers"] ?? {} }, moves: [] });
    expect(compareLayout(layers, only(before.pins), "")).toEqual([
      'layers/d1.shift: reserved in the lock but live ("special uncertainty"): record the fill in the lock',
    ]);
    expect(compareLayout(layers, only(lock.pins), "")).toEqual([]);
  });

  it("controls: the tap types 1, Alpha + 1 types Y; a b/c and 7 stay reserved on Shift (Fmt's is R871's)", () => {
    expect(actionFor(k("d1"), false, false)).toEqual({ kind: "type", text: "1" });
    expect(actionFor(k("d1"), false, true)).toEqual({ kind: "type", text: "Y" });
    for (const id of ["frac", "d7"]) {
      expect(k(id).actions.shift, id).toBeUndefined();
      expect(k(id).label.shift, id).toBeUndefined();
    }
  });
});
