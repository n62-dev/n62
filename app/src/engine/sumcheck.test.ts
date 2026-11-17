// SPDX-License-Identifier: GPL-3.0-or-later
// G618: Giac's closed form of Σ to ∞ against the series' own terms (sumcheck.ts). The values are derived (telescoping,
// the Basel and Leibniz series, (1 + π coth π)/2 for Σ_{k≥0} 1/(k²+1)); a value off by a relative 1e-6 must be refuted
// and one off by 1e-11 kept, which shows the check ran and that its estimate is far inside REL.
import { beforeAll, describe, expect, it } from "vitest";
import { euler, sumRefuted } from "./sumcheck.ts";
import { engineGiac, giacAvailable, loadNodeGiac, type EngineGiac } from "./nodeGiac.ts";

describe("Euler's transform", () => {
  it("averages consecutive partial sums pairwise down to one", () => {
    expect(euler([1, 0])).toBe(0.5);
    expect(euler([0, 1, 0])).toBe(0.5);
    // Leibniz: partial sums of 1 − 1/3 + 1/5 − … from the 200th on, 12 levels: π/4 to 1e-12
    const partials: number[] = [];
    let s = 0;
    for (let j = 0; j < 213; j++) {
      if (j >= 200) partials.push(s);
      s += (j % 2 ? -1 : 1) / (2 * j + 1);
    }
    expect(Math.abs(euler(partials) - Math.PI / 4)).toBeLessThan(1e-12);
  });
});

describe.skipIf(!giacAvailable())("G618 on the real engine", () => {
  let giac: EngineGiac;
  beforeAll(async () => {
    giac = engineGiac(await loadNodeGiac());
  });
  const right: [string, string, number, number, string][] = [
    ["1/k^2", "k", 1, Infinity, "pi^2/6"],
    ["1/(k*(k+1))", "k", 1, Infinity, "1"],
    ["1/(k*(k+4))", "k", 1, Infinity, "25/48"],
    ["1/(k^2+1)", "k", 0, Infinity, "(1+pi*cosh(pi)/sinh(pi))/2"],
    ["1/(k^2-4)", "k", 3, Infinity, "25/48"],
    ["(-1)^k/k", "k", 1, Infinity, "-ln(2)"],
    ["(-1)^k/k", "k", 2, Infinity, "1-ln(2)"],
    ["(-1)^k/k^2", "k", 2, Infinity, "1-pi^2/12"],
    ["(-1)^(n+1)/(2*n+1)", "n", 0, Infinity, "-pi/4"],
    ["1/k^2", "k", -Infinity, -1, "pi^2/6"],
    ["1/(k^2+1)", "k", -Infinity, Infinity, "pi*cosh(pi)/sinh(pi)"],
  ];
  it.each(right)("Σ %s over %s from %s to %s = %s: kept, refuted when off by 1e-6", (t, k, lo, hi, v) => {
    expect(sumRefuted(giac, t, k, lo, hi, v)).toBe(false);
    expect(sumRefuted(giac, t, k, lo, hi, `(${v})+10^-11`)).toBe(false);
    expect(sumRefuted(giac, t, k, lo, hi, `(${v})*(1+10^-6)`)).toBe(true);
  });
  it("an infinity is refuted only for a series that converges by its terms", () => {
    for (const t of ["1/(k*(k+3))", "k/(k^3+1)", "(-1)^k/k", "1/k^2+(-1)^k/k"]) expect(sumRefuted(giac, t, "k", 1, Infinity, "infinity")).toBe(true);
    // the harmonic series, a term that does not tend to 0, a pole at k = 2 (an undefined term)
    for (const t of ["1/k", "k/(k+1)", "1/(k^2-4)", "(-1)^k*k/(k+1)"]) expect(sumRefuted(giac, t, "k", 1, Infinity, "+infinity")).toBe(false);
  });
  it("terms of another kind, or a pole near the cuts, decide nothing", () => {
    // the right values are not known here: a wrong one must stand too, as the estimate says nothing of these
    for (const t of ["cos(k)/k", "1/2^k", "1/k!", "1/k^(3/2)", "1/((k-150)^2+1)", "(-1)^(2*k)/k^2"]) expect(sumRefuted(giac, t, "k", 1, Infinity, "7")).toBe(false);
    // a finite end that is not an integer, no infinite end
    expect(sumRefuted(giac, "1/k^2", "k", 1.5, Infinity, "7")).toBe(false);
    expect(sumRefuted(giac, "1/k^2", "k", 1, 10, "7")).toBe(false);
  });
});
