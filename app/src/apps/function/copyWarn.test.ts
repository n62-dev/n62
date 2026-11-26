// SPDX-License-Identifier: GPL-3.0-or-later
// G796 (fix round 2, items 2 and 3): a ⚠ Function cell (warn unaudited, 40 confirmed digits) copies the digits the
// setting shows (cell copy, Num CSV), and goes to Home as a chip with all 40, as its facts claim (R262). The value is
// sqrt(2) to 40 digits (mpmath: 1.414213562373095048801688724209698078570); 8 digits rounded: 1.4142136.
import { describe, expect, it, vi } from "vitest";
import { decimalFromString, ZERO_VALUE } from "../../engine/format.ts";
import type { Chip } from "../../input/chips.ts";
import type { AppHost } from "../types.ts";
import type { Cell } from "./engineApi.ts";
vi.mock("../../theme.svelte.ts", () => ({ brightness: () => "dark" }));
import { FunctionApp } from "./app.svelte.ts";

const FULL = "1.414213562373095048801688724209698078570";
const CELL: Cell = { ok: true, display: "1.41421356237", value: { re: decimalFromString(FULL) ?? ZERO_VALUE, im: ZERO_VALUE }, full: FULL, facts: { exact: false, reliableDigits: 40, warn: "unaudited" } };

const make = (digits: number): { app: FunctionApp; copied: string[]; chips: Chip[] } => {
  const copied: string[] = [];
  const chips: Chip[] = [];
  const settings = { digits, angle: "rad", format: "std", decimalMark: "point", groupSep: "thin" };
  const h = {
    calc: { ready: async () => undefined, engine: {} },
    kv: { get: async () => undefined, set: async () => undefined },
    settings,
    userNames: [],
    setEntry: () => undefined,
    copy: (t: string) => void copied.push(t),
    toHome: (_s: string, c: Chip) => void chips.push(c),
    notice: () => undefined,
  } as unknown as AppHost;
  const app = new FunctionApp(h);
  app.define(0, "\\sqrt{2}+0x");
  app.numXs = ["0"];
  app.numSlots = [0];
  app.numCache = new Map([["0", [CELL]]]);
  return { app, copied, chips };
};

describe("G796: a ⚠ Function cell copies what it shows, its Home chip keeps every confirmed digit", () => {
  it("digits 12: the cell copies 1.41421356237", async () => {
    const { app, copied } = make(12);
    await app.copyNumCell(0, 0);
    expect(copied).toEqual(["1.41421356237"]);
  });
  it("digits 8: the cell and the Num CSV copy 1.4142136", async () => {
    const { app, copied } = make(8);
    await app.copyNumCell(0, 0);
    expect(copied).toEqual(["1.4142136"]);
    expect((await app.numCsv())?.split("\r\n")[1]).toBe("0,1.4142136");
  });
  it("the Home chip carries all 40 digits", async () => {
    const { app, chips } = make(12);
    await app.toHome({ cell: CELL } as never);
    expect(JSON.stringify(chips[0])).toContain("1.41421356237309504880168872420969807857");
  });
});
