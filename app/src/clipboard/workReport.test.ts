// SPDX-License-Identifier: GPL-3.0-or-later
// R130: the work report of a fixed history, line by line (an exact row, a ≈ row, a ⚠ row with its reason, a unit row with
// σ, a stored name and the row that reads it, an error), in both decimal marks; its file name, its save, and the format
// paragraph the format for your AI holds too. Expected values are derived: 2 + 3, the decimal expansion of 1/3 at 12
// digits, 2π × 25 mm in m at 12 digits (0.157079632679…) with σ = 2π × 0.1 mm = 0.000628… m (0.00063 to 2 digits),
// the facts as given. The unit row is units/row.ts's own (unitRow), its request the LaTeX the unit view stores.
import { describe, expect, it } from "vitest";
import { decimalFromString, type ComplexValue } from "../engine/format.ts";
import { FakeCalc } from "../calc/fake.ts";
import { fakeKv } from "../state/fakeKv.ts";
import { Session, type HistoryItem } from "../state/session.svelte.ts";
import type { HomeResult } from "../engine/homeEval.ts";
import { unitRow } from "../units/row.ts";
import type { Quantity } from "../units/types.ts";
import { aiFormat } from "../views/libraryJobs.ts";
import { reportAbout, reportName, saveWork, workReport } from "./workReport.ts";

const num = (s: string): ComplexValue => ({ re: decimalFromString(s)!, im: decimalFromString("0")! });
let id = 1;
const row = (r: Partial<HistoryItem>): HistoryItem => ({ id: id++, view: "home", latex: "", status: "done", resultLatex: "", text: "", approximate: false, startedAt: 0, ...r });
/** A float Home result at 12 digits, as the unit evaluator gives it. */
const float = (display: string, v: string): HomeResult => ({ ok: true, display, value: num(v), path: "numeric", approximate: true, exactMs: 0, totalMs: 0, facts: { exact: false, reliableDigits: null }, full: display });
const M = { tokens: [{ unit: "m" }] };
const MM = { tokens: [{ prefix: "m", unit: "m" }] };
/** A unit row as the unit view stores it (units/row.ts): `input` is the request as drawn, LaTeX. */
const unitStep = (line: string, input: string): HistoryItem => {
  const q: Quantity = {
    value: float("0.157079632679", "0.15707963267948966"),
    dimension: "m1",
    unit: "m",
    dimensionText: "L",
    shownSlot: M,
    siPrefixed: "mm",
    unc: { value: float("0.000628318530718", "0.000628318530717959"), text: "0.00063", shown: "0.15708 ± 0.00063" },
    ms: 0,
  };
  return { id: id++, ...unitRow({ line, chips: {}, q, slots: { u2: MM, end: M }, input, digits: 12 }) };
};

const HISTORY: HistoryItem[] = [
  row({ latex: "2+3", text: "5", value: num("5"), rational: { n: "5", d: "1" }, full: "5", fullExact: true, facts: { exact: true, reliableDigits: null } }),
  row({ latex: "\\frac{1}{3}", text: "1/3", value: num("0.3333333333333333333333333333333333333333"), rational: { n: "1", d: "3" }, full: "1/3", fullExact: true, facts: { exact: true, reliableDigits: null } }),
  row({ latex: "\\sin\\left(10^{22}\\right)", text: "-0.85220", value: num("-0.8522008497671888"), facts: { exact: false, reliableDigits: 5, why: { decided: true } } }),
  unitStep("2\\times\\pi\\times\\left(25\\pm0.1\\right)", "2\\times\\pi\\times\\left(25\\pm0.1\\right)\\,\\mathrm{mm}\\to\\,\\mathrm{m}"),
  row({ view: "cas", latex: "a:=1234567.5", text: "1234567.5", value: num("1234567.5"), facts: { exact: true, reliableDigits: null }, full: "2469135/2", fullExact: true, rational: { n: "2469135", d: "2" } }),
  row({ view: "cas", latex: "2a", text: "2469135", value: num("2469135"), facts: { exact: true, reliableDigits: null }, rational: { n: "2469135", d: "1" }, uses: [{ name: "a", preview: "1234567.5", view: "cas" }] }),
  row({ latex: "1/0", status: "error", text: "Division by zero" }),
  row({ latex: "7", status: "cancelled" }),
  row({ status: "note", text: "a note" }),
];

const NOW = new Date(2026, 10, 14, 9, 5);
const head = { version: "0.1.0", now: NOW, view: "home" as const };

function session(comma = false): Session {
  const s = new Session(new FakeCalc(), fakeKv());
  if (comma) s.setDecimalMark("comma");
  return s;
}

const header = (mark: string): string[] => [
  "N62 0.1.0 · preview: the form of this file can change",
  "",
  "# Work report, 2026-11-14 09:05",
  "",
  "- View: Home",
  "- Angle: Radians",
  "- Digits: 12",
  "- Number format: Standard",
  `- Decimal mark: ${mark}`,
  "",
  reportAbout(),
];

describe("R130: the work report", () => {
  it("writes a header and one block per step, line by line (decimal point)", () => {
    const text = workReport(HISTORY, session(), head);
    expect(text.split("\n")).toEqual([
      ...header("point"),
      "",
      "## Step 1",
      "",
      "- Input: `2+3`",
      "- Mark: = exact",
      "- Value: `5`",
      "",
      "## Step 2",
      "",
      "- Input: `1/3`",
      "- Mark: ≈ rounded: the exact value is 1/3",
      "- Value: `0.333333333333`",
      "",
      "## Step 3",
      "",
      "- Input: `sin(10^22)`",
      "- Mark: ⚠ 5 of 12 digits confirmed · decided at limited precision",
      "- Value: `-0.8522`", // the 5 confirmed digits, Standard drops the trailing zero
      "",
      "## Step 4",
      "",
      "- Input: `2×π×(25±0.1) mm → m`", // the request as written, not its LaTeX
      "- Mark: ≈ rounded",
      "- Value: `0.157079632679 ± 0.00063 m`",
      "- Uncertainty: ± 0.00063 m, standard uncertainty (σ)",
      "",
      "## Step 5",
      "",
      "- Input: `a:=1234567.5`",
      "- Mark: = exact", // 2469135/2 is 1234567.5 exactly
      "- Value: `1234567.5`",
      "",
      "## Step 6",
      "",
      "- Input: `2a`",
      "- Mark: = exact",
      "- Value: `2469135`",
      "- Uses: `a = 1234567.5` (stored in CAS)",
      "",
      "## Step 7",
      "",
      "- Input: `1/0`",
      "- Error: Division by zero",
      "",
    ]);
  });

  it("writes every number in the user's decimal mark, never with digit groups, and never `k = 1`", () => {
    const text = workReport(HISTORY, session(true), head);
    expect(text).toContain("- Decimal mark: comma");
    expect(text).toContain("- Value: `0,333333333333`");
    expect(text).toContain("- Value: `0,157079632679 ± 0,00063 m`");
    expect(text).toContain("- Uncertainty: ± 0,00063 m, standard uncertainty (σ)");
    expect(text).toContain("- Value: `1234567,5`");
    expect(text).toContain("- Input: `2×π×(25±0.1) mm → m`");
    expect(text).toContain("- Uses: `a = 1234567,5` (stored in CAS)"); // the stored value's preview is Giac's text, with a point
    expect(text).not.toMatch(/\d[  ' ]\d{3}/); // no group separator between digits
    expect(text).not.toMatch(/k\s*=\s*1/);
    expect(workReport(HISTORY, session(), head)).not.toMatch(/k\s*=\s*1/);
  });

  it("names σ of a constant's uncertainty (R40) as the standard uncertainty", () => {
    const g = row({ latex: "G", text: "6.6743E-11", value: num("6.6743e-11"), facts: { exact: false, reliableDigits: null, inexact: true, uncDigits: 4, uncSigma: "0.15e-14" } });
    const text = workReport([g], session(), head);
    expect(text).toMatch(/- Value: `6\.6743E-11`\n- Uncertainty: ± 1\.5E-15, standard uncertainty \(σ\)\n/); // σ only on its own line, its exponent written as the value's
  });

  it("writes a unit row's request as the history draws it, R100's comma rule included", () => {
    const max = unitStep("\\max\\left(2.5,3\\right)", "\\max\\left(2.5,3\\right)\\,\\mathrm{mm}\\to\\,\\mathrm{m}");
    expect(workReport([max], session(), head)).toContain("- Input: `max(2.5,3) mm → m`\n");
    expect(workReport([max], session(true), head)).toContain("- Input: `max(2.5;3) mm → m`\n");
  });

  it("is empty when no row is a step", () => {
    expect(workReport([row({ status: "note", text: "x" })], session(), head)).toBe("");
  });

  it("saves `n62-work-<date>.md` through the save port, and says so", async () => {
    const saved: [string, string, string][] = [];
    const notice = await saveWork(HISTORY, session(), head, async (n, m, x) => (saved.push([n, m, x]), "saved"));
    expect(reportName(NOW)).toBe("n62-work-2026-11-14.md");
    expect(saved.map(([n, m]) => [n, m])).toEqual([["n62-work-2026-11-14.md", "text/markdown"]]);
    expect(saved[0]?.[2]).toBe(workReport(HISTORY, session(), head));
    expect(notice).toBe("Work report saved");
    expect(await saveWork([], session(), head, async () => "saved")).toBe("Nothing to export");
    expect(await saveWork(HISTORY, session(), head, async () => "cancelled")).toBe("Work report not saved");
  });

  it("holds its format paragraph, word for word, in the format for your AI (R59)", () => {
    expect(aiFormat()).toContain(reportAbout());
  });
});
