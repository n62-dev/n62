// SPDX-License-Identifier: GPL-3.0-or-later
// R100 (vr-1, be-3's CSV half): an app's Copy in comma mode writes what Paste in comma mode reads back: Function's readout
// and Num cells with the mark, its CSV with `;` between the fields, Solve's root with the mark; through the view's own ☰ → Copy
// item (R278: the Copy key is gone). Point mode as before. Values derived: 3/2 = 1.5, (3/2)² = 2.25.
import { describe, expect, it, vi } from "vitest";
import type { AppHost, ViewId } from "./types.ts";
vi.mock("../theme.svelte.ts", () => ({ brightness: () => "dark" }));
import { FunctionApp } from "./function/app.svelte.ts";
import type { Cell } from "./function/engineApi.ts";
import { SolveApp } from "./solve/app.svelte.ts";
import { decimalFromString, ZERO_VALUE } from "../engine/format.ts";
import { parsePastedNumber } from "../clipboard/paste.ts";

/** The host of an app in comma or point mode; `copy` is what ☰ → Copy hands to the clipboard code. */
const host = (comma: boolean, copy: (t: string) => void = () => undefined): AppHost =>
  ({
    settings: { digits: 12, angle: "rad", format: "std", decimalMark: comma ? "comma" : "point" },
    calc: { ready: async () => undefined },
    kv: { get: async () => undefined, set: async () => undefined },
    userNames: [],
    setEntry: () => undefined,
    copy,
    notice: () => undefined,
  }) as unknown as AppHost;

const cell = (s: string): Cell => ({ ok: true, display: s, full: s, value: { re: decimalFromString(s) ?? ZERO_VALUE, im: ZERO_VALUE }, facts: { reliableDigits: 40, exact: false } as Cell["facts"] });

function fn(h: AppHost): FunctionApp {
  const app = new FunctionApp(h);
  app.readout = { lines: [{ primary: true, value: "1.5", cell: cell("1.5") }] } as unknown as FunctionApp["readout"];
  app.numSlots = [0];
  app.numXs = ["0", "0.5"];
  app.numCache = new Map([["0", [cell("1.5")]], ["0.5", [cell("2.25")]]]);
  return app;
}
function solve(h: AppHost): SolveApp {
  const app = new SolveApp(h);
  app.selected = "x";
  app.values = { x: "1.5" };
  app.copies = { x: "1.5" };
  return app;
}

/** What the view's ☰ menu item `id` (Copy, or the Num table's CSV) writes to the clipboard. */
async function copied(make: (h: AppHost) => FunctionApp | SolveApp, view: ViewId, id: string, comma: boolean): Promise<string> {
  let clip = "";
  const item = make(host(comma, (t) => (clip = t))).menu(view).find((m) => m.id === id);
  if (!item?.run) throw new Error(`no ${id} item in the ${view} menu`);
  item.run();
  await vi.waitFor(() => expect(clip).not.toBe("")); // (the copy code loads on first use)
  return clip;
}

describe("R100: an app's Copy in comma mode", () => {
  it("Function: the readout's root 1.5 copies as 1,5, and pastes back as 1.5", async () => {
    expect(await copied(fn, "plot", "copy", true)).toBe("1,5");
    expect(parsePastedNumber("1,5", { decimalComma: true })?.latex).toBe("1{,}5");
  });
  it("Function: the CSV has ; between the fields and the mark in the numbers", async () => {
    expect(await copied(fn, "num", "csv", true)).toBe("x;F1\r\n0;1,5\r\n0,5;2,25\r\n");
  });
  it("Solve: the root 1.5 copies as 1,5", async () => {
    expect(await copied(solve, "num", "copy", true)).toBe("1,5");
  });
  it("point mode: as before", async () => {
    expect(await copied(fn, "plot", "copy", false)).toBe("1.5");
    expect(await copied(fn, "num", "csv", false)).toBe("x,F1\r\n0,1.5\r\n0.5,2.25\r\n");
    expect(await copied(solve, "num", "copy", false)).toBe("1.5");
  });
});
