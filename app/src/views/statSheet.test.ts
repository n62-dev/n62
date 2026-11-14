// SPDX-License-Identifier: GPL-3.0-or-later
// R184: the labelled sheet of linreg and stats1. Values are derived from the engine's exact lists (stats.ts, golden
// g223-linreg: slope 97/50, intercept 3/20, r² 9409/9450; g223-stats1: 4, 5/2, sqrt(5/3), sqrt(5)/2, 1, 4).
import { describe, expect, it } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import { decimalFromRational } from "../engine/format.ts";
import type { Chip } from "../input/chips.ts";
import { fakeKv } from "../state/fakeKv.ts";
import { Session, type HistoryItem } from "../state/session.svelte.ts";
import { Sheet } from "./sheet.svelte.ts";
import { statCall, statItems } from "./statSheet.ts";

const LINREG = "\\operatorname{linreg}\\left(\\left\\{1,2,3,4\\right\\},\\left\\{2.1,3.9,6.2,7.8\\right\\}\\right)";
const STATS1 = "\\operatorname{stats1}\\left(\\left\\{1,2,3,4\\right\\}\\right)";

const session = new Session(new FakeCalc(), fakeKv());
const draw = (el: HistoryItem) => session.display(el);
/** A finished Home row whose list has the numbers `nums` (numerator, denominator) as its elements, as the engine's facts hold them. */
const row = (latex: string, full: string, nums: [bigint, bigint][] = []): HistoryItem =>
  ({
    id: 1, view: "home", latex, status: "done", resultLatex: "", text: "", approximate: true, full, fullExact: true,
    facts: {
      exact: false, reliableDigits: null,
      items: nums.map(([p, q]) => ({ exact: true, reliableDigits: null, value: { re: decimalFromRational(p, q), im: decimalFromRational(0n, 1n) } })),
    },
  }) as HistoryItem;
const linreg = row(LINREG, "list[97/50,3/20,9409/9450]", [[97n, 50n], [3n, 20n], [9409n, 9450n]]);
const stats1 = row(STATS1, "list[4,5/2,sqrt(5/3),sqrt(5)/2,1,4]", [[4n, 1n], [5n, 2n], [12909944487n, 10000000000n], [11180339887n, 10000000000n], [1n, 1n], [4n, 1n]]);

describe("the labelled result sheet (R184)", () => {
  it("a row that calls linreg: Slope, Intercept, r², each with its value", () => {
    const items = statItems(linreg, draw, () => {});
    expect(items?.map((i) => [i.label, i.value])).toEqual([
      ["Slope", "1.94"],
      ["Intercept", "0.15"],
      ["r²", "0.995661375661"],
    ]);
  });

  it("a row that calls stats1: n, Mean, Sample s (n−1), Population s (n), Min, Max", () => {
    const items = statItems(stats1, draw, () => {});
    expect(items?.map((i) => [i.label, i.value])).toEqual([
      ["n", "4"],
      ["Mean", "2.5"],
      ["Sample s (n−1)", "1.2909944487"],
      ["Population s (n)", "1.1180339887"],
      ["Min", "1"],
      ["Max", "4"],
    ]);
  });

  it("every row of a linreg sheet and of a stats1 sheet has the press count kind stat-sheet (R184f1, R127)", () => {
    for (const r of [linreg, stats1]) {
      const items = statItems(r, draw, () => {}) ?? [];
      expect(items.length).toBeGreaterThan(0);
      expect(items.map((i) => i.count)).toEqual(items.map(() => "stat-sheet"));
    }
  });

  it("a pick inserts that value as a chip carrying its exact text", () => {
    const got: [string, Chip][] = [];
    const items = statItems(linreg, draw, (s, c) => void got.push([s, c])) ?? [];
    const sheet = new Sheet("list:Linear regression", "Linear regression", () => items, { remember: false });
    expect(sheet.level.rows.map((r) => r.n)).toEqual([1, 2, 3]);
    const p = sheet.pickNumber(1);
    if (p.kind === "run") p.item.run?.();
    expect(got).toEqual([["1.94", { value: "97/50", exact: true }]]);
  });

  it("an element with no number kept (exact text) goes in as a stacked fraction, or as the engine prints it", () => {
    const exact = row(LINREG, "list[97/50,-3/20,2]");
    const got: string[] = [];
    statItems(exact, draw, (s) => void got.push(s))?.forEach((i) => i.run?.());
    expect(got).toEqual(["\\frac{97}{50}", "-\\frac{3}{20}", "2"]);
  });

  it("each value is drawn as the row draws it: the comma digit group does not split the list, an exponent is LaTeX", () => {
    const wide = row(STATS1, "list[4,2469/2,2,3,1,4]", [[4n, 1n], [2469n, 2n], [2n, 1n], [3n, 1n], [1n, 1n], [4n, 1n]]);
    const small = row(STATS1, "list[4,3/200000,2,3,1,4]", [[4n, 1n], [3n, 200000n], [2n, 1n], [3n, 1n], [1n, 1n], [4n, 1n]]);
    session.settings.groupSep = "comma";
    try {
      const at = (r: HistoryItem): [string, string][] => {
        const out: [string, string][] = [];
        for (const i of statItems(r, draw, (s) => void out.push(["", s])) ?? []) {
          i.run?.();
          out[out.length - 1] = [i.value ?? "", (out.at(-1) as [string, string])[1]];
        }
        return out;
      };
      expect(at(wide)).toHaveLength(6); // not 7: `{4, 1234.5, …}` is not split on its comma
      expect(at(wide)[1]).toEqual(["1234.5", "1234.5"]);
      const [shown, latex] = at(small)[1] as [string, string];
      expect(shown).toBe("1.5E-5");
      expect(latex).toBe("1.5\\times10^{-5}");
    } finally {
      session.settings.groupSep = "thin";
    }
  });

  it("an approximate list: each chip carries its own element's digits and warning, not the list's", () => {
    const base = row(LINREG, "list[1.5,2.5,3.5]", [[3n, 2n], [5n, 2n], [7n, 2n]]);
    const els = (base.facts?.items ?? []).map((e, i) => ({ ...e, exact: false, reliableDigits: [7, 4, 9][i] as number, ...(i === 1 ? { warn: "unchecked" as const } : {}) }));
    const approx = { ...base, fullExact: false, facts: { exact: false, reliableDigits: 2, warn: "unchecked", items: els } } as unknown as HistoryItem;
    const got: Chip[] = [];
    statItems(approx, draw, (_s, c) => void got.push(c))?.forEach((i) => i.run?.());
    expect(got.map((c) => c.reliableDigits)).toEqual([7, 4, 9]);
    expect(got.map((c) => c.warn)).toEqual([undefined, "unchecked", undefined]);
  });

  it("only a call that is the entry's top call opens it", () => {
    expect(statCall(LINREG)).toBe("linreg");
    expect(statCall(STATS1)).toBe("stats1");
    expect(statCall("\\operatorname{stats1}\\left(\\left(1\\right)\\right)")).toBe("stats1"); // a nested bracket
    expect(statCall("\\operatorname{stats1}\\left(\\left\\{1\\right\\}\\right)+\\operatorname{stats1}\\left(\\left\\{1\\right\\}\\right)")).toBeNull();
    expect(statCall("stats1(\\left\\{1,2\\right\\})")).toBeNull(); // typed letters are a product, not a call
    expect(statCall(`${STATS1}+1`)).toBeNull();
    expect(statCall(`2\\cdot ${STATS1}`)).toBeNull();
    expect(statCall("\\operatorname{mean}\\left(\\left\\{1,2\\right\\}\\right)")).toBeNull();
    expect(statCall("7")).toBeNull();
    expect(statItems(row("7", "7"), draw, () => {})).toBeNull();
    expect(statItems(row(`${STATS1}+1`, "list[1]"), draw, () => {})).toBeNull();
  });

  it("an answer without an exact text, or of another size, has no sheet", () => {
    const { full: _f, ...bare } = linreg;
    expect(statItems(bare as HistoryItem, draw, () => {})).toBeNull();
    expect(statItems(row(LINREG, "list[1,2]"), draw, () => {})).toBeNull();
  });
});
