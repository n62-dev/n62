// SPDX-License-Identifier: GPL-3.0-or-later
// G576 (F352, G552): an exact power past Home's power limit ((1+1/10^5)^(10^5), 2^1000000) gets a number on the float
// path, as 1.00001^100000 and 2^(1e7) do. The values are golden cases (home.yaml g576-*, mpmath); here the path, the
// time and the text rewrite (powers.ts bigPowers, expected texts derived by hand from its rule).
import { beforeAll, describe, expect, it } from "vitest";
import { BIG_POW, bigPowers } from "./powers.ts";
import { EngineHost } from "./host.ts";
import { engineGiac, giacAvailable, loadNodeGiac } from "./nodeGiac.ts";
import { defaultHomeSettings, HOME_DEADLINE_MS } from "./homeEval.ts";

describe("bigPowers", () => {
  it("writes each power through our helper, the innermost first", () => {
    expect(bigPowers("2^1000000")).toBe(`${BIG_POW}(2,1000000)`);
    expect(bigPowers("(1+1/10^5)^(10^5)")).toBe(`${BIG_POW}((1+1/${BIG_POW}(10,5)),(${BIG_POW}(10,5)))`);
    expect(bigPowers("x^y^z")).toBe(`${BIG_POW}(x,${BIG_POW}(y,z))`);
    expect(bigPowers("-3^2+f(2)^-1")).toBe(`-${BIG_POW}(3,2)+${BIG_POW}(f(2),-1)`);
  });

  it("leaves what it cannot read as typed, and a text without a power or with a string", () => {
    expect(bigPowers("[1,2].^2+2^3")).toBe(`[1,2].^2+${BIG_POW}(2,3)`);
    expect(bigPowers("[1,2]^2")).toBeNull();
    expect(bigPowers("sin(x)")).toBeNull();
    expect(bigPowers('2^3+"a"')).toBeNull();
  });
});

describe.skipIf(!giacAvailable())("G576: Home's float path for a power past the power limit (real Giac)", () => {
  let host: EngineHost;
  beforeAll(async () => {
    const L = await loadNodeGiac();
    host = new EngineHost(engineGiac(L), L.bridge);
  });
  const home = (input: string) => host.home(input, defaultHomeSettings).result;

  it("every g576 golden input gets a number on the float path, within Home's deadline", () => {
    const inputs = [
      "(1+1/10^5)^(10^5)", "(1+1/10^8)^(10^8)", "(11/10)^100000", "(1+1/525600)^525600", "2^1000000", "2^(10^7)",
      "10^(10^6)", "7^(10^6)", "(1+1/365)^36500", "(101/100)^(5*10^4)", "3^(10^6)", "(1/2)^(10^6)", "2^(-1073741000)",
    ];
    const bad = inputs.flatMap((input) => {
      const r = home(input);
      const fine = r.ok && (r.path === "float-error" || r.path === "float-big") && r.totalMs < HOME_DEADLINE_MS;
      return fine ? [] : [`${input}: ${JSON.stringify({ ok: r.ok, path: r.path, display: r.display, totalMs: r.totalMs })}`];
    });
    expect(bad).toEqual([]);
  });

  it("keeps the exact path under the limit, a symbolic power, and G187's refusal past MPFR's range", () => {
    expect(home("2^100000")).toMatchObject({ ok: true, path: "exact-big" });
    expect(home("1000!")).toMatchObject({ ok: true, path: "exact-big" });
    expect(home("(1+1/365)^3650")).toMatchObject({ ok: true, path: "exact" });
    expect(home("x^1000000")).toMatchObject({ ok: true, display: "x^1000000" });
    expect(home("2^(2^40)")).toMatchObject({ ok: false, error: "overflow" });
  });
});
