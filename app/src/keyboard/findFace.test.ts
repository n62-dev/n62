// SPDX-License-Identifier: GPL-3.0-or-later
// R802: the Math key's tap is Find (R4a), so its face and its spoken name say Find; the id `math`, Shift's Mem and Alpha's B stay.
import { describe, expect, it } from "vitest";
import { legend } from "../i18n/index.ts";
import { keyboard, type Key } from "./keyboard.ts";
import { keyLabels, layerName } from "./keyNames.ts";

const math = keyboard.byId.get("math") as Key;

describe("the Math key reads Find (R802)", () => {
  it("its face says Find, its spoken name is Find, and it still opens Find", () => {
    expect(legend(math.label.primary ?? "")).toBe("Find");
    expect(layerName(math, "primary", false)).toBe("Find");
    expect(math.actions.primary).toEqual({ kind: "special", name: "find" });
  });

  it("Shift's Mem and Alpha's B are unchanged", () => {
    expect(legend(math.label.shift ?? "")).toBe("Mem");
    expect(math.label.alpha).toBe("B");
    expect(keyLabels(math, false, false, false)).toEqual({ label: "Find", description: "Shift: Memory. Alpha: B" });
  });
});
