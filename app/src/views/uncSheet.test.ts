// SPDX-License-Identifier: GPL-3.0-or-later
// R327: the uncertainty sheet's head (mockup docs/archive/mockups/uncertainty-sheet.html sections 3 and 4), a pure function of
// the row: the result with its mark, the short form, σ, U and relative σ, and the ⚠ line. A unit row reads G273's
// fields (U from the unrounded σ), a Home row its σ facts as the σ line does (state/sigmaLine.ts).
// Expected values derived: t10 = 12.34 × 3.2 = 39.488 m², σ² = 1.548381 (G41), σ = 1.24434…, U = 2σ = 2.48868… → 2.5
// (2 × the shown 1.2 would give 2.4), σ/|y| = 1.24434 / 39.488 = 3.151 % → 3.2 %; (0 ± 0.1)² and frac(2.95 ± 0.05) as
// the mockup's states firstOrderZero and jump. Home: σ 5.66ᴇ-13 on 2.51441113081ᴇ-8: U = 1.132ᴇ-12 → 1.1ᴇ-12,
// 5.66ᴇ-13 / 2.51441113081ᴇ-8 = 0.002251 % → 0.0023 %, the value to σ's last place (1ᴇ-14) 2.514411(57)ᴇ-8.
import { describe, expect, it } from "vitest";
import { decimalFromString, type DecimalValue } from "../engine/format.ts";
import type { HistoryItem } from "../state/session.svelte.ts";
import type { UnitRow } from "../units/types.ts";
import { hasSigma, uncHead, type HeadCtx } from "./uncSheet.ts";

const dec = (s: string): DecimalValue => decimalFromString(s) as DecimalValue;
const ZERO = dec("0");
const row = (value: string, x: Partial<HistoryItem>): HistoryItem => ({
  id: 1,
  view: "home",
  latex: "",
  status: "done",
  resultLatex: value,
  text: value,
  approximate: true,
  value: { re: dec(value), im: ZERO },
  facts: { exact: false, reliableDigits: null, inexact: true },
  startedAt: 0,
  ...x,
});
const unitRow = (value: string, unc: UnitRow["unc"], unit = "m²"): HistoryItem =>
  row(value, { units: { slots: {}, unit, dim: "m2", dimText: null, unc, latex: "", text: "", input: "" } });
const ctx = (shown: string, x: Partial<HeadCtx> = {}): HeadCtx => ({ mark: "≈", shown, mode: "std", comma: false, digits: 12, ...x });
const value = (h: ReturnType<typeof uncHead>, id: string): string | undefined => h?.rows.find((r) => r.id === id)?.value;

const T10 = unitRow("39.488", { text: "1.2", shown: "39.5 ± 1.2", expanded: "2.5", relative: "3.2", short: "39.5(12)" });

describe("R327: the uncertainty sheet's head", () => {
  it("t10's unit row: the result with ≈, 39.5(12) m², σ 1.2 m², U = 2σ = 2.5 m² (G273's, not 2 × 1.2), relative σ 3.2 %", () => {
    const h = uncHead(T10, ctx("39.488"));
    expect(h?.title).toBe("Uncertainty");
    expect(h?.of).toBe("≈ 39.488 m²");
    expect(h?.mark).toBe("≈");
    expect(h?.short).toBe("39.5(12) m²");
    expect(h?.rows).toEqual([
      { id: "sigma", label: "standard uncertainty (σ)", value: "1.2 m²" },
      { id: "expanded", label: "expanded", value: "U = 2σ = 2.5 m² (k = 2)" },
      { id: "relative", label: "relative σ", value: "3.2 %" },
    ]);
    expect(h?.warn).toBeNull();
    expect(hasSigma(T10)).toBe(true);
  });

  it("a value of 0: relative σ says none: the value is 0; first order fails: the ⚠ line", () => {
    const h = uncHead(unitRow("0", { text: "0.014", shown: "0.000 ± 0.014", expanded: "0.028", short: "0.000(14)", why: "order2" }, ""), ctx("0"));
    expect(h?.of).toBe("≈ 0");
    expect(h?.short).toBe("0.000(14)");
    expect(value(h, "relative")).toBe("none: the value is 0");
    expect(value(h, "expanded")).toBe("U = 2σ = 0.028 (k = 2)");
    expect(h?.warn).toBe("⚠ first order does not hold here");
  });

  it("a row whose σ reaches a jump: the ⚠ line says so", () => {
    const h = uncHead(unitRow("0.95", { text: "0.050", shown: "0.950 ± 0.050", expanded: "0.10", relative: "5.3", short: "0.950(50)", why: "jump" }, ""), ctx("0.95", { mark: "⚠" }));
    expect(h?.short).toBe("0.950(50)");
    expect(value(h, "relative")).toBe("5.3 %");
    expect(h?.warn).toBe("⚠ the interval reaches a jump");
  });

  it("an absolute temperature (no relative σ, the value not 0): no relative line", () => {
    const h = uncHead(unitRow("293.15", { text: "0.50", shown: "293.15 ± 0.50", expanded: "1.0", short: "293.15(50)" }, "K"), ctx("293.15"));
    expect(h?.rows.map((r) => r.id)).toEqual(["sigma", "expanded"]);
  });

  it("the decimal comma and an exponent: written as the row writes them (ᴇ)", () => {
    const h = uncHead(unitRow("0.0000000000667430", { text: "1.5E-15", shown: "", expanded: "3.0E-15", relative: "0.0022", short: "6.67430(15)E-11" }, ""), ctx("6.6743ᴇ-11", { comma: true }));
    expect(h?.short).toBe("6,67430(15)ᴇ-11");
    expect(value(h, "sigma")).toBe("1,5ᴇ-15");
    expect(value(h, "relative")).toBe("0,0022 %");
  });

  it("a Home row with σ facts: σ and U as the σ line writes them, relative σ and the short form from the value", () => {
    const item = row("2.51441113081e-8", { facts: { exact: false, reliableDigits: null, inexact: true, uncDigits: 6, uncSigma: "5.66e-13" } });
    expect(hasSigma(item)).toBe(true);
    const h = uncHead(item, ctx("2.51441113081ᴇ-8"));
    expect(h?.of).toBe("≈ 2.51441113081ᴇ-8");
    expect(h?.short).toBe("2.514411(57)ᴇ-8");
    expect(h?.rows).toEqual([
      { id: "sigma", label: "standard uncertainty (σ)", value: "5.7ᴇ-13" },
      { id: "expanded", label: "expanded", value: "U = 2σ = 1.1ᴇ-12 (k = 2)" },
      { id: "relative", label: "relative σ", value: "0.0023 %" },
    ]);
  });

  it("R327f1: a short form with more digits than the value has confirmed gets ⚠ before it, whatever mark the row had", () => {
    // 10.123456 ± a σ chip of 0.0707 with 1 confirmed digit (units/sigmaMark.test.ts): 4 digits confirmed, 10.123(71)
    // shows 5 (to σ's 10^-3); the head is ⚠ whatever the digits setting gave the row (phase-1 kept its ≈ at STD 3 and 4)
    const facts = { exact: false, reliableDigits: 4, inexact: true as const };
    const unit = row("10.123456", { facts, units: { slots: {}, unit: "m", dim: "m1", dimText: null, unc: { text: "0.071", shown: "10.123 ± 0.071", short: "10.123(71)", chip: { reliableDigits: 1 } }, latex: "", text: "", input: "" } });
    for (const mark of ["≈", "⚠"]) {
      const h = uncHead(unit, ctx("10.1", { mark, digits: 3 }));
      expect([h?.mark, h?.short, h?.of]).toEqual(["⚠", "10.123(71) m", "⚠ 10.1 m"]);
    }
    // a Home row with σ facts: its short form from the value and σ, the same count
    const home = row("10.123456", { facts: { ...facts, uncSigma: "0.0707", uncDigits: 5 } });
    const h = uncHead(home, ctx("10.12", { mark: "≈" }));
    expect([h?.mark, h?.short]).toEqual(["⚠", "10.123(71)"]);
    // ≈ stays where every digit is confirmed: 1000.500(71), 7 digits, 8 confirmed
    const ok = row("1000.5", { facts: { ...facts, reliableDigits: 8 }, units: { slots: {}, unit: "m", dim: "m1", dimText: null, unc: { text: "0.071", shown: "1000.500 ± 0.071", short: "1000.500(71)" }, latex: "", text: "", input: "" } });
    expect(uncHead(ok, ctx("1000.5", { digits: 8 }))?.mark).toBe("≈");
  });

  it("no σ: no head (the key is a dead press); a σ without its digits is not the σ line's either", () => {
    const plain = row("314.159265359", {});
    expect(hasSigma(plain)).toBe(false);
    expect(uncHead(plain, ctx("314.159265359"))).toBeNull();
    const half = row("1", { facts: { exact: false, reliableDigits: null, uncSigma: "0.1" } });
    expect(hasSigma(half)).toBe(false);
    expect(hasSigma({ ...T10, status: "error" })).toBe(false);
  });
});
