// SPDX-License-Identifier: GPL-3.0-or-later
// G173f1: a store arrow (v=>G) of Giac's sequence answer holds the list the result shows, in Giac and in the definitions
// log, and a refused empty sequence leaves the name as it was. Values derived by hand: {3,4}+1 = {4,5}; the eigenvalues of
// diag(2,3) are 2 and 3, so L+1 = {3,4}. (`=>` is Giac's text: the Sto key types `:=`, which G119 covers.)
import { describe, expect, it } from "vitest";
import type { DefEntry } from "./defs.ts";
import { applyDefChanges } from "./defs.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { defaultCasSettings } from "./types.ts";
import { giacAvailable, nodeHost } from "./nodeGiac.ts";

const cmdsOf = (log: readonly DefEntry[], name: string): readonly string[] | undefined => log.find((e) => e.name === name)?.cmds;

describe.skipIf(!giacAvailable())("G173f1: the store arrow of a sequence", () => {
  it("Home: the log entry for G holds the list, so a relaunch keeps it", async () => {
    const host = await nodeHost();
    const { result, defs } = host.home("op([3,4])=>G", defaultHomeSettings);
    expect(result).toMatchObject({ ok: true, display: "{3,4}" });
    const log = applyDefChanges([], defs);
    expect(cmdsOf(log, "G")).toEqual(["G:=(list[3,4])"]);
    const next = await nodeHost();
    next.restore(log);
    expect(next.home("G+1", defaultHomeSettings).result).toMatchObject({ ok: true, display: "{4,5}" });
  });

  it("CAS: the log entry for L holds the list, so a relaunch keeps it", async () => {
    const host = await nodeHost();
    const { result, defs } = host.cas("eigenvals([[2,0],[0,3]])=>L", defaultCasSettings);
    expect(result).toMatchObject({ ok: true, text: "{2,3}" });
    const log = applyDefChanges([], defs);
    expect(cmdsOf(log, "L")).toEqual(["L:=(list[2,3])"]);
    const next = await nodeHost();
    next.restore(log);
    expect(next.cas("L+1", defaultCasSettings).result).toMatchObject({ ok: true, text: "{3,4}" });
  });

  it("a refused empty sequence leaves the log and the earlier value as they were", async () => {
    const host = await nodeHost();
    const log = applyDefChanges([], host.home("E:=5", defaultHomeSettings).defs);
    const refused = host.home("op([])=>E", defaultHomeSettings);
    expect(refused.result).toMatchObject({ ok: false, error: "noValue" });
    expect(refused.defs).toEqual([]);
    expect(host.home("E", defaultHomeSettings).result).toMatchObject({ ok: true, display: "5" });
    expect(cmdsOf(log, "E")).toEqual(["E:=(5)"]);
    const free = host.cas("op([])=>F", defaultCasSettings);
    expect(free.result).toMatchObject({ ok: false, error: "noValue" });
    expect(host.cas("F", defaultCasSettings).result).toMatchObject({ ok: true, text: "F" });
  });

  it("a store into a function name or an element stays as it is (guard: passes on phase-1 too)", async () => {
    const host = await nodeHost();
    const fn = host.home("op([3,4])=>f(x)", defaultHomeSettings);
    expect(fn.defs).toMatchObject([{ set: { name: "f", kind: "fn" } }]);
    expect(host.home("f(1)", defaultHomeSettings).result).toMatchObject({ ok: true, display: "{3,4}" });
    expect(host.home("op([3,4])=>V[1]", defaultHomeSettings).result.display).toContain("table(");
  });
});
