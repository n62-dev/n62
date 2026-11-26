// SPDX-License-Identifier: GPL-3.0-or-later
// R885: a value with σ drawn by one rule (render/sigmaForm.ts, docs/04 2.6). Expected values: derived from the rule
// (σ at 2 significant digits, the value to at least σ's last digit, σ in the value's form) on the owner-style hunt's
// inputs of 2026-11-23 (h3 #4, #5, #12, #13) and bug list 4's G·5.972ᴇ24 kg (6.67430ᴇ-11 · 5.972ᴇ24 = 3.98589196ᴇ14,
// σ = 1.5ᴇ-15 · 5.972ᴇ24 = 8.958ᴇ9).
import { describe, expect, it } from "vitest";
import { decimalFromString, toText, type FormatOptions } from "../engine/format.ts";
import { sigmaAlone, sigmaDrawn } from "./sigmaForm.ts";

const dec = (s: string) => {
  const d = decimalFromString(s);
  if (!d) throw new Error(s);
  return d;
};
/** "value ± σ" as the row's text writes it. */
const row = (v: string, s: string, o: FormatOptions): string | null => {
  const r = sigmaDrawn(dec(v), dec(s), o);
  return r && `${toText(r.value)} ± ${toText(r.sigma)}`;
};
const STD = (digits = 12): FormatOptions => ({ format: "STD", digits });
const ts = " "; // PFX's thin space before the prefix

describe("sigmaDrawn: never cut above σ (R885, h3 #4)", () => {
  it.each([
    ["1234567890.12345", "0.0001", STD(), "1234567890.12345 ± 0.00010"],
    ["12345.678", "0.001", STD(4), "12345.6780 ± 0.0010"],
    ["2.5", "0.1", STD(1), "2.50 ± 0.10"],
    // the digits setting may draw more: R883 mutes them (render/uncMute.ts)
    ["9.81065219207", "0.0526983", STD(), "9.81065219207 ± 0.053"],
    ["39.488", "1.2443396", STD(), "39.488 ± 1.2"],
    // a σ larger than the value; σ above the units digit
    ["0.3", "1.2", STD(), "0.3 ± 1.2"],
    ["395000", "12345", STD(), "395000 ± 12000"],
    // STD's own switch to its E form (format.ts std): 12300 needs 5 places, 3 digits are drawn
    ["12345", "1234", STD(2), "1.23E4 ± 0.12E4"],
    // a value of 0, a negative value, a carry at σ's place
    ["0", "0.1", STD(), "0.00 ± 0.10"],
    ["-2.5", "0.1", STD(1), "-2.50 ± 0.10"],
    ["9.996", "0.01", STD(2), "9.996 ± 0.010"],
    ["9.9996", "0.01", STD(2), "10.000 ± 0.010"],
  ])("%s ± %s at %o → %s", (v, s, o, want) => {
    expect(row(v, s, o)).toBe(want);
  });
});

describe("sigmaDrawn: value and σ in the same form (R885, h3 #5, #12, bug list 4)", () => {
  it.each([
    // PFX: σ in the value's prefix
    ["4700", "100", { format: "PFX", digits: 12 }, `4.70${ts}k ± 0.10${ts}k`],
    ["9.81e-6", "5e-8", { format: "PFX", digits: 12 }, `9.810${ts}µ ± 0.050${ts}µ`],
    ["9.81", "0.05", { format: "PFX", digits: 12 }, "9.810 ± 0.050"],
    // SCI and ENG: no zeros padded past σ's place; σ in the value's exponent (E0 not written on σ)
    ["9.81", "0.05", { format: "SCI", digits: 12 }, "9.810E0 ± 0.050"],
    ["9.81065219207", "0.0526983", { format: "SCI", digits: 12 }, "9.81065219207E0 ± 0.053"],
    ["9.81e-6", "5e-8", { format: "SCI", digits: 12 }, "9.810E-6 ± 0.050E-6"],
    ["12345.678", "0.001", { format: "ENG", digits: 12 }, "12.3456780E3 ± 0.0000010E3"],
    ["9.81", "0.05", { format: "ENG", digits: 3 }, "9.810E0 ± 0.050"],
    // STD in its E form: σ in the value's exponent (G·5.972ᴇ24 kg)
    ["398589196000000", "8958000000", STD(), "3.98589196E14 ± 0.000090E14"],
    ["398589196000000", "8958000000", STD(7), "3.985892E14 ± 0.000090E14"],
    ["9.81e-6", "5e-8", STD(), "9.810E-6 ± 0.050E-6"],
    // FIX keeps its decimals while they reach σ's place, and goes past them when they do not
    ["9.81", "0.05", { format: "FIX", digits: 12, fixed: 4 }, "9.8100 ± 0.050"],
    ["9.81", "0.0005", { format: "FIX", digits: 12, fixed: 2 }, "9.81000 ± 0.00050"],
  ] as [string, string, FormatOptions, string][])("%s ± %s at %o → %s", (v, s, o, want) => {
    expect(row(v, s, o)).toBe(want);
  });

  it("a σ of 0 is left to the caller", () => {
    expect(sigmaDrawn(dec("9.81"), dec("0"), STD())).toBeNull();
    expect(sigmaAlone(dec("0"), STD())).toBeNull();
  });
});

describe("sigmaAlone: the unit view's second line (R885, h3 #12)", () => {
  it.each([
    ["0.05", "STD", "0.050"],
    ["0.05", "SCI", "5.0E-2"],
    ["0.05", "ENG", "50E-3"],
    ["0.05", "PFX", `50${ts}m`],
    ["0.0996", "SCI", "1.0E-1"],
    ["8958000000", "STD", "9000000000"],
    ["8958000000", "SCI", "9.0E9"],
    ["1234", "STD", "1200"],
  ] as [string, FormatOptions["format"], string][])("σ %s in %s → %s", (s, format, want) => {
    const f = sigmaAlone(dec(s), { format, digits: 12 });
    expect(f && toText(f)).toBe(want);
  });
});
