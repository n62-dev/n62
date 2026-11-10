// SPDX-License-Identifier: GPL-3.0-or-later
// R257: the Plot trace's y belongs to the function and the angle unit it was asked for, not only to x and the slot;
// an angle change drops the last analysis. The fake engine echoes function, x and angle (the bu probe's, review 2026-11-09).
import { describe, expect, it, vi } from "vitest";
import type { AppHost } from "../types.ts";
// the app imports the page brightness, which reads the document
vi.mock("../../theme.svelte.ts", () => ({ brightness: () => "dark" }));
import { FunctionApp } from "./app.svelte.ts";

const make = (): { app: FunctionApp; settings: { angle: string }; asked: string[] } => {
  const settings = { digits: 12, angle: "rad", format: "std", decimalMark: "point", groupSep: "thin" };
  const asked: string[] = [];
  const calc = {
    ready: async () => undefined,
    table: async (r: { fns: string[]; xs: string[] }, s: { angle: string }) => {
      asked.push(`${r.fns[0]}@${r.xs[0]}|${s.angle}`);
      return r.xs.map((x) => r.fns.map((f) => ({ ok: true, display: `${f}@${x}|${s.angle}`, facts: { exact: false, reliableDigits: 12 } })));
    },
  };
  const h = {
    calc,
    kv: { get: async () => undefined, set: async () => undefined },
    get settings() {
      return settings;
    },
    userNames: [],
    setEntry: () => undefined,
    copy: () => undefined,
    notice: () => undefined,
  };
  return { app: new FunctionApp(h as unknown as AppHost), settings, asked };
};
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 20));

describe("R257: the trace y follows the function and the angle unit", () => {
  it("a new definition at the same x asks the engine again and shows the new function's y", async () => {
    const { app, asked } = make();
    app.define(0, "x^{2}");
    app.show("plot");
    await tick();
    const before = app.traceY?.display ?? "";
    expect(before).toMatch(/@0\|rad$/);
    app.define(0, "x^{2}+1");
    app.show("plot");
    await tick();
    expect(asked).toHaveLength(2);
    expect(app.traceY?.display).toBe(asked[1]);
    expect(app.traceY?.display).not.toBe(before);
  });

  it("RAD → DEG: the y is the DEG one, also after leaving and re-entering Plot", async () => {
    const { app, settings, asked } = make();
    app.define(0, "\\sin\\left(x\\right)");
    app.trace.x = "0.1";
    app.show("plot");
    await tick();
    expect(app.traceY?.display).toMatch(/@0\.1\|rad$/);
    settings.angle = "deg"; // the status chip
    // what FunctionPlot.svelte's angle effect runs
    expect(app.syncAngle()).toBe(true);
    await tick();
    expect(app.traceY?.display).toMatch(/@0\.1\|deg$/);
    app.show("symb");
    app.show("plot");
    await tick();
    expect(app.traceY?.display).toMatch(/@0\.1\|deg$/);
    expect(asked).toHaveLength(2);
  });

  it("an angle change shown before syncAngle runs: the old y is not shown", async () => {
    const { app, settings } = make();
    app.define(0, "\\sin\\left(x\\right)");
    app.show("plot");
    await tick();
    expect(app.traceY).toBeDefined();
    settings.angle = "deg";
    expect(app.traceY).toBeUndefined();
  });

  it("control: Plot again with nothing changed asks nothing", async () => {
    const { app, asked } = make();
    app.define(0, "x^{2}");
    app.show("plot");
    await tick();
    app.show("plot");
    await tick();
    expect(app.syncAngle()).toBe(false);
    app.show("symb");
    app.show("plot");
    await tick();
    expect(asked).toHaveLength(1);
  });

  it("an angle change clears the last analysis's readout and marks", async () => {
    const { app, settings } = make();
    app.define(0, "\\sin\\left(x\\right)");
    app.readout = { lines: [{ label: "x", value: "0" }], info: "", warn: false };
    app.marks = [{ x: 0, y: 0, slot: 0 }];
    settings.angle = "deg";
    app.syncAngle();
    expect(app.readout).toBeUndefined();
    expect(app.marks).toEqual([]);
  });
});
