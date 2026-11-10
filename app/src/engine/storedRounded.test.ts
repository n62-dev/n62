// SPDX-License-Identifier: GPL-3.0-or-later
// S53f1 (store-bu-1): a stored exact value that prints rounded is logged as `rounded` (Vars marks it ≈ like the
// history); an exact one that prints as it is, and a float (facts), are not. Expected: 1/3 = 0.3333… (derived).
import { describe, expect, it } from "vitest";
import { defaultHomeSettings } from "./homeEval.ts";
import { giacAvailable, nodeHost } from "./nodeGiac.ts";

describe.skipIf(!giacAvailable())("S53f1: the log notes a rounded preview", () => {
  const entry = async (line: string) => {
    const host = await nodeHost();
    const sets = host.home(line, defaultHomeSettings).defs.flatMap((c) => ("set" in c ? [c.set] : []));
    return sets.find((e) => e.name === "A");
  };
  it("1/3 ▶ A: no facts, rounded", async () => {
    const e = await entry("1/3 => A");
    expect(e?.preview).toBe("0.333333333333");
    expect(e?.facts).toBeUndefined();
    expect(e?.rounded).toBe(true);
  });
  it("control: 5 ▶ A is exact as shown, no flag", async () => {
    const e = await entry("5 => A");
    expect(e?.rounded).toBeUndefined();
    expect(e?.facts).toBeUndefined();
  });
  it("a float keeps its facts and no flag", async () => {
    const e = await entry("approx(sqrt(2)) => A");
    expect(e?.facts).toBeDefined();
    expect(e?.rounded).toBeUndefined();
  });
});
