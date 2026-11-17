// SPDX-License-Identifier: GPL-3.0-or-later
// R361f1: the Function app asks the engine for the Giac text of each slot on that it cannot draw alone, and writes the
// drawn-at value of a note with its own number formatter (fmtX: the settings' digits and decimal mark). The engine's
// answer is given here (host.ts plotValues is tested on the real Giac in engine/plotValues.test.ts). Expected values
// derived: 1/3 at 12 digits is 0.333333333333.
import { describe, expect, it, vi } from "vitest";
import type { AppHost } from "../types.ts";
import type { PlotValue } from "../../engine/plotValues.ts";
vi.mock("../../theme.svelte.ts", () => ({ brightness: () => "dark" }));
const engine = vi.hoisted(() => ({ asked: [] as string[][], answers: new Map<string, PlotValue[]>() }));
vi.mock("../../calc/plotValues.ts", () => ({
  readPlotValues: async (_e: unknown, texts: readonly string[]) => {
    engine.asked.push([...texts]);
    return texts.map((t) => engine.answers.get(t) ?? []);
  },
}));
import { FunctionApp } from "./app.svelte.ts";

const make = (decimalMark = "point"): FunctionApp => {
  const settings = { digits: 12, angle: "rad", format: "std", decimalMark, groupSep: "thin" };
  const h = {
    calc: { ready: async () => undefined, engine: {} },
    kv: { get: async () => undefined, set: async () => undefined },
    get settings() {
      return settings;
    },
    userNames: [],
    setEntry: () => undefined,
    copy: () => undefined,
    notice: () => undefined,
  };
  return new FunctionApp(h as unknown as AppHost);
};
const Q: PlotValue = { name: "Q", kind: "var", re: 1 / 3, im: 0, unit: "m" };

describe("R361f1: the Plot's read of a slot's stored names, through the app", () => {
  it("Q stored as 1/3 with a unit: drawn, the note says drawn at 0.333333333333 (12 digits), not a double's print", async () => {
    engine.asked.length = 0;
    engine.answers.set("Q*x", [Q]);
    const app = make();
    app.define(0, "Q\\cdot x");
    app.define(1, "x^{2}");
    await app.readStored();
    expect(engine.asked).toEqual([["Q*x"]]); // x² draws alone: not asked
    expect(app.notes).toEqual(["F1 uses Q in m: unit dropped, drawn at 0.333333333333"]);
  });
  it("the decimal comma: drawn at 0,333333333333", async () => {
    engine.answers.set("Q*x", [Q]);
    const app = make("comma");
    app.define(0, "Q\\cdot x");
    await app.readStored();
    expect(app.notes).toEqual(["F1 uses Q in m: unit dropped, drawn at 0,333333333333"]);
  });
  it("the sum in k: the engine names no read, so no note even when k is stored", async () => {
    engine.asked.length = 0;
    const app = make();
    app.define(0, "\\sum_{k=1}^{5}x^{k}");
    await app.readStored();
    expect(engine.asked).toEqual([["sum(x^k,k,1,5)"]]);
    expect(app.notes).toEqual([]);
  });
});
