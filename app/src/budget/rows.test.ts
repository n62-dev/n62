// SPDX-License-Identifier: GPL-3.0-or-later
// R328: the uncertainty sheet's rows (docs/archive/mockups/uncertainty-sheet.html sections 2 to 4, variant A), a pure function of
// the history row and G272's model. Sources: the terms of t10 are G271's (units/evaluate.test.ts g01) and the shares of
// rows a and b G272's oracle rows (tests/golden/oracle_budget.py, via budget/model.test.ts); the rest derived by hand:
// a chip of σ 1.2 times (2.000 ± 0.005): t = (2·1.2)² = 5.76, (39.488·0.005)² = 0.0389825536, second 1.2²·0.005² =
// 0.000036, so 99.3 %, 0.7 %, < 0.1 %; three equal terms 33.3 % each (G272 row m); one term alone 100.0 %.
import { describe, expect, it } from "vitest";
import type { HistoryItem } from "../state/session.svelte.ts";
import type { UnitRow } from "../units/types.ts";
import { decimalFromString, type DecimalValue } from "../engine/format.ts";
import { latexToGiacInfo } from "../input/latex-to-giac.ts";
import { slotFormula } from "../input/unitFormula.ts";
import { typedInputs, uncRows } from "./rows.ts";

const dec = (s: string): DecimalValue => decimalFromString(s) as DecimalValue;
const row = (x: Partial<HistoryItem>): HistoryItem => ({
  id: 1,
  view: "home",
  latex: "",
  status: "done",
  resultLatex: "1",
  text: "1",
  approximate: true,
  value: { re: dec("1"), im: dec("0") },
  facts: { exact: false, reliableDigits: null, inexact: true },
  startedAt: 0,
  ...x,
});
const unitRow = (line: string, input: string, unit: string, unc: Partial<NonNullable<UnitRow["unc"]>>, x: Partial<HistoryItem> = {}): HistoryItem =>
  row({ latex: line, units: { slots: {}, unit, dim: null, dimText: null, unc: { text: "1", shown: "1 ± 1", ...unc }, latex: "", text: "", input }, ...x });
const shown = (t: ReturnType<typeof uncRows>) => t?.rows.map((r) => [r.label, r.uy, r.share]);

const T10 = unitRow("12.34\\pm0.05\\times3.2\\pm0.1", "12.34\\pm0.05\\,\\mathrm{m}\\times3.2\\pm0.1\\,\\mathrm{m}", "m²", {
  terms: [{ t: "0.0256", uy: "0.16" }, { t: "1.522756", uy: "1.234" }],
  second: "0.000025",
});
const OVER100 = unitRow("\\sin\\left(0\\pm0.2\\right)", "\\sin\\left(0\\pm0.2\\right)", "", { terms: [{ t: "0.04", uy: "0.2" }], second: "-0.0016" });

describe("R328: the uncertainty sheet's rows (variant A)", () => {
  it("t10: 3.2 ± 0.1 m 1.2 m² 98.3 %, 12.34 ± 0.05 m 0.16 m² 1.7 %, then second order < 0.1 %; no line under them", () => {
    const t = uncRows(T10, false);
    expect(shown(t)).toEqual([
      ["3.2 ± 0.1 m", "1.2 m²", "98.3 %"],
      ["12.34 ± 0.05 m", "0.16 m²", "1.7 %"],
      ["second order", "", "< 0.1 %"],
    ]);
    expect(t?.rows.map((r) => r.second ?? false)).toEqual([false, false, true]);
    expect(t?.rows.map((r) => r.bar)).toEqual([{ width: 98.3 }, { width: 1.7 }, { width: 0 }]);
    expect(t?.rows.some((r) => r.note)).toBe(false);
    expect(t?.lines).toEqual([]);
    expect(t?.columns).toEqual(["Input", "uᵢ", "% of σ²"]);
  });

  it("sin(0 ± 0.2): 104.2 % with its bar ending in the stripe, second order −4.2 %, and the over-100 line", () => {
    const t = uncRows(OVER100, false);
    expect(shown(t)).toEqual([
      ["0 ± 0.2", "0.20", "104.2 %"],
      ["second order", "", "−4.2 %"],
    ]);
    expect(t?.rows.map((r) => r.bar)).toEqual([{ width: 100, over: true }, { width: 4.2, neg: true }]);
    expect(t?.lines).toEqual(["A row can exceed 100 % when the second-order term is negative: it takes σ² below the first-order rows."]);
  });

  it("frac(2.95 ± 0.05), a jump: no rows, the one line saying why", () => {
    const t = uncRows(unitRow("\\operatorname{frac}\\left(2.95\\pm0.05\\right)", "", "", { terms: [{ t: "0.0025", uy: "0.05" }], second: "0", why: "jump" }), false);
    expect(t?.rows).toEqual([]);
    expect(t?.lines).toEqual(["No shares: an input's ± 2σ reaches a jump, where a derivative says nothing about the spread."]);
  });

  it("(0 ± 0.1)², first order 0: no rows, the one line saying why", () => {
    const t = uncRows(unitRow("\\left(0\\pm0.1\\right)^{2}", "", "", { terms: [{ t: "0", uy: "0" }], second: "0.0002", why: "order2" }), false);
    expect(t?.rows).toEqual([]);
    expect(t?.lines).toEqual(["No shares: the first-order part is 0, so all of σ² is the second-order term (shares would read 0 % and 100 %)."]);
  });

  it("a result chip's row (pasr_): its text, 'result chip' under it, and the warn note; the typed input after it", () => {
    // the key's number is its run's (decisions.md pass 199): the label is the line's chip with σ by order, never by it
    const line = "\\res{1}{39.488}\\times\\left(2.000\\pm0.005\\right)";
    const chips = { "res:1": { value: "39.488", unc: "1.2", exact: false, inexact: true as const } };
    const t = uncRows(unitRow(line, `${line}\\,\\mathrm{m}`, "m³", {
      terms: [{ key: "pasr_7", t: "5.76", uy: "2.4" }, { t: "0.0389825536", uy: "0.19744" }],
      second: "0.000036",
    }, { chips }), false);
    expect(shown(t)).toEqual([
      ["39.488", "2.4 m³", "99.3 %"],
      ["2.000 ± 0.005 m", "0.20 m³", "0.7 %"],
      ["second order", "", "< 0.1 %"],
    ]);
    expect(t?.rows[0]?.sub).toBe("result chip");
    expect(t?.rows.map((r) => r.note)).toEqual(["treated as independent; σ and shares may be off if it shares an input with another term.", undefined, undefined]);
  });

  it("three equal rows: 33.3 % each, no second-order row (b = 0), and the rounded line", () => {
    const t = uncRows(unitRow("1\\pm0.1+2\\pm0.1+3\\pm0.1", "1\\pm0.1\\,\\mathrm{m}+2\\pm0.1\\,\\mathrm{m}+3\\pm0.1\\,\\mathrm{m}", "m", {
      terms: [{ t: "0.01", uy: "0.1" }, { t: "0.01", uy: "0.1" }, { t: "0.01", uy: "0.1" }],
      second: "0",
    }), false);
    expect(shown(t)).toEqual([
      ["1 ± 0.1 m", "0.10 m", "33.3 %"],
      ["2 ± 0.1 m", "0.10 m", "33.3 %"],
      ["3 ± 0.1 m", "0.10 m", "33.3 %"],
    ]);
    expect(t?.lines).toEqual(["rounded; not adjusted (the shares add to 99.9 %)"]);
  });

  it("Home (G274's uncTerms): a constant with no basis, first order only: one row with the note, no second-order row", () => {
    const t = uncRows(row({
      latex: "\\const{G}{G}\\times5.972\\emark24",
      chips: { "const:G": { value: "6.6743E-11", unc: "1.5E-15", exact: false, inexact: true } },
      facts: { exact: false, reliableDigits: null, inexact: true, uncSigma: "8.958E9", uncDigits: 2 },
      uncTerms: [{ key: "G", t: "8.0245764E19", uy: "8.958E9" }],
    }), false);
    expect(shown(t)).toEqual([["G", "9.0ᴇ9", "100.0 %"]]);
    expect(t?.rows[0]?.note).toBe("treated as independent; σ and shares may be off if it shares an input with another term.");
    expect(t?.lines).toEqual([]);
  });

  it("Home with one input alone (G274 keeps no terms for it): its one row at 100.0 %, σ as its uᵢ", () => {
    const t = uncRows(row({
      latex: "\\const{G}{G}\\times5.972\\emark24",
      chips: { "const:G": { value: "6.6743E-11", unc: "1.5E-15", basis: "x", exact: false, inexact: true } },
      facts: { exact: false, reliableDigits: null, inexact: true, uncSigma: "8.958E9", uncDigits: 2 },
    }), false);
    expect(shown(t)).toEqual([["G", "9.0ᴇ9", "100.0 %"]]);
    expect(t?.rows[0]?.note).toBeUndefined(); // (a constant with a basis)
  });

  // fix round 2: √(μ₀/ε₀) = Z₀ ∝ α, two chips with σ on one uncertain leaf: G274 keeps no terms (constCorr.test.ts), so
  // the one row is the leaf at 100.0 %. σ derived: Z₀ = 376.730313412 Ω, σ/Z₀ = σα/α = 1.1E-12 / 7.2973525643E-3.
  const leaves = (own: string) => ({ fine_structure: { value: "7.2973525643E-3", unc: "1.1E-12" }, [own]: { value: "1", unc: "0" } });
  const muEps = (eps: Record<string, { value: string; unc: string }>) => row({
    latex: "\\sqrt{\\frac{\\const{mu_0}{μ₀}}{\\const{epsilon_0}{ε₀}}}",
    chips: {
      "const:mu_0": { value: "1.25663706127E-6", unc: "2.0E-16", basis: "2*pasl_fine_structure*pasl_h", basisLeaves: leaves("h"), exact: false, inexact: true },
      "const:epsilon_0": { value: "8.8541878188E-12", unc: "1.4E-21", basis: "1/pasl_fine_structure*pasl_e", basisLeaves: eps, exact: false, inexact: true },
    },
    facts: { exact: false, reliableDigits: null, inexact: true, uncSigma: "5.7E-8", uncDigits: 2 },
  });
  it("Home, √(μ₀/ε₀): two chips with σ on one uncertain leaf (α) give its one row at 100.0 %, never an empty table", () => {
    const t = uncRows(muEps(leaves("e")), false);
    expect(shown(t)).toEqual([["fine structure", "5.7ᴇ-8", "100.0 %"]]);
    expect(t?.rows[0]?.sub).toBe("via μ₀, ε₀");
    expect(t?.rows[0]?.note).toBeUndefined();
    // control: two uncertain leaves are two inputs, which G274 keeps as terms; without them there is no one row to show
    expect(uncRows(muEps({ fine_structure: { value: "7.2973525643E-3", unc: "1.1E-12" }, R: { value: "1", unc: "1E-9" } }), false)).toBeNull();
  });

  it("the decimal comma: 98,3 % and 12,34 ± 0,05 m", () => {
    const t = uncRows(unitRow("12{,}34\\pm0{,}05\\times3{,}2\\pm0{,}1", "12{,}34\\pm0{,}05\\,\\mathrm{m}\\times3{,}2\\pm0{,}1\\,\\mathrm{m}", "m²", {
      terms: [{ t: "0.0256", uy: "0.16" }, { t: "1.522756", uy: "1.234" }],
      second: "0.000025",
    }), true);
    expect(shown(t)?.[1]).toEqual(["12,34 ± 0,05 m", "0,16 m²", "1,7 %"]);
  });

  it("the typed ± inputs in order, outside the chips, with their units and without their brackets", () => {
    // the minus before 4 is binary (after a unit): Subtract(…, pasupm(4,1)), so the input is 4 ± 1 (the parser's reading)
    expect(typedInputs("\\res{2}{5\\pm1}\\times\\left(1.5\\emark-3\\pm1\\emark-4\\right)\\,\\mathrm{m}^{2}\\cdot\\mathrm{s}^{-1}-4\\pm1", false))
      .toEqual(["1.5ᴇ-3 ± 1ᴇ-4 m²·s⁻¹", "4 ± 1"]);
  });

  // fix round 2: the labels read a unary minus and `± n %` as the parser does (parse.ts negate, unitsAfter R104)
  it("a unary minus is inside the input (−20 ± 0.5 m); a double minus cancels; a binary one, or one before the bracket, is not", () => {
    expect(typedInputs("\\left(-20\\pm0.5\\right)\\,\\mathrm{m}\\times\\left(3\\pm0.1\\right)\\,\\mathrm{m}", false)).toEqual(["−20 ± 0.5 m", "3 ± 0.1 m"]);
    expect(typedInputs("-\\left(20\\pm0.5\\right)\\,\\mathrm{m}", false)).toEqual(["20 ± 0.5 m"]); // -(pasupm(20,0.5)·m)
    expect(typedInputs("2\\times-20\\pm0.5\\,\\mathrm{m}", false)).toEqual(["−20 ± 0.5 m"]);
    expect(typedInputs("--20\\pm0.5\\,\\mathrm{m}", false)).toEqual(["20 ± 0.5 m"]);
    expect(typedInputs("3\\,\\mathrm{m}-4\\pm1\\,\\mathrm{m}", false)).toEqual(["4 ± 1 m"]);
    expect(typedInputs("3\\,\\mathrm{m}--4\\pm1\\,\\mathrm{m}", false)).toEqual(["−4 ± 1 m"]);
  });

  it("± n % keeps its % (σ = |value|·n/100 is the parser's) and the unit after the bracket: 5 ± 2 % m", () => {
    expect(typedInputs("\\left(5\\pm2\\%\\right)\\,\\mathrm{m}\\times\\left(3\\pm0.1\\right)\\,\\mathrm{m}", false)).toEqual(["5 ± 2 % m", "3 ± 0.1 m"]);
    expect(typedInputs("5\\pm2{,}5\\%\\,\\mathrm{m}", true)).toEqual(["5 ± 2,5 % m"]);
  });

  it("a result chip as σ (R271): the value ± the chip's text, with the unit", () => {
    expect(typedInputs("5\\pm\\res{2}{0.1}\\,\\mathrm{m}\\times\\left(3\\pm0.1\\right)\\,\\mathrm{m}", false)).toEqual(["5 ± 0.1 m", "3 ± 0.1 m"]);
  });

  it("the labels match the parser's typed inputs (uncertainValues' vars without a key) in count, order and value", () => {
    const chips = { "res:2": { value: "0.1", exact: true }, "res:3": { value: "7", unc: "1", exact: false, inexact: true as const } };
    for (const line of [
      "\\left(-20\\pm0.5\\right)\\times\\left(3\\pm0.1\\right)",
      "-\\left(20\\pm0.5\\right)+2\\times-3\\pm0.1-4\\pm1--5\\pm2",
      "\\left(5\\pm2\\%\\right)\\times\\left(-3\\pm1\\%\\right)",
      "\\res{3}{7\\pm1}\\times5\\pm\\res{2}{0.1}-1.5\\emark-3\\pm1\\emark-4",
      "\\sin\\left(0\\pm0.2\\right)\\div\\left(--2\\pm0.1\\right)",
    ]) {
      const giac = latexToGiacInfo(slotFormula(line).latex, { units: true, chips }).giac;
      // a typed input: pasupm(value,σ) or pasupm(value,σ,pasws<j>); a chip's call has its key third (R115), not typed
      const typed = [...giac.matchAll(/pasupm\(([^,()]+|\([^()]*\)),([^,()]+|\([^()]*\))(?:,(\w+))?\)/g)]
        .filter((m) => m[3] === undefined || m[3].startsWith("pasws"))
        .map((m) => Number(m[1]!.replace(/[()]/g, "")));
      const labels = typedInputs(line, false).map((l) => Number(l.split(" ± ")[0]!.replace("−", "-").replace("ᴇ", "e")));
      expect(labels, line).toEqual(typed);
    }
  });

  it("controls: one input alone shows its single row at 100.0 %, never an empty table; no terms (a row before G273) no table", () => {
    const one = uncRows(unitRow("5\\pm0.2", "5\\pm0.2\\,\\mathrm{m}", "m", { terms: [{ t: "0.04", uy: "0.2" }], second: "0" }), false);
    expect(shown(one)).toEqual([["5 ± 0.2 m", "0.20 m", "100.0 %"]]);
    expect(one?.lines).toEqual([]);
    expect(uncRows(unitRow("5\\pm0.2", "", "m", {}), false)).toBeNull();
    // stored terms are read back unchecked: a bad shape is no table, never a throw
    expect(uncRows(row({ uncTerms: [{ key: "G", t: 5 }] as never }), false)).toBeNull();
  });
});
