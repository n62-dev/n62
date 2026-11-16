// SPDX-License-Identifier: GPL-3.0-or-later
// G390 (sofia's review of the formula-units plan, finding 11): a store on the unit view's line is refused before the
// evaluation, so no name holds our dimension symbols (`x:=3*{m}` left x = 3*pasdimL). Real Giac (skipped without a
// build, see nodeGiac.ts), through EngineHost.units as the app calls it. Expected values: derived (2·3 = 6).
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "../engine/host.ts";
import { defaultHomeSettings } from "../engine/homeEval.ts";
import { giacAvailable, loadNodeGiac } from "../engine/nodeGiac.ts";
import type { IndexItem } from "../find/types.ts";
import { buildJob } from "./build.ts";
import { factorTable } from "./factors.ts";
import { unitErrorMessage } from "./messages.ts";
import { isUnitError, type Quantity, type UnitError, type UnitRequest } from "./types.ts";

const item = (kind: string, id: string, x: Record<string, string>): IndexItem =>
  ({ id: `${kind}:${id}`, kind, names: [id], title: id, tier: 0, insert: "", ...x }) as unknown as IndexItem;
const TABLE = factorTable([
  item("unit", "m", { dim: "m1", si: "1" }),
  item("unit", "s", { dim: "s1", si: "1" }),
  item("const", "c", { value: "299792458", dim: "m1s-1" }),
]);
const M = { tokens: [{ unit: "m" }] };
const S = { tokens: [{ unit: "s" }] };
const MESSAGE = "The unit view does not store: put the result on Home's line, then ▶";

describe.skipIf(!giacAvailable())("a store in the unit view is refused (G390, real Giac)", () => {
  let host: EngineHost;
  beforeAll(async () => {
    const L = await loadNodeGiac();
    host = new EngineHost(L.giac, L.bridge);
    expect(host.home("A:=2", defaultHomeSettings).defs).toMatchObject([{ set: { kind: "var" } }]);
  });
  const units = (req: UnitRequest): Quantity | UnitError => {
    const job = buildJob(req, TABLE);
    return isUnitError(job) ? job : host.units(job, defaultHomeSettings);
  };
  /** What Giac holds under `name` (itself when it is unassigned). */
  const held = (name: string): string => host.giac.eval(name);
  const refused = (r: Quantity | UnitError): void => {
    expect(r).toEqual({ error: "store" });
    expect(unitErrorMessage(r as UnitError)).toBe(MESSAGE);
  };

  it("x:=3·m is refused, and x stays unassigned", () => {
    refused(units({ formula: "x:=3*pasu1", slots: [M] }));
    expect(held("x")).toBe("x");
  });

  it("the same for a store in brackets, (x:=3·m) + 1·m", () => {
    refused(units({ formula: "(x:=3*pasu1)+1*pasu2", slots: [M, M] }));
    expect(held("x")).toBe("x");
  });

  it("sto(3·m, y) and a purge of a name are refused the same way", () => {
    refused(units({ formula: "sto(3*pasu1,y)", slots: [M] }));
    expect(held("y")).toBe("y");
    refused(units({ formula: "purge(A)*pasu1", slots: [M] }));
    expect(held("A")).toBe("2");
  });

  it("a store with an end slot is refused too", () => {
    refused(units({ formula: "x:=3*pasu1", slots: [M], end: M }));
    expect(held("x")).toBe("x");
  });

  it("controls: 3·m, a stored A read in A·3·m, c·1·s and ± are not refused", () => {
    const a = units({ formula: "3*pasu1", slots: [M] }) as Quantity;
    expect(a.value.display).toBe("3");
    expect(a.unit).toBe("m");
    const b = units({ formula: "A*3*pasu1", slots: [M] }) as Quantity;
    expect(b.value.display).toBe("6");
    expect(b.names).toEqual(["A"]);
    const c = units({ formula: "pask1*1*pasu1", slots: [S], consts: ["c"] }) as Quantity;
    expect(c.dimension).toBe("m1");
    expect(c.value.display).toBe("299.792458"); // 299792458 m shown in Mm
    const d = units({ formula: "pasupm(2,0.1)*pasu1", slots: [M] }) as Quantity;
    expect(d.value.display).toBe("2");
    expect(d.unc).toBeDefined();
  });
});
