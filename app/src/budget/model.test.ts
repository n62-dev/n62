// SPDX-License-Identifier: GPL-3.0-or-later
// G272: the uncertainty budget's model, each input's share of σ² (GUM 5.1.2, eq. 10 and its note).
import { describe, expect, it } from "vitest";
import { budgetOf, type BudgetInput, type BudgetShare } from "./model.ts";

/** A share as the table writes it: "< 0.1", "> −0.1", "−4.2". */
const shown = (s: BudgetShare): string => (s.small ? (s.share.startsWith("-") ? "> −0.1" : "< 0.1") : s.share.replace("-", "−"));
const input = (t: string[], second?: string, why?: BudgetInput["why"]): BudgetInput => ({
  terms: t.map((x) => ({ t: x, uy: "1" })),
  ...(second !== undefined ? { second } : {}),
  ...(why ? { why } : {}),
});

type Shares = { rows: string[]; second?: string; rounded?: boolean; over100?: boolean; fallback?: boolean };
type Case = [name: string, t: string[], second: string | undefined, why: BudgetInput["why"], expected: Shares | { reason: string } | null, source: string];

// sources: rows a to c tests/golden/oracle_budget.py (mpmath, 50 digits); the rest derived by hand from the rules
const CASES: Case[] = [
  ["a, t10", ["0.0256", "1.522756"], "0.000025", undefined, { rows: ["98.3", "1.7"], second: "< 0.1", rounded: false, over100: false }, "oracle"],
  ["b, sin(0 ± 0.2)", ["0.04"], "-0.0016", undefined, { rows: ["104.2"], second: "−4.2", over100: true }, "oracle"],
  ["c, sin(0 ± 0.5)", ["0.25"], "-0.0625", "order2", { rows: ["133.3"], second: "−33.3", over100: true }, "oracle"],
  ["d, 0 ± 0.1 squared", ["0"], "0.0002", "order2", { reason: "firstOrderZero" }, "derived"],
  ["e, a + b = 0", ["1"], "-1", "order2", { rows: ["100.0"], fallback: true }, "derived"],
  ["f, a + b < 0", ["4"], "-16", "order2", { rows: ["100.0"], fallback: true }, "derived"],
  ["g, jump", ["1"], undefined, "jump", { reason: "jump" }, "derived"],
  ["h, singular", ["1"], undefined, "singular", { reason: "singular" }, "derived"],
  ["i, zero σ", ["0"], "0", undefined, null, "derived"],
  ["j, zero row", ["0", "1.5"], "0", undefined, { rows: ["100.0", "0"] }, "derived"],
  ["k, small +", ["0.000001", "1"], undefined, undefined, { rows: ["100.0", "< 0.1"] }, "derived"],
  ["l, small −", ["1"], "-0.0001", undefined, { rows: ["100.0"], second: "> −0.1", rounded: false, over100: false }, "derived"],
  ["m, equal thirds", ["1", "1", "1"], undefined, undefined, { rows: ["33.3", "33.3", "33.3"], rounded: true }, "derived"],
  ["n, the threshold", ["0.0005", "0.9995"], undefined, undefined, { rows: ["100.0", "0.1"], rounded: true, over100: false }, "derived"],
  ["o, Home", ["0.09", "0.16"], undefined, undefined, { rows: ["64.0", "36.0"] }, "derived"],
];

describe("budgetOf (G272)", () => {
  it.each(CASES)("%s", (_name, t, second, why, expected) => {
    const b = budgetOf(input(t, second, why));
    if (expected === null || "reason" in expected) {
      expect(b).toEqual(expected);
      return;
    }
    if (!b || !("rows" in b)) throw new Error(`no shares: ${JSON.stringify(b)}`);
    expect(b.rows.map(shown)).toEqual(expected.rows);
    expect(b.second ? shown(b.second) : undefined).toBe(expected.second);
    if (expected.rounded !== undefined) expect(b.rounded).toBe(expected.rounded);
    if (expected.over100 !== undefined) expect(b.over100).toBe(expected.over100);
    expect(b.fallback).toBe(expected.fallback ?? false);
    expect(b.why).toBe(why); // the ⚠ reason is kept (row c), order2 on e and f too
  });

  it("rounded is false where the shown shares sum to 100.0 (rows a, b, c, j, o)", () => {
    for (const [t, s] of [[["0.0256", "1.522756"], "0.000025"], [["0.04"], "-0.0016"], [["0.25"], "-0.0625"], [["0", "1.5"], "0"], [["0.09", "0.16"], undefined]] as const) {
      const b = budgetOf(input([...t], s));
      expect(b && "rows" in b && b.rounded).toBe(false);
    }
  });

  it("R328: total is the sum of the shown tenths, a small share counted as 0 (rows a, b, l, m, n); rounded is total ≠ 100.0", () => {
    for (const [t, s, total] of [
      [["0.0256", "1.522756"], "0.000025", "100.0"],
      [["0.04"], "-0.0016", "100.0"],
      [["1"], "-0.0001", "100.0"],
      [["1", "1", "1"], undefined, "99.9"],
      [["0.0005", "0.9995"], undefined, "100.1"],
    ] as const) {
      const b = budgetOf(input([...t], s));
      if (!b || !("rows" in b)) throw new Error(`no shares: ${JSON.stringify(b)}`);
      expect(b.total).toBe(total);
      expect(b.rounded).toBe(total !== "100.0");
    }
  });

  it("over100 only above 100.0 (rows e, j, k: 100.0 is not over)", () => {
    for (const [t, s] of [[["1"], "-1"], [["0", "1.5"], "0"], [["0.000001", "1"], undefined]] as const) {
      const b = budgetOf(input([...t], s));
      expect(b && "rows" in b && b.over100).toBe(false);
    }
  });

  it("an exact zero row is 0, not small; a small one keeps its sign", () => {
    const j = budgetOf(input(["0", "1.5"], "0"));
    expect(j && "rows" in j && j.rows[1]).toMatchObject({ share: "0" });
    expect(j && "rows" in j && j.rows[1]?.small).toBeUndefined();
    const l = budgetOf(input(["1"], "-0.0001"));
    expect(l && "rows" in l && l.second).toEqual({ share: "-0.1", small: true });
  });

  it("keys: pasr_ and noBasis are independent; no key and a leaf are not; uy at 2 significant digits", () => {
    const b = budgetOf({
      terms: [
        { t: "4", uy: "1.234" },
        { key: "pasl_a", t: "3", uy: "2" },
        { key: "pasr_7", t: "2", uy: "0.5" },
        { key: "pasc_mu0", t: "1", uy: "1e-7" },
      ],
      noBasis: ["pasc_mu0"],
    });
    if (!b || !("rows" in b)) throw new Error("no rows");
    expect(b.rows.map((r) => [r.key, r.uy, r.independent])).toEqual([
      [undefined, "1.2", undefined],
      ["pasl_a", "2.0", undefined],
      ["pasr_7", "0.50", true],
      ["pasc_mu0", "1.0E-7", true],
    ]);
  });

  it("order: the larger first, ties in input order, the second-order row apart", () => {
    const b = budgetOf({
      terms: [
        { key: "x1", t: "1", uy: "1" },
        { key: "x2", t: "3", uy: "1" },
        { key: "x3", t: "1", uy: "1" },
        { key: "x4", t: "0.5", uy: "1" },
      ],
      second: "0.5",
    });
    if (!b || !("rows" in b)) throw new Error("no rows");
    expect(b.rows.map((r) => r.key)).toEqual(["x2", "x1", "x3", "x4"]);
    expect(b.rows.map((r) => r.share)).toEqual(["50.0", "16.7", "16.7", "8.3"]);
    expect(b.second?.share).toBe("8.3");
  });

  it("a term or σ part that does not parse gives no budget", () => {
    expect(budgetOf({ terms: [{ t: "x", uy: "1" }] })).toBeNull();
    expect(budgetOf({ terms: [{ t: "1", uy: "?" }] })).toBeNull();
    expect(budgetOf({ terms: [{ t: "1", uy: "1" }], second: "1/2" })).toBeNull();
    expect(budgetOf({ terms: [] })).toBeNull();
  });

  it("exponent forms and far-apart magnitudes stay exact (BigInt)", () => {
    const b = budgetOf({ terms: [{ t: "1E-300", uy: "1" }, { t: "2.5e2", uy: "1" }] });
    expect(b && "rows" in b && b.rows.map(shown)).toEqual(["100.0", "< 0.1"]);
  });

  it("parts 4E8 orders apart give their shares at once, not 10^400000000 (audit, run 1280)", () => {
    const t0 = performance.now();
    const p = budgetOf(input(["1E-400000000", "1"]));
    expect(p && "rows" in p && p.rows.map(shown)).toEqual(["100.0", "< 0.1"]);
    const q = budgetOf(input(["1"], "-1E-400000000"));
    if (!q || !("rows" in q)) throw new Error(`no shares: ${JSON.stringify(q)}`);
    expect([q.rows.map(shown), q.second && shown(q.second), q.fallback, q.rounded, q.over100]).toEqual([["100.0"], "> −0.1", false, false, false]);
    // an exact zero's exponent scales nothing
    const z = budgetOf(input(["0E-400000000", "1"], "0E-400000000"));
    expect(z && "rows" in z && [z.rows.map(shown), z.second]).toEqual([["100.0", "0"], undefined]);
    // the order of two far-apart small rows is exact too
    const o = budgetOf({ terms: [{ key: "x1", t: "1E-400000000", uy: "1" }, { key: "x2", t: "3E-300000000", uy: "1" }, { key: "x3", t: "1", uy: "1" }] });
    expect(o && "rows" in o && o.rows.map((r) => r.key)).toEqual(["x3", "x2", "x1"]);
    expect(performance.now() - t0).toBeLessThan(1000);
  });

  it("a far part decides an exact threshold when it can, else no budget (never a guess)", () => {
    // 1E-40 is summed exactly: over 1 + 1E-40, 0.9995 is just below 99.95 % and 0.0005 just below 0.05 % (row n reads 100.0, 0.1)
    const n = budgetOf(input(["0.0005", "0.9995", "1E-40"]));
    expect(n && "rows" in n && n.rows.map(shown)).toEqual(["99.9", "< 0.1", "< 0.1"]);
    // 1E-2000 is only bounded: the threshold row reads 0.1 at one end of the bound and < 0.1 at the other
    expect(budgetOf(input(["0.0005", "0.9995", "1E-2000"]))).toBeNull();
    // a + b = 0 up to a far part: its sign is not known exactly, so neither is the base
    expect(budgetOf(input(["1", "1E-2000"], "-1"))).toBeNull();
    // an exponent BigInt cannot reach
    expect(budgetOf(input(["1E99999999999999999999", "1"]))).toBeNull();
  });
});
