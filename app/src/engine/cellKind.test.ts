// SPDX-License-Identifier: GPL-3.0-or-later
// G365: a Num cell with no number says what it is from the bridge's kind (api.cc kindOf), so the Function app never
// reads Giac's print for it. Values from this engine (probed): 1/x at 0 prints infinity, ln(x) at 0 -infinity,
// sin(x)/x at 0 undef (G168f1, G2 items 19, 22).
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { engineGiac, giacAvailable, loadNodeGiac } from "./nodeGiac.ts";

describe.skipIf(!giacAvailable())("G365: a table cell carries the bridge's kind", () => {
  let host: EngineHost;
  beforeAll(async () => {
    const L = await loadNodeGiac();
    host = new EngineHost(engineGiac(L), L.bridge);
  });
  const cell = (f: string, x: string) => host.table({ fns: [f], xs: [x] }, defaultHomeSettings)[0]![0]!;

  it("a pole is an infinity, a point with no value undef", () => {
    expect(cell("1/x", "0")).toMatchObject({ ok: true, kind: "infinity" });
    expect(cell("ln(x)", "0")).toMatchObject({ ok: true, kind: "infinity" });
    expect(cell("sin(x)/x", "0")).toMatchObject({ ok: true, kind: "undef" });
  });
  it("a number, a list or a refused cell carries none", () => {
    expect(cell("1/x", "2").kind).toBeUndefined();
    expect(cell("sqrt(x)", "-1").kind).toBeUndefined();
    // the bridge calls a vector whose first element is undef undef (Giac's is_undef): a list stays a list
    expect(cell("[sin(x)/x,1]", "0")).toMatchObject({ ok: true, display: "[undef,1]" });
    expect(cell("[sin(x)/x,1]", "0").kind).toBeUndefined();
    expect(cell("[1,sin(x)/x]", "0").kind).toBeUndefined();
    expect(cell("1/0-1/0", "0")).toMatchObject({ ok: false });
    expect(cell("1/0-1/0", "0").kind).toBeUndefined();
  });
});
