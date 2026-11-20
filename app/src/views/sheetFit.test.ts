// SPDX-License-Identifier: GPL-3.0-or-later
// Row heights (docs/05 3.1, R770: no shrinking; a sheet taller than its box scrolls).
import { describe, expect, it } from "vitest";
import type { MenuItem } from "../apps/types.ts";
import { Sheet } from "./sheet.svelte.ts";
import { OPTIONS, hasSteps, REASON, rowHeight, showsReason, STEP } from "./sheetFit.ts";


describe("rowHeight", () => {
  it("a row with a button per value is 52 px (R86)", () => {
    expect(rowHeight(36, { reason: false, steps: false, options: true })).toBe(OPTIONS);
    expect(rowHeight(42, { reason: false, steps: false, options: false })).toBe(42);
  });
  it("counts a reason line and a value row's ◀ ▶ buttons in the row's own height", () => {
    expect(rowHeight(40, { reason: true, steps: false })).toBe(40 + REASON);
    expect(rowHeight(36, { reason: false, steps: true })).toBe(STEP);
    expect(rowHeight(36, { reason: true, steps: true })).toBe(36 + REASON);
  });
});

describe("showsReason", () => {
  const off = (id: string, reason: string): MenuItem => ({ id, label: id, disabled: true, reason });
  const on = (id: string): MenuItem => ({ id, label: id });
  it("says why once for neighbouring disabled rows with the same reason, under the last of them", () => {
    // Function › Plot with no function: five rows share one reason, two the next one
    const items = [off("root", "A"), off("ext", "A"), off("int", "A"), off("slope", "A"), off("area", "A"), on("default"), off("copy", "B"), off("shown", "B")];
    expect(items.map((_, i) => showsReason(items, i))).toEqual([false, false, false, false, true, false, false, true]);
  });
  it("a different reason, or a live row between, gives each its own line", () => {
    const items = [off("a", "A"), off("b", "B"), off("c", "A"), on("d"), off("e", "A")];
    expect(items.map((_, i) => showsReason(items, i))).toEqual([true, true, true, false, true]);
  });
  it("a live row or a row without a reason says nothing", () => {
    expect(showsReason([on("a")], 0)).toBe(false);
    expect(showsReason([{ id: "a", label: "a", disabled: true }], 0)).toBe(false);
  });
});

describe("the ◀ ▶ buttons of a value row", () => {
  it("a row has them when it has a value changed in place", () => {
    expect(hasSteps({ id: "a", label: "a", value: "1", adjust: () => undefined })).toBe(true);
    expect(hasSteps({ id: "a", label: "a", value: "1" })).toBe(false);
    expect(hasSteps({ id: "a", label: "a", adjust: () => undefined })).toBe(false);
  });
  it("a tap on one steps that row's value and highlights it; a disabled row does nothing", () => {
    let n = 0;
    let m = 0;
    const s = new Sheet("t", "T", () => [
      { id: "a", label: "a", value: String(n), adjust: (by) => void (n += by) },
      { id: "b", label: "b", value: String(m), adjust: (by) => void (m += by) },
      { id: "c", label: "c", value: "x", disabled: true, adjust: () => void (m = 99) },
    ]);
    expect(s.level.highlight).toBe(0);
    s.adjustAt(1, -1);
    expect([n, m, s.level.highlight]).toEqual([0, -1, 1]);
    s.adjustAt(0, 1);
    expect([n, m, s.level.highlight]).toEqual([1, -1, 0]);
    s.adjustAt(2, 1);
    expect([m, s.level.highlight]).toEqual([-1, 0]);
  });
});

describe("where a sheet goes", () => {
  it("a list that takes letters stays above the keypad; every other sheet goes over it", () => {
    const short = new Sheet("t", "T", () => [{ id: "a", label: "a" }]);
    const long = new Sheet("u", "U", () => Array.from({ length: 14 }, (_, i) => ({ id: `${i}`, label: `${i}` })));
    const grid = new Sheet("tmpl", "Tmpl", () => Array.from({ length: 18 }, (_, i) => ({ id: `${i}`, label: `${i}` })), { columns: 6 });
    expect([short.letters, long.letters, grid.letters]).toEqual([false, true, false]);
  });
});
