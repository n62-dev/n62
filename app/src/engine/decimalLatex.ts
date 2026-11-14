// SPDX-License-Identifier: GPL-3.0-or-later
// R189f1: the one rule that writes a plain decimal for the entry line, shared by the Solve app (its values) and the
// matrix grid's write-back (engine/matrixRead.ts elementTex, its floats, in the worker). In engine/ because the engine
// imports nothing from entry/ (scripts/import-rules.ts rule 2); a module of its own, so the start chunk does not take it
// and the main thread loads it only with the Solve app.
/** The exponent mark's macro, entry/macros.ts EMARK (that module is in the start chunk, which may not import an engine
 *  module outside START_ENGINE; decimalLatex.test.ts keeps the two the same). */
export const DECIMAL_EMARK = "\\emark";

/** A plain decimal as LaTeX for the entry line, its exponent as the exponent key types it (R14): 1.5e-3 → 1.5ᴇ-3,
 *  1.5E+20 → 1.5ᴇ20. */
export const decimalLatex = (s: string): string => s.replace(/[eE]\+?(-?\d+)$/, `${DECIMAL_EMARK}$1`);
