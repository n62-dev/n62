// SPDX-License-Identifier: GPL-3.0-or-later
// R152 (F189): MathLive's `macros` option replaces its table, so the history renderer must hand it the defaults WITH
// the entry's macros. Node has no field to read the defaults from (the SSR build; renderOptions reads them from a
// mounted field in the browser: test/history-e.spec.ts draws a real row), so the defaults here are the two the bug
// showed, and the merge is checked through MathLive's real renderer.
import { convertLatexToMarkup, validateLatex } from "mathlive/ssr";
import type * as MathLive from "mathlive";
import { describe, expect, it } from "vitest";
import { CHIP_MACROS, ENTRY_MACROS } from "../entry/macroTable.ts";
import { constChip, resChip } from "../entry/macros.ts";
import { keyboard } from "../keyboard/keyboard.ts";
import { renderOptions, withEntryMacros } from "./macros.ts";

const DEFAULTS = {
  exponentialE: "\\mathrm{e}",
  imaginaryI: "\\mathrm{i}",
} as unknown as Parameters<typeof withEntryMacros>[0];
const merged = { macros: withEntryMacros(DEFAULTS) };
const text = (m: string): string => m.replace(/<[^>]*>/g, "");

describe("the history renderer's macro table (R152)", () => {
  it("the entry's macros alone leave \\exponentialE raw (the bug)", () => {
    const m = convertLatexToMarkup("\\exponentialE^{\\imaginaryI\\pi}", { macros: ENTRY_MACROS });
    expect(m).toContain("exponentialE");
    expect(validateLatex("\\exponentialE", { macros: ENTRY_MACROS })).not.toEqual([]);
  });
  it.each(["\\exponentialE^{\\imaginaryI\\pi}", "\\imaginaryI^{\\imaginaryI}", "2\\exponentialE"])("%s draws e and i upright, no raw name, no error", (latex) => {
    const m = convertLatexToMarkup(latex, merged);
    expect(m).not.toContain("exponentialE");
    expect(m).not.toContain("imaginaryI");
    expect(m).not.toContain("ML__error");
    expect(validateLatex(latex, merged)).toEqual([]);
    expect(m).toBe(convertLatexToMarkup(latex)); // as MathLive draws it with its own table
  });
  it("the chips and the exponent mark still draw", () => {
    const res = convertLatexToMarkup(resChip(1, "0.333"), merged);
    expect(res).toContain("var(--chip-tint)");
    expect(text(res)).toContain("0.333");
    expect(text(convertLatexToMarkup("\\ans", merged))).toContain("Ans");
    expect(convertLatexToMarkup(constChip("c", "c"), merged)).toContain("var(--chip-tint)");
    expect(text(convertLatexToMarkup("1.5\\emark-3", merged))).toMatch(/^1\.5ᴇ[−-]3$/);
    for (const k of Object.keys(CHIP_MACROS)) expect(merged.macros).toHaveProperty(k);
  });
  it("the entry's macros come last: they win over a default of the same name", () => {
    const t = withEntryMacros({ ...DEFAULTS, emark: { def: "X", args: 0 } } as unknown as Parameters<typeof withEntryMacros>[0]);
    expect(t["emark"]).toBe(ENTRY_MACROS.emark);
  });
  it("where there is no field (the SSR build) the options are the entry's macros", () => {
    expect(renderOptions({} as typeof MathLive).macros).toBe(ENTRY_MACROS);
  });
});

// R791 (owner's P2, 2026-11-20): MathLive has no \AA, so the Å cell of Shift + 9 and Chars, and the entry line after it,
// drew the raw `\AA` in MathLive's error style (red underline). Every palette cell's insert draws with the entry's macros.
describe("every palette cell draws (R791)", () => {
  const cells = (["palette", "relations", "symbols", "chars"] as const).flatMap((p) => keyboard[p].items.map((i) => [`${p}:${i.id}`, i.action.latex] as const));
  it("the four palettes hold 100 cells (Tmpl 18, Shift + 6 11, Shift + 9 25, Chars 46)", () => expect(cells).toHaveLength(100));
  it.each(cells)("%s: %s has no ML__error", (_id, latex) => {
    expect(convertLatexToMarkup(latex, { macros: ENTRY_MACROS })).not.toContain("ML__error");
  });
  it("\\AA draws an upright Å, and the field's value stays \\AA (the parser refuses it as a unit)", () => {
    expect(text(convertLatexToMarkup("5\\AA", { macros: ENTRY_MACROS }))).toBe("5\u00C5");
    expect(ENTRY_MACROS.AA.expand).toBe(false);
  });
});
