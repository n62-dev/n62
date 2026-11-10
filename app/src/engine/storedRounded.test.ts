// SPDX-License-Identifier: GPL-3.0-or-later
// S53f1 (store-bu-1): a variable set from a result is logged with the mark the history gave that result (`mark`), so Vars
// draws it: 1/3 stores no facts and prints rounded (≈), 5 prints as it is (=), a list holding 1/3 is ≈ too.
// Expected: 1/3 = 0.3333… (derived).
import { describe, expect, it } from "vitest";
import { defaultHomeSettings } from "./homeEval.ts";
import { giacAvailable, nodeHost } from "./nodeGiac.ts";

describe.skipIf(!giacAvailable())("S53f1: the log notes the mark of the stored result", () => {
  const entry = async (line: string) => {
    const host = await nodeHost();
    const sets = host.home(line, defaultHomeSettings).defs.flatMap((c) => ("set" in c ? [c.set] : []));
    return sets.find((e) => e.name === "A");
  };
  it("1/3 ▶ A: no facts, mark ≈", async () => {
    const e = await entry("1/3 => A");
    expect(e?.preview).toBe("0.333333333333");
    expect(e?.facts).toBeUndefined();
    expect(e?.mark).toBe("≈");
  });
  it("control: 5 ▶ A is exact as shown, mark =", async () => {
    const e = await entry("5 => A");
    expect(e?.mark).toBe("=");
    expect(e?.facts).toBeUndefined();
  });
  it("a list holding 1/3 stores no facts and is marked ≈ (its weakest element)", async () => {
    const e = await entry("[1/3,1] => A");
    expect(e?.facts).toBeUndefined();
    expect(e?.mark).toBe("≈");
  });
  it("a list of exact elements keeps =", async () => {
    expect((await entry("[1,2] => A"))?.mark).toBe("=");
  });
  it("a float keeps its facts", async () => {
    const e = await entry("approx(sqrt(2)) => A");
    expect(e?.facts).toBeDefined();
  });
});
