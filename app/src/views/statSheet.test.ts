// SPDX-License-Identifier: GPL-3.0-or-later
// R184: the labelled sheet of linreg and stats1. Values are derived from the engine's exact lists (stats.ts, golden
// g223-linreg: slope 97/50, intercept 3/20, r² 9409/9450; g223-stats1: 4, 5/2, sqrt(5/3), sqrt(5)/2, 1, 4).
import { describe, expect, it } from "vitest";
import type { Chip } from "../input/chips.ts";
import type { HistoryItem } from "../state/session.svelte.ts";
import { Sheet } from "./sheet.svelte.ts";
import { statCall, statItems } from "./statSheet.ts";

const LINREG = "\\operatorname{linreg}\\left(\\left\\{1,2,3,4\\right\\},\\left\\{2.1,3.9,6.2,7.8\\right\\}\\right)";
const STATS1 = "\\operatorname{stats1}\\left(\\left\\{1,2,3,4\\right\\}\\right)";

const row = (latex: string, full: string, text: string): HistoryItem =>
  ({ id: 1, view: "home", latex, status: "done", resultLatex: "", text, approximate: true, full, fullExact: true }) as HistoryItem;
const linreg = row(LINREG, "list[97/50,3/20,9409/9450]", "{1.94, 0.15, 0.995661375661}");
const stats1 = row(STATS1, "list[4,5/2,sqrt(5/3),sqrt(5)/2,1,4]", "{4, 2.5, 1.29099444874, 1.11803398875, 1, 4}");

describe("the labelled result sheet (R184)", () => {
  it("a row that calls linreg: Slope, Intercept, r², each with its value", () => {
    const items = statItems(linreg, linreg.text, () => {});
    expect(items?.map((i) => [i.label, i.value])).toEqual([
      ["Slope", "1.94"],
      ["Intercept", "0.15"],
      ["r²", "0.995661375661"],
    ]);
  });

  it("a row that calls stats1: n, Mean, Sample s (n−1), Population s (n), Min, Max", () => {
    const items = statItems(stats1, stats1.text, () => {});
    expect(items?.map((i) => [i.label, i.value])).toEqual([
      ["n", "4"],
      ["Mean", "2.5"],
      ["Sample s (n−1)", "1.29099444874"],
      ["Population s (n)", "1.11803398875"],
      ["Min", "1"],
      ["Max", "4"],
    ]);
  });

  it("a pick inserts that value as a chip carrying its exact text", () => {
    const got: [string, Chip][] = [];
    const items = statItems(linreg, linreg.text, (s, c) => void got.push([s, c])) ?? [];
    const sheet = new Sheet("list:Linear regression", "Linear regression", () => items, { remember: false });
    expect(sheet.level.rows.map((r) => r.n)).toEqual([1, 2, 3]);
    const p = sheet.pickNumber(1);
    if (p.kind === "run") p.item.run?.();
    expect(got).toEqual([["1.94", { value: "97/50", exact: true }]]);
  });

  it("a fraction as drawn goes in stacked", () => {
    const frac = row(LINREG, linreg.full as string, "{97/50, -3/20, 0.9956}");
    const got: string[] = [];
    statItems(frac, frac.text, (s) => void got.push(s))?.forEach((i) => i.run?.());
    expect(got).toEqual(["\\frac{97}{50}", "-\\frac{3}{20}", "0.9956"]);
  });

  it("only a call that is the entry's top call opens it", () => {
    expect(statCall(LINREG)).toBe("linreg");
    expect(statCall(STATS1)).toBe("stats1");
    expect(statCall("stats1(\\left\\{1,2\\right\\})")).toBe("stats1");
    expect(statCall(`${STATS1}+1`)).toBeNull();
    expect(statCall(`2\\cdot ${STATS1}`)).toBeNull();
    expect(statCall("\\operatorname{mean}\\left(\\left\\{1,2\\right\\}\\right)")).toBeNull();
    expect(statCall("7")).toBeNull();
    expect(statItems(row("7", "7", "7"), "7", () => {})).toBeNull();
    expect(statItems(row(`${STATS1}+1`, "list[1]", "{1}"), "{1}", () => {})).toBeNull();
  });

  it("an answer without an exact text, or of another size, has no sheet", () => {
    const { full: _f, ...bare } = linreg;
    expect(statItems(bare as HistoryItem, linreg.text, () => {})).toBeNull();
    expect(statItems(row(LINREG, "list[1,2]", "{1, 2}"), "{1, 2}", () => {})).toBeNull();
  });
});
