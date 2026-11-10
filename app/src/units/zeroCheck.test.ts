// SPDX-License-Identifier: GPL-3.0-or-later
// G310 (night review 2026-11-09 be-8): a zero inside a function gets the same dimension check as any other value. The
// golden rows z18–z48 (tests/golden/units.yaml) hold the formulas; this file holds what a row cannot: a function stored
// in Home, and the check text itself. Real Giac (skipped without a build, see nodeGiac.ts). Expected values: oracle
// (exp(1/3) = 1.39561242508609, mpmath) and derived.
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "../engine/host.ts";
import { defaultHomeSettings } from "../engine/homeEval.ts";
import { giacAvailable, loadNodeGiac } from "../engine/nodeGiac.ts";
import type { IndexItem } from "../find/types.ts";
import { checkArgs } from "./evaluate.ts";
import { buildJob } from "./build.ts";
import { factorTable } from "./factors.ts";
import { isUnitError, type Quantity, type UnitError, type UnitRequest } from "./types.ts";

const item = (kind: string, id: string, x: Record<string, string>): IndexItem =>
  ({ id: `${kind}:${id}`, kind, names: [id], title: id, tier: 0, insert: "", ...x }) as unknown as IndexItem;
const TABLE = factorTable([item("unit", "m", { dim: "m1", si: "1" }), item("unit", "s", { dim: "s1", si: "1" })]);
const M = { tokens: [{ unit: "m" }] };

describe("the check text (G310)", () => {
  it("a pure-number function is a free call of its first argument through pasucz; sin and atan2 their own", () => {
    expect(checkArgs("pasz1*exp(pasz2*L)")).toBe("pasz1*pasucf(pasucz(pasz2*L))");
    expect(checkArgs("round(pasz1*L/(pasz2*L),2)")).toBe("pasucf(pasucz(pasz1*L/(pasz2*L)),2)");
    expect(checkArgs("exp(floor(pasz1*L))")).toBe("pasucf(pasucz(pasucf(pasucz(pasz1*L))))");
    expect(checkArgs("pasusin(pasz1*L)+pasuatan2(pasz2*L,pasz3*T)")).toBe("pasucsin(pasz1*L)+pasucatan2(pasz2*L,pasz3*T)");
    expect(checkArgs("max(pasz1*L,pasz2*L)")).toBe("max(pasz1*L,pasz2*L)");
  });
});

describe.skipIf(!giacAvailable())("a zero inside a function, real Giac (G310)", () => {
  let host: EngineHost;
  beforeAll(async () => {
    const L = await loadNodeGiac();
    host = new EngineHost(L.giac, L.bridge);
    expect(host.home("g(x):=abs(x)", defaultHomeSettings).defs).toMatchObject([{ set: { kind: "fn" } }]);
  });
  const units = (req: UnitRequest): Quantity | UnitError => {
    const job = buildJob(req, TABLE);
    return isUnitError(job) ? job : host.units(job, defaultHomeSettings);
  };

  it("control: exp(g(1 m − 2 m)/(3 m)) with g(x):=abs(x) stored is exp(1/3) ≈ 1.39561242509", () => {
    const q = units({ formula: "exp(g(1*pasu1-2*pasu2)/(3*pasu3))", slots: [M, M, M] });
    expect(isUnitError(q) ? q : null).toBeNull();
    expect((q as Quantity).value.display).toBe("1.39561242509");
    expect((q as Quantity).dimension).toBe("");
  });

  it("exp(0 m) is refused as exp(1 m) is", () => {
    expect(units({ formula: "exp(0*pasu1)", slots: [M] })).toEqual({ error: "function" });
    expect(units({ formula: "exp(1*pasu1)", slots: [M] })).toEqual({ error: "function" });
  });
});
