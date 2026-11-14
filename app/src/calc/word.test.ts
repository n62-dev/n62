// SPDX-License-Identifier: GPL-3.0-or-later
// R194f1: the word size and sign reach the engine with EVERY request, not only Home and CAS inputs: `shl(3,7)` means one
// thing under one setting (Word 8, unsigned: 128), in Home, a Function app's Num table, the Solve app and the units view.
import { beforeAll, describe, expect, it } from "vitest";
import { EngineCalc } from "./engine.ts";
import { EngineHost } from "../engine/host.ts";
import { giacAvailable, nodeHost } from "../engine/nodeGiac.ts";
import type { MathEngine } from "../engine/types.ts";
import type { IndexItem } from "../find/types.ts";
import { wordStore } from "../state/wordStore.svelte.ts";

const settings = { digits: 12, angle: "rad", format: "std" } as const;
const word8 = { word: 8, signed: false };
const items: IndexItem[] = [{ id: "unit:m", kind: "unit", names: ["m"], title: "Meter", si: "1", dim: "m1", tier: 0, insert: "\\unit{m}{\\mathrm{m}}" }];

describe("every request carries the word (R194f1)", () => {
  it("home, cas, solve, analyze, table and units send the word once it is set", async () => {
    const seen: Record<string, unknown> = {};
    const note = (kind: string) => (...a: unknown[]): Promise<unknown> => ((seen[kind] = a.find((x) => typeof x === "object" && x !== null && "digits" in x)), Promise.resolve({}));
    const engine = { home: note("home"), cas: note("cas"), solve: note("solve"), analyze: note("analyze"), table: note("table"), units: note("units") } as unknown as MathEngine;
    const calc = new EngineCalc(engine, { findIndex: async () => items });
    await calc.table({ fns: ["x"], xs: ["1"] }, settings);
    expect(seen["table"]).not.toHaveProperty("word"); // none set: none sent
    wordStore.set({ bits: 8, signed: false });
    await calc.home("1", settings);
    await calc.cas("1", settings);
    await calc.solve({ kind: "poly", equation: "x=1", unknown: "x" }, settings);
    await calc.analyze({ kind: "root", f: "x" } as never, settings);
    await calc.table({ fns: ["x"], xs: ["1"] }, settings);
    await calc.units({ formula: "pasu1", slots: [{ tokens: [{ unit: "m" }] }] }, settings);
    for (const kind of ["home", "cas", "solve", "analyze", "table", "units"]) expect(seen[kind], kind).toMatchObject(word8);
  });
});

describe.skipIf(!giacAvailable())("shl(3,7) under Word 8 unsigned, from the real engine (R194f1)", () => {
  let calc: EngineCalc;
  beforeAll(async () => {
    const host: EngineHost = await nodeHost();
    const engine = {
      home: (input, s) => Promise.resolve(host.home(input, s).result),
      table: (req, s) => Promise.resolve(host.table(req, s)),
      solve: (req, s) => Promise.resolve(host.solve(req, s)),
    } as MathEngine;
    wordStore.set({ bits: 8, signed: false });
    calc = new EngineCalc(engine);
  });

  it("is 128 in Home and in a Num table (a table after a Home input once gave 384)", async () => {
    expect((await calc.home("shl(3,7)", settings)).display).toBe("128");
    expect((await calc.table({ fns: ["shl(3,7)+0*x"], xs: ["3"] }, settings))[0]![0]!.display).toBe("128"); // (a cell of shl(x,7) itself reads x as no integer: not R194's)
    expect((await calc.home("shl(3,7)", settings)).display).toBe("128");
  });

  it("is 128 in the Solve app too", async () => {
    const r = await calc.solve({ kind: "equations", equations: ["shl(3,7)=x"], unknowns: ["x"], guesses: ["1"] }, settings);
    expect(JSON.stringify(r)).toContain("128");
    expect(JSON.stringify(r)).not.toContain("384");
  });
});
