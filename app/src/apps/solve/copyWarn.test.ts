// SPDX-License-Identifier: GPL-3.0-or-later
// G796 (fix round 2, items 1 and 3): a ⚠ Solve root keeps every confirmed digit as its known and its Home chip (G68,
// R262: the facts claim 40), while Copy writes no more than the digits setting shows. The root is source.test.ts's:
// sqrt(2) to 40 digits (mpmath: 1.414213562373095048801688724209698078570); 8 digits rounded: 1.4142136.
import { describe, expect, it } from "vitest";
import { decimalFromString, ZERO_VALUE } from "../../engine/format.ts";
import { defaultHomeSettings } from "../../engine/homeEval.ts";
import type { ValueFacts } from "../../engine/types.ts";
import type { Chip } from "../../input/chips.ts";
import type { AppHost } from "../types.ts";
import { SolveApp } from "./app.svelte.ts";

const FULL = "1.414213562373095048801688724209698078570";
const ROOT = { display: "1.41421356237", value: { re: decimalFromString(FULL) ?? ZERO_VALUE, im: ZERO_VALUE }, full: FULL, facts: { exact: false, reliableDigits: 40, warn: "unaudited" } as ValueFacts };

interface Inner {
  setFromResult(name: string, display: string, warn?: boolean): void;
  keepFull(name: string, display: string, r: typeof ROOT): Promise<void>;
}
const make = (digits: number): { app: SolveApp; copied: string[]; chips: Chip[] } => {
  const copied: string[] = [];
  const chips: Chip[] = [];
  const settings = { ...defaultHomeSettings, digits };
  const h = {
    calc: { ready: async () => undefined },
    settings,
    kv: { get: async () => undefined, set: async () => undefined },
    userNames: [],
    setEntry: () => undefined,
    copy: (t: string) => void copied.push(t),
    toHome: (_s: string, c: Chip) => void chips.push(c),
  } as unknown as AppHost;
  return { app: new SolveApp(h), copied, chips };
};
const solved = async (digits: number): Promise<ReturnType<typeof make>> => {
  const m = make(digits);
  const inner = m.app as unknown as Inner;
  m.app.unknowns = ["x"];
  inner.setFromResult("x", ROOT.display, true);
  await inner.keepFull("x", ROOT.display, ROOT);
  m.app.selected = "x";
  return m;
};

describe("G796: a ⚠ Solve root keeps its 40 confirmed digits, Copy writes what it shows", () => {
  it("the known and the copy kept hold all 40 digits, with the facts' count", async () => {
    const { app } = await solved(12);
    expect(app.copies["x"]).toBe("1.41421356237309504880168872420969807857");
    const k = app.known("x");
    expect(k.value).toBe("1.41421356237309504880168872420969807857");
    expect(k.facts?.reliableDigits).toBe(40);
  });
  it("the Home chip carries all 40 digits", async () => {
    const { app, chips } = await solved(12);
    await app.toHome("x");
    expect(JSON.stringify(chips[0])).toContain("1.41421356237309504880168872420969807857");
  });
  it("Copy writes the 12 shown digits", async () => {
    const { app, copied } = await solved(12);
    await app.copyValue("x");
    expect(copied).toEqual(["1.41421356237"]);
  });
  it("digits 8: Copy writes the 8 shown digits", async () => {
    const { app, copied } = await solved(8);
    await app.copyValue("x");
    expect(copied).toEqual(["1.4142136"]);
  });
});
