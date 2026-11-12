// SPDX-License-Identifier: GPL-3.0-or-later
// R260 (vvr-1, probe tools/probes/review-1109/vvr-sofia2.mts): `e(x):=x+1` typed with Alpha e defines a function, and
// e(2) then calls it, on the real engine, as Home reads an entry with the session's names (input/entry.ts giacOfEntry).
// The eˣ key's constant still reads as exp(1) beside it.
import { describe, expect, it } from "vitest";
import { applyDefChanges, userNamesOf, type DefEntry } from "../engine/defs.ts";
import { giacAvailable, nodeHost } from "../engine/nodeGiac.ts";
import { defaultHomeSettings } from "../engine/homeDefaults.ts";
import { defaultCasSettings } from "../engine/types.ts";
import { exportLibrary, importText } from "../engine/library.ts";
import { LIBRARY_FORMAT } from "../state/libraryFormat.ts";
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

  it("a typed e(x):=x+1 goes out in a library and back into an empty engine, and e(2) = 3 there (with G311)", { timeout: 30_000 }, async () => {
    const h = await nodeHost();
    const s = { ...defaultHomeSettings, angle: "rad" as const };
    const r = h.home(giacOfEntry("e\\left(x\\right):=x+1", "home").giac, s);
    const log = applyDefChanges([], r.defs);
    const { text, skipped } = exportLibrary(log, LIBRARY_FORMAT);
    expect(skipped).toEqual([]);
    expect(text).toContain("e_(x):=x+1");
    const back = await nodeHost();
    const imported = importText(back, text, LIBRARY_FORMAT.version, [], false);
    if (!imported.result.ok) throw new Error(imported.result.error);
    expect(imported.result.plan.added).toEqual(["e_"]);
    expect(back.home(giacOfEntry("e\\left(2\\right)", "home", { names: userNamesOf(imported.result.log) }).giac, s).result.display).toBe("3");
  });

  it("R260f1: the export's comment lines name beta_ and e_ as typed (β = 2, e(x)), the definitions keep the stand-ins, and the file round-trips (derived)", { timeout: 30_000 }, async () => {
    const h = await nodeHost();
    const s = { ...defaultHomeSettings, angle: "rad" as const };
    let log: DefEntry[] = [];
    for (const latex of ["\\beta:=2", "e\\left(x\\right):=x+1"]) log = applyDefChanges(log, h.home(giacOfEntry(latex, "home", { names: userNamesOf(log) }).giac, s).defs);
    expect(userNamesOf(log).map((n) => n.name).sort()).toEqual(["beta_", "e_"]);
    const { text, skipped } = exportLibrary(log, LIBRARY_FORMAT);
    expect(skipped).toEqual([]);
    const lines = text.split("\n");
    expect(lines).toContain("// β = 2");
    expect(lines).toContain("// e(x)");
    expect(text).not.toMatch(/\/\/.*(beta_|e_)/);
    expect(lines).toContain("beta_:=(2)");
    expect(lines).toContain("e_(x):=x+1");
    const back = await nodeHost();
    const imported = importText(back, text, LIBRARY_FORMAT.version, [], false);
    if (!imported.result.ok) throw new Error(imported.result.error);
    expect(imported.result.plan.added.sort()).toEqual(["beta_", "e_"]);
    expect(back.home(giacOfEntry("e\\left(2\\right)", "home", { names: userNamesOf(imported.result.log) }).giac, s).result.display).toBe("3");
    expect(back.home(giacOfEntry("\\beta", "home", { names: userNamesOf(imported.result.log) }).giac, s).result.display).toBe("2");
    expect(exportLibrary(imported.result.log, LIBRARY_FORMAT).text).toBe(text);
  });

  it("R260f1 fix round 2: a stored value whose preview holds a stand-in not yet stored (y:=2β before β) exports the comment y = 2*β, and the file round-trips (derived)", { timeout: 30_000 }, async () => {
    const h = await nodeHost();
    const s = { ...defaultHomeSettings, angle: "rad" as const };
    let log: DefEntry[] = [];
    for (const latex of ["y:=2\\beta", "z:=e+1"]) log = applyDefChanges(log, h.cas(giacOfEntry(latex, "cas", { names: userNamesOf(log) }).giac, defaultCasSettings).defs);
    expect(userNamesOf(log).map((n) => `${n.name} ${n.preview}`).sort()).toEqual(["y 2*beta_", "z e_+1"]);
    const { text, skipped } = exportLibrary(log, LIBRARY_FORMAT);
    expect(skipped).toEqual([]);
    const lines = text.split("\n");
    expect(lines).toContain("// y = 2*β");
    expect(lines).toContain("// z = e+1");
    expect(text).not.toMatch(/\/\/.*(beta_|e_)/);
    const back = await nodeHost();
    const imported = importText(back, text, LIBRARY_FORMAT.version, [], false);
    if (!imported.result.ok) throw new Error(imported.result.error);
    expect(imported.result.plan.added.sort()).toEqual(["y", "z"]);
    const names = userNamesOf(imported.result.log);
    expect(back.cas(giacOfEntry("\\beta:=3", "cas", { names }).giac, defaultCasSettings).result.ok).toBe(true);
    expect(back.home(giacOfEntry("y", "home", { names }).giac, s).result.display).toBe("6");
    expect(exportLibrary(imported.result.log, LIBRARY_FORMAT).text).toBe(text);
  });
});

