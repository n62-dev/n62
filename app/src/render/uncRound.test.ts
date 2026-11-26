// SPDX-License-Identifier: GPL-3.0-or-later
// R884: Settings › Numbers › Uncertainty "Rounded to σ, σ on tap" draws a value with σ rounded to σ's last digit, σ at 2
// significant digits, by the unit view headline's own rounding (render/sigmaForm.ts sigmaDrawn, atSigma). A Home row as
// the screen's row draws it (state/displayMode.ts renderNumeric, grouped, with the tidy chunk's sigmaRow and muter, DisplayContext.round):
// a constant's row (σ in its facts) shows the value alone, a unit row (σ in units.unc) the value and σ. Expected values:
// derived from that rule (σ to 2 significant digits, the value to σ's last place, zeros kept; SCI keeps σ in the value's
// exponent, as the headline does: 6.67430E-11 ± 0.00015E-11).
import { describe, expect, it } from "vitest";
import { decimalFromString, type ComplexValue } from "../engine/format.ts";
import { renderNumeric, type DisplayContext, type NumericResult } from "../state/displayMode.ts";
import { sigmaRow } from "./sigmaForm.ts";
import { muter } from "./uncMute.ts";

const real = (s: string): ComplexValue => {
  const d = decimalFromString(s);
  if (!d) throw new Error(s);
  return { re: d, im: { neg: false, digits: "", exp: 0, sticky: false } };
};
/** A row of `v` whose σ is `s`: a constant's (facts only) or a unit row's (units.unc too). */
const row = (v: string, s: string, unit = false): NumericResult => ({
  value: real(v),
  facts: { exact: false, reliableDigits: null, uncDigits: 2, uncSigma: s },
  ...(unit ? { units: { unc: { shown: `${v} ± ${s}`, text: s } } } : {}),
});
const ctx = (round: boolean, format: DisplayContext["format"] = "std"): DisplayContext => ({
  format,
  digits: 12,
  fixDecimals: 4,
  angle: "rad",
  mute: muter,
  sigma: sigmaRow,
  ...(round ? { round: true } : {}),
});

describe("Rounded to σ (R884): value and σ", () => {
  it.each([
    ["9.81065219207", "0.0526983", "std", "9.811", "0.053"],
    ["2.5", "0.1", "std", "2.50", "0.10"], // the trailing zero kept, as the headline keeps it
    ["6.67430e-11", "1.5e-15", "std", "6.67430E-11", "0.00015E-11"], // STD switches to E form; σ in its exponent
    ["6.67430e-11", "1.5e-15", "sci", "6.67430E-11", "0.00015E-11"],
    ["0.3", "1.2", "std", "0.3", "1.2"], // a σ larger than the value
    ["1234.5678", "25", "std", "1235", "25"],
  ] as const)("(%s, %s) in %s → %s ± %s", (v, s, f, value, sigma) => {
    const unitRow = renderNumeric(row(v, s, true), undefined, ctx(true, f), true);
    expect(unitRow?.text).toBe(value);
    expect(unitRow?.sigma?.text).toBe(sigma);
    // a constant's row (no unit): the value alone, rounded the same way (Copy as shown takes the row's text)
    expect(renderNumeric(row(v, s), undefined, ctx(true, f), true)?.text).toBe(value);
    // ungrouped (a chip's face, Share session): every digit, as with the default
    expect(renderNumeric(row(v, s), undefined, ctx(true, f))?.text).toBe(renderNumeric(row(v, s), undefined, ctx(false, f))?.text);
  });

  it("no muted digits: the value ends at σ's last digit", () => {
    expect(renderNumeric(row("9.81065219207", "0.0526983"), undefined, ctx(true), true)?.latex).not.toContain("unc");
    expect(renderNumeric(row("9.81065219207", "0.0526983"), undefined, ctx(false), true)?.latex).toContain("\\class{unc}");
  });

  it("σ 0 → the value as the digits setting draws it", () => {
    expect(renderNumeric(row("9.81065219207", "0"), undefined, ctx(true), true)?.text).toBe("9.81065219207");
  });

  it("controls: the default draws every digit; a row with no σ is drawn as before", () => {
    expect(renderNumeric(row("9.81065219207", "0.0526983"), undefined, ctx(false), true)?.text).toBe("9.81065219207");
    expect(renderNumeric(row("9.81065219207", "0.0526983", true), undefined, ctx(false), true)?.text).toBe("9.81065219207");
    expect(renderNumeric({ value: real("9.81065219207") }, undefined, ctx(true), true)?.text).toBe("9.81065219207");
  });
});
