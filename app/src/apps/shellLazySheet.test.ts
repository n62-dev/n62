// SPDX-License-Identifier: GPL-3.0-or-later
// R151: the sheet's model (views/sheet.svelte.ts) is a lazy chunk, out of the start chunk. A sheet asked for before it is
// in (a long press on a history row before the idle load) opens once it is; a sheet set meanwhile, or Esc, wins.
// Each test file runs in its own module registry, so the model is not in when this file starts.
import { describe, expect, it } from "vitest";
import type { Calc, CalcSettings } from "../calc/port.ts";
import { sheetChunk } from "../views/sheetView.svelte.ts";
import { AppShell } from "./shell.svelte.ts";

const settings: CalcSettings = { digits: 12, angle: "rad", format: "std" };
const kv = { get: async () => undefined, set: async () => undefined };
const line = { value: "", set() {}, clear() {} };
const shell = (): AppShell => new AppShell({} as Calc, kv, line, () => settings);

describe("R151 a sheet waits for its lazy model", () => {
  it("opens once the model is in; Esc meanwhile drops it; then opens at once", async () => {
    expect(sheetChunk.model).toBeNull();
    const s = shell();
    s.showMenu("Row", [{ id: "copy", label: "Copy" }]);
    expect(s.sheet).toBeNull();
    const first = s.sheetPending;
    expect(first).not.toBeNull();
    s.showMenu("Row 2", [{ id: "cut", label: "Cut" }]); // a second ask replaces the first
    const second = s.sheetPending;
    await Promise.all([first, second]);
    expect(s.sheetPending).toBeNull();
    expect(s.sheet?.id).toBe("list:Row 2");
    expect(sheetChunk.model).not.toBeNull();

    // with the model in, the open is at once
    s.closeSheet();
    s.toggleApps();
    expect(s.sheet?.id).toBe("apps");
    expect(s.sheetPending).toBeNull();
  });

  it("a sheet closed while it waits does not open", async () => {
    sheetChunk.model = null; // as before the load (the module stays cached, so the load is quick)
    const s = shell();
    s.showMenu("Row", [{ id: "copy", label: "Copy" }]);
    const pending = s.sheetPending;
    expect(pending).not.toBeNull();
    s.closeSheet(); // Esc
    expect(s.sheetPending).toBeNull();
    await pending;
    expect(s.sheet).toBeNull();
  });
});
