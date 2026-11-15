// SPDX-License-Identifier: GPL-3.0-or-later
// R323 (the owner, 2026-11-14): two reserved Shift cells get a function. Shift + `( )` types ∥, Find's par() (task t01's
// function) with the cursor in its bracket; Shift + 0 types %, as the Shift + 9 palette's % cell does (it stays there).
// The other blank Shift cells stay reserved (a b/c, 7, 1, Fmt; Vars is Paste since R329), and Alpha + 0 stays dead.
import { describe, expect, it } from "vitest";
import { enKeyNames } from "../i18n/enKeyNames.ts";
import { latexToGiac } from "../input/latex-to-giac.ts";
import { actionFor, keyboard, labelFor, type Key } from "./keyboard.ts";
import { desktop } from "./desktopKeys.ts";
import { keyLabels, layerName } from "./keyNames.ts";

const k = (id: string): Key => keyboard.byId.get(id) as Key;

describe("R323: Shift + ( ) is ∥ (par), Shift + 0 is %", () => {
  it("Shift + ( ) inserts par() with the selection or a box as its argument; its legend is ∥", () => {
    expect(actionFor(k("paren"), true, false)).toEqual({
      kind: "insert",
      latex: "\\operatorname{par}\\left(#0\\right)",
      sample: ["\\operatorname{par}\\left(4700,10000\\right)", "par(4700,10000)"],
    });
    expect(labelFor(k("paren"), true, false)).toBe("∥");
    expect(latexToGiac("\\operatorname{par}\\left(4700,10000\\right)")).toBe("par(4700,10000)");
  });

  it("Shift + 0 inserts \\% (the palette's cell; a bare % is a LaTeX comment); its legend is %", () => {
    expect(actionFor(k("d0"), true, false)).toEqual({ kind: "insert", latex: "\\%", sample: ["5\\%", "1/20"] });
    expect(labelFor(k("d0"), true, false)).toBe("%");
    // the Shift + 9 palette keeps its % cell (a palette row never moves, docs/06 3b point 2)
    expect(keyboard.symbols.items.find((i) => i.id === "percent")?.action.latex).toBe("\\%");
  });

  it("TalkBack names both layers", () => {
    expect(layerName(k("paren"), "shift", false)).toBe("Parallel resistors");
    expect(layerName(k("d0"), "shift", false)).toBe("Percent");
    expect(keyLabels(k("d0"), false, false, false)).toEqual({ label: "0", description: "Shift: Percent" });
    expect("paren.shift" in enKeyNames && "d0.shift" in enKeyNames).toBe(true);
  });

  it("a hardware keyboard: % is Shift + 0, Alt + Shift + 9 is ∥ (by place: Shift + 9 is `(` on a US layout)", () => {
    expect(desktop.byName.get("%")).toEqual({ key: "d0", layer: "shift" });
    expect(desktop.byName.get("Alt+Shift+9")).toEqual({ key: "paren", layer: "shift" });
  });

  it("controls: the taps are unchanged, Alpha + 0 stays dead, the other blank Shift cells stay reserved", () => {
    expect(actionFor(k("paren"), false, false)).toMatchObject({ kind: "insert", latex: "\\left(#0\\right)" });
    expect(actionFor(k("d0"), false, false)).toEqual({ kind: "type", text: "0" });
    expect(k("d0").actions.alpha).toEqual({ kind: "special", name: "none" });
    expect(k("d0").label.alpha).toBeUndefined();
    for (const id of ["frac", "d7", "d1", "fmt"]) {
      expect(k(id).actions.shift, id).toBeUndefined();
      expect(k(id).label.shift, id).toBeUndefined();
    }
  });
});
