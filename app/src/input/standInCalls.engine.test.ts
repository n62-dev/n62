// SPDX-License-Identifier: GPL-3.0-or-later
// R260 (vvr-1, probe tools/probes/review-1109/vvr-sofia2.mts): `e(x):=x+1` typed with Alpha e defines a function, and
// e(2) then calls it, on the real engine, as Home reads an entry with the session's names (input/entry.ts giacOfEntry).
// The eˣ key's constant still reads as exp(1) beside it.
import { describe, expect, it } from "vitest";
import { applyDefChanges, userNamesOf, type DefEntry } from "../engine/defs.ts";
import { giacAvailable, nodeHost } from "../engine/nodeGiac.ts";
import { defaultHomeSettings } from "../engine/homeDefaults.ts";
import { giacOfEntry } from "./entry.ts";

describe.skipIf(!giacAvailable())("R260: a function named e or i (real Giac)", () => {
  it("e(x):=x+1, then e(2) = 3 and e(2)+\\exponentialE^0 = 4 (derived)", { timeout: 30_000 }, async () => {
    const h = await nodeHost();
    const s = { ...defaultHomeSettings, angle: "rad" as const };
    let log: DefEntry[] = [];
    const run = (latex: string): string => {
      const r = h.home(giacOfEntry(latex, "home", { names: userNamesOf(log) }).giac, s);
      log = applyDefChanges(log, r.defs);
      return r.result.display;
    };
    expect(run("e\\left(x\\right):=x+1")).not.toMatch(/GIAC_ERROR|not allowed/);
    expect(userNamesOf(log).map((n) => `${n.kind} ${n.name}`)).toEqual(["fn e_"]);
    expect(run("e\\left(2\\right)")).toBe("3");
    expect(run("e\\left(2\\right)+\\exponentialE^{0}")).toBe("4");
    expect(run("\\ln\\left(\\exponentialE\\right)")).toBe("1");
    run("i\\left(x\\right):=2x");
    expect(run("i\\left(3\\right)+\\imaginaryI^{2}")).toBe("5");
  });
});
