// SPDX-License-Identifier: GPL-3.0-or-later
// The macro table of the entry line (docs/04 section 3.6; what each macro is: entry/macros.ts), for the MathLive field
// (entry/field.ts) and the static renderer (render/macros.ts). Its own module so that it loads with MathLive, not at
// start (R791 fix round 1: the start chunk is at its budget). Plain data: importing this does not load MathLive.

const CHIP_STYLE = "background:var(--chip-tint)";

/** MathLive's MacroDefinition, written out so this module needs no MathLive import. */
interface ChipMacro {
  def: string;
  args: number;
  captureSelection: true;
  expand: false;
}

export const CHIP_MACROS: Record<"res" | "ans" | "const" | "unit" | "pfx", ChipMacro> = {
  /** `\res{k}{shown}`: a history result; its value is the chip table's `res:k`. */
  res: { def: `\\htmlStyle{${CHIP_STYLE}}{#2}`, args: 2, captureSelection: true, expand: false },
  /** `\ans`: the view's last result, read when Enter is pressed. */
  ans: { def: `\\htmlStyle{${CHIP_STYLE}}{\\mathrm{Ans}}`, args: 0, captureSelection: true, expand: false },
  /** `\const{ID}{symbol}`: a constant from Find; its value is the chip table's `const:ID`. */
  const: { def: `\\htmlStyle{${CHIP_STYLE}}{\\mathrm{#2}}`, args: 2, captureSelection: true, expand: false },
  /** `\unit{ID}{symbol}`: a unit from Find (R4a); `symbol` is upright LaTeX already (`\mathrm{km/h}`). */
  unit: { def: `\\htmlStyle{${CHIP_STYLE}}{#2}`, args: 2, captureSelection: true, expand: false },
  /** `\pfx{ID}{symbol}`: an SI prefix from Find (R4a). */
  pfx: { def: `\\htmlStyle{${CHIP_STYLE}}{#2}`, args: 2, captureSelection: true, expand: false },
};

/** `\emark`, the exponent mark ᴇ (entry/macros.ts EMARK says why a macro, and why `\mathopen`). */
const EMARK_MACRO: ChipMacro = { def: "\\mathopen{\u1D07}", args: 0, captureSelection: true, expand: false };

/**
 * The ångström sign of Shift + 9 and Chars (R791): MathLive has no `\AA` and drew the raw name in its error style. Drawn
 * an upright Å; `expand: false` keeps `\AA` in the field's value, so the parser still refuses it as a unit (parse.ts).
 */
const AA_MACRO: ChipMacro = { def: "\\mathrm{\u00C5}", args: 0, captureSelection: true, expand: false };

/** Every macro of the entry line, for the field and for the static renderer. */
export const ENTRY_MACROS: Record<"res" | "ans" | "const" | "unit" | "pfx" | "emark" | "AA", ChipMacro> = {
  ...CHIP_MACROS,
  emark: EMARK_MACRO,
  AA: AA_MACRO,
};
