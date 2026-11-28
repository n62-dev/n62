// SPDX-License-Identifier: GPL-3.0-or-later
// G365: the Function app shows NaN for a cell the engine marked undef or infinity (its kind, from the bridge), never by
// reading Giac's print: a cell's display here holds no such word, and a display that reads "undef" without a kind is
// shown as it is.
import { describe, expect, it, vi } from "vitest";
import type { AppHost } from "../types.ts";
import type { Cell } from "./engineApi.ts";
vi.mock("../../theme.svelte.ts", () => ({ brightness: () => "dark" }));
import { FunctionApp } from "./app.svelte.ts";

const NONE = { exact: false, reliableDigits: null } as const;
const POLE: Cell = { ok: true, display: "∞?", kind: "infinity", facts: NONE };
const HOLE: Cell = { ok: true, display: "?", kind: "undef", facts: NONE };
const WORD: Cell = { ok: true, display: "undef", facts: NONE };

const make = (): { app: FunctionApp; copied: string[] } => {
  const copied: string[] = [];
  const h = {
    calc: { ready: async () => undefined, engine: {} },
    kv: { get: async () => undefined, set: async () => undefined },
    settings: { digits: 12, angle: "rad", format: "std", decimalMark: "point", groupSep: "thin" },
    userNames: [],
    setEntry: () => undefined,
    copy: (t: string) => void copied.push(t),
    notice: () => undefined,
  } as unknown as AppHost;
  const app = new FunctionApp(h);
  app.define(0, "\\frac{1}{x}");
  app.define(1, "\\frac{\\sin x}{x}");
  app.numXs = ["0"];
  app.numSlots = [0, 1];
  app.numCache = new Map([["0", [POLE, HOLE]]]);
  return { app, copied };
};

describe("G365: NaN from the cell's kind", () => {
  it("fmt shows NaN for an infinity and an undef", () => {
    const { app } = make();
    expect(app.fmt(POLE)).toBe("NaN");
    expect(app.fmt(HOLE)).toBe("NaN");
  });
  it("the cell copy and the Num CSV give NaN", async () => {
    const { app, copied } = make();
    await app.copyNumCell(0, 0);
    await app.copyNumCell(0, 1);
    expect(copied).toEqual(["NaN", "NaN"]);
    expect((await app.numCsv())?.split("\r\n")[1]).toBe("0,NaN,NaN");
  });
  it("Giac's word without a kind is not read", () => {
    const { app } = make();
    expect(app.fmt(WORD)).toBe("undef");
  });
});
