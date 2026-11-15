// SPDX-License-Identifier: GPL-3.0-or-later
// G40: the unit view's angle wrappers as text: sin, cos and tan take an angle, the inverses give one, and the parser's
// degree factor (R64) is taken off both. No engine (the golden gate's units stage evaluates them). G271: σ's terms, each
// naming its input, on the real engine (skipped without a build, see nodeGiac.ts), on a hand-made slice of Find's table.
import { beforeAll, describe, expect, it } from "vitest";
import { checkArgs, dimInCall, withAngles } from "./evaluate.ts";
import { EngineHost } from "../engine/host.ts";
import { defaultHomeSettings } from "../engine/homeEval.ts";
import { giacAvailable, loadNodeGiac } from "../engine/nodeGiac.ts";
import type { IndexItem } from "../find/types.ts";
import { buildJob } from "./build.ts";
import { factorTable } from "./factors.ts";
import { parseDecimal } from "./uncertainty.ts";
import { isUnitError, type Uncertainty, type UnitRequest } from "./types.ts";

describe("withAngles (P15, G40)", () => {
  it("sin, cos and tan take an angle, without the parser's pasdeg", () => {
    expect(withAngles("sin(pasdeg*30)+cos(x)")).toBe("pasusin(30)+pasucos(x)");
  });
  it("an inverse gives an angle: the parser's /pasdeg after it goes", () => {
    expect(withAngles("(asin(1/2)/pasdeg)*2*m")).toBe("(pasuasin(1/2))*2*m");
    expect(withAngles("acos(x)")).toBe("pasuacos(x)");
    expect(withAngles("(atan2(3*m,4*m)/pasdeg)")).toBe("(pasuatan2(3*m,4*m))");
    expect(withAngles("(atan(1)/pasdeg)+(acot(1)/pasdeg)")).toBe("(pasuatan(1))+(pasuacot(1))");
  });
  it("nested calls and brackets inside the argument", () => {
    expect(withAngles("(asin((asin(1/2)/pasdeg)/(2*(1+1)))/pasdeg)")).toBe("(pasuasin((pasuasin(1/2))/(2*(1+1))))");
    expect(withAngles("sin(pasdeg*(asin(1/2)/pasdeg))")).toBe("pasusin((pasuasin(1/2)))");
  });
  it("leaves other names, a power of pasdeg and an unbalanced call alone", () => {
    expect(withAngles("asinh(1)+basin(2)")).toBe("asinh(1)+basin(2)");
    expect(withAngles("asin(x)/pasdeg^2")).toBe("pasuasin(x)/pasdeg^2");
    expect(withAngles("asin(x")).toBe("asin(x");
  });
});

describe("surd as a power (G357)", () => {
  it("the value's text takes pasusurd, the check's pasucsurd, and a function of a pure number keeps its test", () => {
    expect(withAngles("surd(27*(pasdimL^3),3)")).toBe("pasusurd(27*(pasdimL^3),3)");
    expect(checkArgs(withAngles("pasz2*surd(pasz1*pasdimL^3,3)"))).toBe("pasz2*pasucsurd(pasz1*pasdimL^3,3)");
    expect(checkArgs(withAngles("exp(surd(pasz1*pasdimL^3,3))"))).toBe("pasucf(pasucz(pasucsurd(pasz1*pasdimL^3,3)))");
  });
  it("a dimension inside surd alone does not make the check run with the value (a power never refuses)", () => {
    expect(dimInCall(withAngles("surd(pasz1*pasdimL^3,3)"))).toBe(false);
    expect(dimInCall(withAngles("exp(surd(pasz1*pasdimL^3,3))"))).toBe(true);
  });
});

const item = (kind: string, id: string, x: Record<string, unknown>): IndexItem =>
  ({ id: `${kind}:${id}`, kind, names: [id], title: id, tier: 0, insert: "", ...x }) as unknown as IndexItem;
/** G81's fixture (build.test.ts): two constants sharing the leaf fine_structure; exact_leaf has σ 0. */
const LEAVES = { fine_structure: { value: "7.3E-3", unc: "1E-12" }, exact_leaf: { value: "2", unc: "0" } };
const TABLE = factorTable([
  item("unit", "m", { dim: "m1", si: "1" }), item("unit", "W", { dim: "kg1m2s-3", si: "1" }), item("unit", "dBm", { dim: "kg1m2s-3" }), item("pfx", "c", { si: "1/100" }),
  item("const", "G", { value: "6.67430E-11", unc: "1.5E-15", dim: "kg-1m3s-2" }),
  item("const", "mu", { value: "1.2E-6", unc: "2E-16", basis: "pasl_exact_leaf*pasl_fine_structure", basisLeaves: LEAVES, dim: "kg1" }),
  item("const", "eps", { value: "8.8E-12", unc: "1E-21", basis: "1/pasl_fine_structure", basisLeaves: LEAVES, dim: "kg-1" }),
]);
const M = { tokens: [{ unit: "m" }] };

/** Two decimal texts agree to 28 significant digits (parseDecimal's exact m · 10^k; a 0 only with a 0). */
function near(got: string | undefined, want: string): boolean {
  const a = got === undefined ? null : parseDecimal(got);
  const b = parseDecimal(want)!;
  if (!a) return false;
  const k = Math.min(a.k, b.k);
  const v = (d: { neg: boolean; m: bigint; k: number }): bigint => (d.neg ? -1n : 1n) * d.m * 10n ** BigInt(d.k - k);
  const [x, y] = [v(a), v(b)];
  const diff = x - y < 0n ? y - x : x - y;
  return y === 0n ? x === 0n : diff * 10n ** 28n <= (y < 0n ? -y : y);
}

describe.skipIf(!giacAvailable())("σ's terms, each naming its input (G271, real Giac)", () => {
  let host: EngineHost;
  beforeAll(async () => {
    const L = await loadNodeGiac();
    host = new EngineHost(L.giac, L.bridge);
  });
  const unc = (req: UnitRequest): Uncertainty => {
    const job = buildJob(req, TABLE);
    if (isUnitError(job)) throw new Error(JSON.stringify(job));
    const q = host.units(job, defaultHomeSettings);
    if (isUnitError(q) || !q.unc) throw new Error(JSON.stringify(q));
    return q.unc;
  };
  /** The terms as [key, t, uy], each number checked to 28 digits against `want`'s. */
  const expectTerms = (u: Uncertainty, want: [string | undefined, string, string][]): void => {
    expect(u.terms?.length).toBe(want.length);
    want.forEach(([key, t, uy], i) => {
      const got = u.terms![i]!;
      expect(got.key).toBe(key);
      expect(near(got.t, t), `t ${got.t} vs ${t}`).toBe(true);
      expect(near(got.uy, uy), `uy ${got.uy} vs ${uy}`).toBe(true);
    });
  };
  const T10 = "pasupm(12.34,0.05)*pasu1*pasupm(3.2,0.1)*pasu2";

  it("g01 (task t10): (12.34 ± 0.05) m × (3.2 ± 0.1) m, in input order, no keys; the second-order part", () => {
    const u = unc({ formula: T10, slots: [M, M] });
    // (∂f/∂x·u)² = (3.2·0.05)², (12.34·0.1)²; second = 2·½·(∂²f/∂x∂y)²·0.05²·0.1²
    expectTerms(u, [[undefined, "0.0256", "0.16"], [undefined, "1.522756", "1.234"]]);
    expect(near(u.second, "0.000025"), `second ${u.second}`).toBe(true);
    expect(u.text).toBe("1.2");
  });
  it("g07: the end slot cm² puts the terms in the shown unit", () => {
    const u = unc({ formula: T10, slots: [M, M], end: { tokens: [{ prefix: "c", unit: "m", power: "2" }] } });
    expectTerms(u, [[undefined, "2560000", "1600"], [undefined, "152275600", "12340"]]);
    expect(near(u.second, "2500"), `second ${u.second}`).toBe(true);
  });
  it("a chip's key: pasupm(2,0.1,pasr_3)^2 is one term named pasr_3", () => {
    const u = unc({ formula: "pasupm(2,0.1,pasr_3)^2", slots: [] });
    expectTerms(u, [["pasr_3", "0.16", "0.4"]]);
  });
  it("two typed ± values (g02): two terms without a key", () => {
    const u = unc({ formula: "pasupm(10.0,0.3)*pasu1+pasupm(2.5,0.4)*pasu2", slots: [M, M] });
    expectTerms(u, [[undefined, "0.09", "0.3"], [undefined, "0.16", "0.4"]]);
    expect(near(u.second, "0"), `second ${u.second}`).toBe(true);
  });
  it("a constant alone ({=G}): one term named by its id", () => {
    const u = unc({ formula: "pask1", slots: [], consts: ["G"] });
    expectTerms(u, [["G", "2.25E-30", "1.5E-15"]]);
  });
  it("G81: a pair sharing a leaf names the leaf; the leaf of σ 0 has no term", () => {
    // μ·ε = 2α·(1/α) = 2: the leaf's derivative is 0
    expectTerms(unc({ formula: "pask1*pask2", slots: [], consts: ["mu", "eps"] }), [["pasl_fine_structure", "0", "0"]]);
    // μ/ε = 2α²: ∂f/∂α = 4α = 0.0292, second = ½·4²·u⁴ (mpmath)
    const u = unc({ formula: "pask1/pask2", slots: [], consts: ["mu", "eps"] });
    expect(u.terms?.every((t) => t.key?.startsWith("pasl_"))).toBe(true);
    expectTerms(u, [["pasl_fine_structure", "8.5264E-28", "2.92E-14"]]);
    expect(near(u.second, "8E-48"), `second ${u.second}`).toBe(true);
  });
  it("g08: pasupm(1,0.1) W to dBm, one term, the level's curvature in second (mpmath)", () => {
    const u = unc({ formula: "pasupm(1,0.1)*pasu1", slots: [{ tokens: [{ unit: "W" }] }], end: { tokens: [{ unit: "dBm" }] } });
    expectTerms(u, [[undefined, "0.1886116970116139292199608299650608736659", "0.4342944819032518276511289189166050822944"]]);
    expect(near(u.second, "0.004715292425290348230499020749126521841647"), `second ${u.second}`).toBe(true);
    expect(u.text).toBe("0.44");
  });
});
